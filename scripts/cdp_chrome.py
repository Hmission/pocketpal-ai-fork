"""
cdp_chrome — 通过 CDP 控制真实 Chrome（browser-use 内置浏览器登录失败的替代通道）
用法：
  python scripts/cdp_chrome.py list
  python scripts/cdp_chrome.py navigate <url>            # 当前页导航
  python scripts/cdp_chrome.py eval <js>                 # 执行 JS 返回 JSON
  python scripts/cdp_chrome.py shot <png_path>           # 截图当前页
  python scripts/cdp_chrome.py click <selector>          # JS 点击
  python scripts/cdp_chrome.py fill <selector> <value>   # JS 填值
端口：9240（本窗口干净 Chrome 会话：--remote-debugging-port=9240 --remote-allow-origins=*，
      用户可交互；母仓会话池默认 LockWindow 锁定不可用）
"""
import json
import sys
import time
from urllib.request import urlopen

import websocket

CDP_HTTP = 'http://127.0.0.1:9240'


def get_page_ws() -> str:
    pages = json.load(urlopen(f'{CDP_HTTP}/json'))
    for p in pages:
        if p.get('type') == 'page':
            return p['webSocketDebuggerUrl']
    raise RuntimeError('no page target')


def send(method: str, params: dict | None = None) -> dict:
    # Chrome 默认拒绝 http://127.0.0.1:9223 Origin 的 WS 握手（需 --remote-allow-origins
    # flag）；suppress_origin 去掉 Origin 头即被放行（chrome-devtools-mcp 同款行为）
    ws = websocket.create_connection(get_page_ws(), timeout=30, suppress_origin=True)
    msg_id = 1
    ws.send(json.dumps({'id': msg_id, 'method': method, 'params': params or {}}))
    while True:
        resp = json.loads(ws.recv())
        if resp.get('id') == msg_id:
            ws.close()
            if 'error' in resp:
                raise RuntimeError(f'CDP error: {resp["error"]}')
            return resp.get('result', {})
        # 忽略事件


def wait_page_ready(seconds: float = 2.0) -> None:
    time.sleep(seconds)


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'list':
        pages = json.load(urlopen(f'{CDP_HTTP}/json'))
        for p in pages:
            if p.get('type') == 'page':
                print(p.get('id'), '|', p.get('url'), '|', p.get('title', '')[:60])
    elif cmd == 'navigate':
        send('Page.navigate', {'url': sys.argv[2]})
        wait_page_ready()
        print('navigated')
    elif cmd == 'eval':
        result = send('Runtime.evaluate', {
            'expression': sys.argv[2],
            'returnByValue': True,
            'awaitPromise': True,
        })
        print(json.dumps(result.get('result', {}).get('value'), ensure_ascii=False))
    elif cmd == 'shot':
        result = send('Page.captureScreenshot', {'format': 'png'})
        import base64
        with open(sys.argv[2], 'wb') as f:
            f.write(base64.b64decode(result['data']))
        print('saved', sys.argv[2])
    elif cmd == 'click':
        selector = sys.argv[2]
        js = f"""
        (() => {{
          const el = document.querySelector({json.dumps(selector)});
          if (!el) return 'NOT_FOUND';
          el.click();
          return 'CLICKED';
        }})()
        """
        print(send('Runtime.evaluate', {'expression': js, 'returnByValue': True})['result']['value'])
    elif cmd == 'clickxy':
        # 真实鼠标点击（框架拦截 JS click 时用）：从 JS 拿元素中心坐标 → CDP 派发
        sel = sys.argv[2]
        js = f"""
        (() => {{
          const el = document.querySelector({json.dumps(sel)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {{x: r.x + r.width / 2, y: r.y + r.height / 2}};
        }})()
        """
        pos = send('Runtime.evaluate', {'expression': js, 'returnByValue': True})['result'].get('value')
        if not pos:
            print('NOT_FOUND')
            return
        send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'], 'y': pos['y']})
        send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
        send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
        print(f"CLICKED_XY {pos['x']:.0f},{pos['y']:.0f}")
    elif cmd == 'clicktext':
        # 按精确文本找元素并真实点击
        text = sys.argv[2]
        js = f"""
        (() => {{
          const els = Array.from(document.querySelectorAll('button,a,div,span,[role=tab]'));
          const el = els.find(e => e.textContent.trim() === {json.dumps(text)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {{x: r.x + r.width / 2, y: r.y + r.height / 2}};
        }})()
        """
        pos = send('Runtime.evaluate', {'expression': js, 'returnByValue': True})['result'].get('value')
        if not pos:
            print('NOT_FOUND')
            return
        send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'], 'y': pos['y']})
        send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
        send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
        print(f"CLICKED_XY {pos['x']:.0f},{pos['y']:.0f}")
    elif cmd == 'fill':
        selector, value = sys.argv[2], sys.argv[3]
        js = f"""
        (() => {{
          const el = document.querySelector({json.dumps(selector)});
          if (!el) return 'NOT_FOUND';
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, {json.dumps(value)});
          el.dispatchEvent(new Event('input', {{bubbles: true}}));
          return 'FILLED';
        }})()
        """
        print(send('Runtime.evaluate', {'expression': js, 'returnByValue': True})['result']['value'])
    else:
        print('unknown command')


if __name__ == '__main__':
    main()
