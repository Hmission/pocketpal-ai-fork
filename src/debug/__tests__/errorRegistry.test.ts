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
});
