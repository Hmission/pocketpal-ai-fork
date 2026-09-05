/**
 * errorRegistry 契约测试：regex 命中 / 未命中 / 首个命中（与母仓 exception_handler 同构）。
 */
import {matchError, matchFirstError, ERROR_PATTERNS} from '../errorRegistry';

describe('errorRegistry', () => {
  it('注册表非空且编号唯一', () => {
    const ids = ERROR_PATTERNS.map(p => p.cpId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ERROR_PATTERNS.length).toBeGreaterThan(0);
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
});
