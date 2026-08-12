# -*- coding: utf-8 -*-
"""P1: PocketPal/llama.cpp 性能指标采集器（logcat 驱动，不依赖 UI）
用法:
  1. 手动/脚本触发 PocketPal 加载模型并发起生成
  2. 本脚本实时抓取 llama_print_timings / RNLlama 日志，解析 tok/s、加载耗时
  3. 同步采集温度/内存快照，结束后生成 JSON+Markdown 报告
"""
import os
import re
import sys
import json
import time
import subprocess
import threading

ADB = r'C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe'
SERIAL = '66b1777f'
OUT_DIR = r'f:\Cursor\OneTakeMVP\.tmp\bench'
os.makedirs(OUT_DIR, exist_ok=True)

# llama.cpp timings 行样例:
# llama_print_timings:        load time =    2110.15 ms
# llama_print_timings:        eval time =    8932.44 ms /   128 runs   (   69.78 ms per token,    14.33 tokens per second)
RE_LOAD = re.compile(r'load time\s*=\s*([\d.]+)\s*ms')
RE_EVAL = re.compile(r'eval time\s*=\s*([\d.]+)\s*ms\s*/\s*(\d+)\s*runs.*?([\d.]+)\s*tokens per second')
RE_PROMPT = re.compile(r'prompt eval time\s*=\s*([\d.]+)\s*ms\s*/\s*(\d+)\s*runs.*?([\d.]+)\s*tokens per second')


def adb(*args):
    return subprocess.run([ADB, '-s', SERIAL] + list(args),
                          capture_output=True, text=True, errors='ignore', timeout=30)


def device_snapshot():
    """温度 + PocketPal 内存快照"""
    snap = {}
    r = adb('shell', 'cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null')
    try:
        snap['cpu_temp_c'] = int(r.stdout.strip()) / 1000
    except ValueError:
        pass
    r = adb('shell', 'grep MemAvailable /proc/meminfo')
    m = re.search(r'(\d+)', r.stdout)
    if m:
        snap['mem_available_mb'] = int(m.group(1)) // 1024
    r = adb('shell', 'dumpsys meminfo com.pocketpalai | head -5 | grep TOTAL')
    m = re.search(r'TOTAL:\s+(\d+)', r.stdout)
    if m:
        snap['pocketpal_pss_mb'] = int(m.group(1)) // 1024
    return snap


class Collector:
    def __init__(self):
        self.events = []
        self.samples = []
        self.stop_flag = threading.Event()

    def logcat_loop(self):
        adb('logcat', '-c')  # 清空旧日志
        p = subprocess.Popen([ADB, '-s', SERIAL, 'logcat', '-v', 'time'],
                             stdout=subprocess.PIPE, text=True, errors='ignore')
        self.proc = p
        for line in p.stdout:
            if self.stop_flag.is_set():
                break
            if 'llama_print_timings' in line or 'RNLlama' in line:
                m = RE_LOAD.search(line)
                if m:
                    self.events.append({'type': 'model_load', 'load_ms': float(m.group(1)),
                                        'ts': time.time(), 'raw': line.strip()[:200]})
                    print('  [采集] 模型加载: %.0f ms' % float(m.group(1)))
                m = RE_PROMPT.search(line)
                if m:
                    self.events.append({'type': 'prompt_eval', 'ms': float(m.group(1)),
                                        'tokens': int(m.group(2)), 'tok_s': float(m.group(3)),
                                        'ts': time.time()})
                    print('  [采集] prompt处理: %.1f tok/s (%d tokens)' % (float(m.group(3)), int(m.group(2))))
                m = RE_EVAL.search(line)
                if m:
                    self.events.append({'type': 'generation', 'ms': float(m.group(1)),
                                        'tokens': int(m.group(2)), 'tok_s': float(m.group(3)),
                                        'ts': time.time()})
                    print('  [采集] 生成速度: %.2f tok/s (%d tokens)' % (float(m.group(3)), int(m.group(2))))
        p.kill()

    def sample_loop(self, interval=5):
        while not self.stop_flag.is_set():
            snap = device_snapshot()
            snap['ts'] = time.time()
            self.samples.append(snap)
            self.stop_flag.wait(interval)

    def stop(self):
        self.stop_flag.set()
        time.sleep(1)
        try:
            self.proc.kill()
        except Exception:
            pass

    def report(self, tag):
        result = {'tag': tag, 'time': time.strftime('%Y-%m-%d %H:%M:%S'),
                  'events': self.events, 'samples': self.samples}
        jf = os.path.join(OUT_DIR, 'bench_%s.json' % tag)
        json.dump(result, open(jf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

        md = ['# 基准报告 %s (%s)' % (tag, result['time']), '']
        md.append('## 事件')
        for e in self.events:
            if e['type'] == 'model_load':
                md.append('- 模型加载: **%.0f ms**' % e['load_ms'])
            elif e['type'] == 'generation':
                md.append('- 生成: **%.2f tok/s** (%d tokens, %.1f s)' % (e['tok_s'], e['tokens'], e['ms'] / 1000))
            elif e['type'] == 'prompt_eval':
                md.append('- Prompt处理: **%.1f tok/s** (%d tokens)' % (e['tok_s'], e['tokens']))
        if self.samples:
            temps = [s.get('cpu_temp_c') for s in self.samples if 'cpu_temp_c' in s]
            mems = [s.get('mem_available_mb') for s in self.samples if 'mem_available_mb' in s]
            pss = [s.get('pocketpal_pss_mb') for s in self.samples if 'pocketpal_pss_mb' in s]
            md.append('')
            md.append('## 环境采样 (%d 次)' % len(self.samples))
            if temps:
                md.append('- CPU温度: %.1f → %.1f °C' % (temps[0], temps[-1]))
            if mems:
                md.append('- 系统可用内存: %d → %d MB' % (mems[0], mems[-1]))
            if pss:
                md.append('- PocketPal PSS峰值: %d MB' % max(pss))
        mf = os.path.join(OUT_DIR, 'bench_%s.md' % tag)
        open(mf, 'w', encoding='utf-8').write('\n'.join(md))
        print('\n报告已生成: %s' % mf)
        print('原始数据: %s' % jf)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%H%M%S')
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    c = Collector()
    t1 = threading.Thread(target=c.logcat_loop, daemon=True)
    t2 = threading.Thread(target=c.sample_loop, daemon=True)
    t1.start()
    t2.start()
    print('采集中 (%d 秒)，请在此期间触发模型加载/对话...' % duration)
    time.sleep(duration)
    c.stop()
    c.report(tag)
