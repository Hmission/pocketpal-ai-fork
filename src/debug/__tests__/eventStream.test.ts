/**
 * eventStream 契约测试：buildEventLine 格式 / seq 递增 / emit 节流。
 * 覆盖铁律：BT07（观测不为 SPOF）。
 */
import {buildEventLine, emit, __resetEventStreamForTest} from '../eventStream';

describe('eventStream', () => {
  beforeEach(() => {
    __resetEventStreamForTest();
  });

  it('buildEventLine 输出合法 JSON 事件行（ts/seq/domain/type）', () => {
    const line = buildEventLine('chat', 'chat.user_msg', {text: 'hi'}, 1234);
    const event = JSON.parse(line);
    expect(event.ts).toBe(1234);
    expect(event.seq).toBe(1);
    expect(event.domain).toBe('chat');
    expect(event.type).toBe('chat.user_msg');
    expect(event.payload).toEqual({text: 'hi'});
  });

  it('seq 单调递增', () => {
    buildEventLine('app', 'a');
    buildEventLine('app', 'b');
    buildEventLine('app', 'c');
    const line = buildEventLine('app', 'd');
    expect(JSON.parse(line).seq).toBe(4);
  });

  it('emit 带 throttleKey 时 300ms 内重复调用被节流（返回 false）', () => {
    // RNFS mock 的 appendFile 是异步的；这里只验证节流返回值契约
    const first = emit('chat', 'chat.assistant_delta', {text: 'a'}, 'delta:m1');
    const second = emit(
      'chat',
      'chat.assistant_delta',
      {text: 'ab'},
      'delta:m1',
    );
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('不同 throttleKey 互不干扰', () => {
    emit('chat', 'chat.assistant_delta', {text: 'a'}, 'delta:m1');
    const other = emit('chat', 'chat.assistant_delta', {text: 'b'}, 'delta:m2');
    expect(other).toBe(true);
  });

  it('无 payload 时 payload 字段缺省', () => {
    const event = JSON.parse(buildEventLine('system', 'command.done'));
    expect(event.payload).toBeUndefined();
  });
});
