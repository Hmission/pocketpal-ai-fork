/**
 * errorRegistry 契约测试：regex 命中 / 未命中 / 首个命中（与母仓 exception_handler 同构）。
 */
import {matchError, matchFirstError, ERROR_PATTERNS} from '../errorRegistry';
import {buildUnauthorizedError} from '../../api/openaiClient/helpers';

describe('errorRegistry', () => {
  it('注册表非空且编号唯一', () => {
    const ids = ERROR_PATTERNS.map(p => p.cpId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ERROR_PATTERNS.length).toBeGreaterThan(0);
  });

  /**
   * 顺序契约：CP-APP-017 必在 015 之前。
   * `matchError` 取首个命中，而 015 带「连接失败」这类宽词面——一旦 015 排前，
   * 带「连接失败」字样的 401 会被引到「查网络」上去（错方向的导航比无导航更坑）。
   */
  it('CP-APP-017（鉴权）排在 CP-APP-015（不可达）之前', () => {
    const i17 = ERROR_PATTERNS.findIndex(p => p.cpId === 'CP-APP-017');
    const i15 = ERROR_PATTERNS.findIndex(p => p.cpId === 'CP-APP-015');
    expect(i17).toBeGreaterThanOrEqual(0);
    expect(i15).toBeGreaterThanOrEqual(0);
    expect(i17).toBeLessThan(i15);
  });

  it('带「连接失败」字样的鉴权错仍归 017，不被 015 抢走', () => {
    // 构造最易混淆的一句：同时命中 017（Unauthorized）与 015（连接失败）的词面。
    const tricky = '连接失败：Unauthorized: Invalid or missing API key';
    expect(matchFirstError(tricky)?.cpId).toBe('CP-APP-017');
  });

  it('JSI bindings not installed 命中 CP-APP-001', () => {
    const hits = matchError('Error: JSI bindings not installed');
    expect(hits[0].cpId).toBe('CP-APP-001');
    expect(hits[0].navigation).toContain('restore-llamarn-jnilibs');
  });

  it('OOM 命中 CP-APP-002', () => {
    const hit = matchFirstError(
      'java.lang.OutOfMemoryError: Failed to allocate',
    );
    expect(hit?.cpId).toBe('CP-APP-002');
  });

  it('ERR_ 前缀命中 CP-APP-006（生图失败）', () => {
    const hit = matchFirstError('ERR_ENGINE_NOT_READY');
    expect(hit?.cpId).toBe('CP-APP-006');
  });

  it('未知错误无命中（返回空数组）', () => {
    expect(matchError('some brand new error type')).toEqual([]);
    expect(matchFirstError('')).toBeNull();
  });

  it('多模式命中时 matchFirstError 取注册表首个', () => {
    // "engine busy" 命中 CP-APP-004；"txt2img" 命中 CP-APP-006 → 取前序 CP-APP-004
    const hit = matchFirstError('engine busy while txt2img running');
    expect(hit?.cpId).toBe('CP-APP-004');
  });

  it('身份锚异常命中 CP-APP-014（Wave B 注册表扩展）', () => {
    const hit = matchFirstError('identity_reborn: seed rebuilt on cold start');
    expect(hit?.cpId).toBe('CP-APP-014');
    expect(hit?.navigation).toContain('wakeCheck');
  });

  it('义肢离线命中 CP-APP-015（Wave E 与系统消息同词面）', () => {
    const hit = matchFirstError(
      'fetch failed: limb_offline server unreachable',
    );
    expect(hit?.cpId).toBe('CP-APP-015');
  });

  it('生长账本写入失败命中 CP-APP-016（Wave D 观测器官）', () => {
    const hit = matchFirstError('growth append failed: EACCES on AIOS_ROOT');
    expect(hit?.cpId).toBe('CP-APP-016');
    expect(hit?.navigation).toContain('静默降级');
  });

  /**
   * 表驱动完备护栏（2026-09-07 W3）：注册表里**每一条**都必须有真样本能命中它。
   *
   * 立项缘由：`audit:compass` 闸门只保证「条目存在 + 路径不悬空」，不保证
   * 「regex 写得对」——一条永不匹配的 regex 照样能过闸门，仍是假生效（本轮补的
   * CP-APP-007..013 七条就处于这种未验证状态）。断言用 `matchFirstError` 而非
   * `triggerRegex.test`：后者只测单条能不能中，前者还能抓到「被前序模式抢走」。
   * 新加条目不补样本 → 本用例直接红。
   */
  const SAMPLE_BY_CP: Record<string, string> = {
    'CP-APP-001': 'Error: JSI bindings not installed',
    'CP-APP-002':
      'java.lang.OutOfMemoryError: Failed to allocate 1073741824 bytes',
    'CP-APP-003': 'model not found: /sdcard/Documents/AIOS/models/x.gguf',
    'CP-APP-004': 'engine busy, awaitEngineReady timeout',
    'CP-APP-005': 'Adreno OpenCL kernel compile hang',
    'CP-APP-006': 'ERR_SAMPLING 生图失败 txt2img',
    'CP-APP-007': '反推失败：视觉模型未加载（mmproj missing）',
    'CP-APP-008': 'AUDIO_BUSY 录音被占用，转写失败',
    'CP-APP-009': 'tool.error: invalid tool arguments for read_screen',
    'CP-APP-010':
      'NIGHT_TASK_START_FAILED: Not allowed to start foreground service',
    'CP-APP-011': 'sherpa: sample_rate does not exist in metadata → 生成噪音',
    'CP-APP-012': '基准用例卡死：benchmark abort at stage 2',
    'CP-APP-013': 'Context is full: budget_decision saturated',
    'CP-APP-014': 'identity_reborn: 身份锚缺失，已重建种子',
    'CP-APP-015': 'limb_offline：连接失败 fetch failed',
    'CP-APP-016': 'growth append failed: EACCES on AIOS_ROOT',
    // 样本直接取**生产函数产出的原文**，不在此再抄一句：文案单点 + 指南针样本
    // 绑死，旧「两处字面复制必然漂」的病结构性不可再生。
    'CP-APP-017': buildUnauthorizedError(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ).message,
  };

  it('每条注册模式都有真样本可命中（防「条目在但永不匹配」的假生效）', () => {
    expect(Object.keys(SAMPLE_BY_CP).sort()).toEqual(
      ERROR_PATTERNS.map(p => p.cpId).sort(),
    );
    for (const p of ERROR_PATTERNS) {
      const sample = SAMPLE_BY_CP[p.cpId]!;
      expect(matchFirstError(sample)?.cpId).toBe(p.cpId);
    }
  });
});
