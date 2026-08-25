/**
 * PendingIndicator 生成进度监控卡测试（CHAT_UI_SPEC §18.9）：
 * 阶段标签 + 总耗时 + 思考流预览 + 心跳超时判定。
 * 注：不用 fake timers——Animated.loop（三点波浪）与其冲突；
 * 组件 mount 时 effect 首跑 tick() 已得出正确 elapsed/stalled，
 * interval 只负责后续刷新，断言 mount 值即可。
 */
import React from 'react';
import {StyleSheet} from 'react-native';
import {runInAction} from 'mobx';
import {render} from '../../../../jest/test-utils';
import {PendingIndicator} from '../PendingIndicator';
import {modelStore} from '../../../store';

const NOW = Date.now();

describe('PendingIndicator — 生成进度监控卡（§18.9）', () => {
  afterEach(() => {
    // B40 仪式卡用例可能置位模型加载态，用例间复位
    runInAction(() => {
      modelStore.isContextLoading = false;
    });
  });
  it('prefill 阶段显示阶段标签 + 总耗时（不再裸三点）', () => {
    const {getByText} = render(
      <PendingIndicator
        agentStatus="prefill"
        runStartedAt={NOW - 3000}
        lastAgentEventAt={NOW}
      />,
    );
    expect(getByText(/Preparing… · 3s/)).toBeTruthy();
  });

  it('streaming 阶段显示「正在生成」', () => {
    const {getByText} = render(
      <PendingIndicator
        agentStatus="streaming_text"
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
      />,
    );
    expect(getByText(/Generating…/)).toBeTruthy();
  });

  it('思考流预览：TTFT 期显示模型内心戏', () => {
    const {getByTestId} = render(
      <PendingIndicator
        agentStatus="prefill"
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
        reasoningTail="用户想要一个贪吃蛇，先分析棋盘尺寸…"
      />,
    );
    const text = getByTestId('pending-indicator-reasoning').props.children;
    expect(String(text).replace('Thinking: ', '')).toContain('先分析棋盘尺寸');
  });

  it('工具调用模式保留 token 计数', () => {
    const {getByText} = render(
      <PendingIndicator
        pendingTalentNames={['render_html']}
        toolCallTokenCount={42}
        agentStatus="generating_tool_call"
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
      />,
    );
    expect(getByText(/Building page · 42 tokens/)).toBeTruthy();
  });

  it('心跳超时（>300s 无事件）→ 疑似卡住提示', () => {
    const {getByText} = render(
      <PendingIndicator
        agentStatus="prefill"
        runStartedAt={NOW - 330000}
        lastAgentEventAt={NOW - 301000}
      />,
    );
    expect(getByText(/Seems stuck — tap Stop · 330s/)).toBeTruthy();
  });

  it('isStopping 覆盖一切（停止确认优先）', () => {
    const {getByText} = render(
      <PendingIndicator
        agentStatus="prefill"
        isStopping
        runStartedAt={NOW}
        lastAgentEventAt={NOW - 400000}
      />,
    );
    expect(getByText('Stopping…')).toBeTruthy();
  });

  it('runStartedAt 为空 → 无耗时后缀（向后兼容）', () => {
    const {queryByTestId} = render(<PendingIndicator />);
    expect(queryByTestId('pending-indicator-suffix')).toBeNull();
  });

  it('卡片化（v4.2）：容器有底色+圆角，对齐 assistant 卡片设计语言', () => {
    const {getByTestId} = render(
      <PendingIndicator agentStatus="prefill" runStartedAt={NOW} />,
    );
    const card = getByTestId('pending-indicator');
    const flat = StyleSheet.flatten(card.props.style);
    expect(flat.backgroundColor).toBeTruthy();
    // 尾角下移（v4.3）：四角显式拆分（删 borderRadius 速记），左下直角、
    // 其余三角 = messageBorderRadius（>0）。校验左下直角 + 右下圆角。
    expect(flat.borderBottomLeftRadius).toBe(0);
    expect(flat.borderBottomRightRadius).toBeGreaterThan(0);
  });

  // ── B39 跑分感（PERF_BENCHMARK_DESIGN §10.4）──
  // （卡片顶部描边已按大王红线移除——AI 风装饰不允许；阶段信息由心跳波形/文案承载）
  it('活跃时心跳波形在场（活着的证据）', () => {
    const {getByTestId} = render(
      <PendingIndicator
        agentStatus="prefill"
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
      />,
    );
    expect(getByTestId('pending-indicator-wave')).toBeTruthy();
  });

  it('卡住时心跳平坦（诚实：波形隐去）', () => {
    const {queryByTestId} = render(
      <PendingIndicator
        agentStatus="prefill"
        runStartedAt={NOW - 330000}
        lastAgentEventAt={NOW - 301000}
      />,
    );
    expect(queryByTestId('pending-indicator-wave')).toBeNull();
  });

  it('停止中心跳平坦（收尾不演）', () => {
    const {queryByTestId} = render(
      <PendingIndicator
        agentStatus="prefill"
        isStopping
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
      />,
    );
    expect(queryByTestId('pending-indicator-wave')).toBeNull();
  });

  it('工具期首帧速率不演假数（差分未成立时不带 tok/s）', () => {
    const {getByText} = render(
      <PendingIndicator
        pendingTalentNames={['render_html']}
        toolCallTokenCount={42}
        agentStatus="generating_tool_call"
        runStartedAt={NOW}
        lastAgentEventAt={NOW}
      />,
    );
    expect(getByText(/Building page · 42 tokens/).props.children).not.toContain(
      'tok/s',
    );
  });

  // ── B40 仪式卡（PERF_BENCHMARK_DESIGN §11.2 第一波）──
  it('B40 遥测行常驻：采样未回时诚实显 --（不造假）', () => {
    const {getByTestId, getAllByText} = render(
      <PendingIndicator agentStatus="prefill" runStartedAt={NOW} />,
    );
    expect(getByTestId('pending-indicator-telemetry')).toBeTruthy();
    // jest 环境无原生快照 → 三个指标均显 --
    expect(getAllByText('--').length).toBeGreaterThanOrEqual(3);
  });

  it('B40 模型加载阶段行：isContextLoading 时可见，复位后消失', () => {
    runInAction(() => {
      modelStore.isContextLoading = true;
    });
    const {getByTestId, rerender, queryByTestId} = render(
      <PendingIndicator agentStatus="prefill" runStartedAt={NOW} />,
    );
    expect(getByTestId('pending-indicator-loading')).toBeTruthy();
    runInAction(() => {
      modelStore.isContextLoading = false;
    });
    rerender(<PendingIndicator agentStatus="prefill" runStartedAt={NOW} />);
    expect(queryByTestId('pending-indicator-loading')).toBeNull();
  });
});
