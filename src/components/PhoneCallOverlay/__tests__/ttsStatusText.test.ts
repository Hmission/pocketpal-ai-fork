import {ttsStatusTextFor} from '../ttsStatusText';

const t = {
  ttsPlayFailed: 'PLAY_FAILED',
  ttsLangMismatch: 'LANG_MISMATCH',
  ttsDisabled: 'DISABLED',
  ttsNoVoice: 'NO_VOICE',
  ttsEngineUnavailable: 'ENGINE_UNAVAILABLE',
  ttsReady: 'READY',
};

describe('ttsStatusTextFor：播报状态行文案唯一映射点', () => {
  it('两道门都放行 → 就绪', () => {
    expect(ttsStatusTextFor(t, null, null)).toBe('READY');
  });

  it('三条真机不可构造的拦路分支各有专属文案，不得串台', () => {
    expect(ttsStatusTextFor(t, 'device', null)).toBe('DISABLED');
    expect(ttsStatusTextFor(t, 'noVoice', null)).toBe('NO_VOICE');
    expect(ttsStatusTextFor(t, 'engine', null)).toBe('ENGINE_UNAVAILABLE');
  });

  it('运行期问题优先于静态门：点了没反应时不得回报拦路原因或就绪', () => {
    expect(ttsStatusTextFor(t, null, 'failed')).toBe('PLAY_FAILED');
    expect(ttsStatusTextFor(t, null, 'lang')).toBe('LANG_MISMATCH');
    // 关键回归点：门也拦着 + 又播失败 → 必须报失败，换文案即误导用户。
    expect(ttsStatusTextFor(t, 'engine', 'failed')).toBe('PLAY_FAILED');
    expect(ttsStatusTextFor(t, 'noVoice', 'lang')).toBe('LANG_MISMATCH');
  });

  it('文案一律取自入参（多语言漏翻会在 locale 层暴露，不在这里硬编码）', () => {
    const zh = {
      ...t,
      ttsReady: '播报就绪',
      ttsNoVoice: '还没选播报语音，点这里选',
    };
    expect(ttsStatusTextFor(zh, null, null)).toBe('播报就绪');
    expect(ttsStatusTextFor(zh, 'noVoice', null)).toBe(
      '还没选播报语音，点这里选',
    );
  });
});
