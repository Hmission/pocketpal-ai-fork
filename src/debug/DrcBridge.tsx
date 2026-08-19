/**
 * #711 DrcBridge | CP=DRC-005 | ST=running | 测试: 无（门控组件）
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT07 观测不为SPOF
 *   入口: App.tsx 挂载（NavigationContainer 内）→ 出口: startDrcService 生命周期
 *   角色: DRC 单一挂载点——注册导航槽 + 启动命令轮询；卸载时逆序清理。
 *
 * 门控契约（单一事实源 DRC_ENABLED）：
 *   - App.tsx 无条件挂载，本组件内 `if (!DRC_ENABLED) return null` 自门控
 *     （DRC_ENABLED = __E2E__ || BuildInfo.isDevSupport，release 运行时恒不激活）
 *   - 生产 bundle grep 校验标记（本串出现即 DCE 契约被破坏，fix gate not grep）：
 *     DRC_BRIDGE
 *   - 渲染 null，零 UI 面。
 */
import * as React from 'react';
import {useNavigation} from '@react-navigation/native';

import {registerNavSlot} from './actionRegistry';
import {DRC_ENABLED} from './drcTypes';
import {emit} from './eventStream';
import {startDrcService, stopDrcService} from './drcService';
import {refreshStateSnapshot, setCurrentRoute} from './stateSnapshot';
import {engineStatus} from '../store/engineStatus';

export const DrcBridge: React.FC = () => {
  const navigation = useNavigation();

  React.useEffect(() => {
    // 当前路由名（state.json currentRoute 单一事实源）。
    // navigation.getState 在无 navigator 上下文时不可用（Container 级 navigation
    // 无 getState）→ try/catch 静默降级（观测不为 SPOF），避免阻断后续 effect。
    const updateRoute = () => {
      try {
        const state = (navigation as any).getState?.();
        const top = state?.routes?.[state.index ?? 0];
        setCurrentRoute(top?.name ?? null);
      } catch {
        // 静默：currentRoute 保持 null
      }
    };
    updateRoute();
    const unsubscribe = navigation.addListener('state', updateRoute);
    return unsubscribe;
  }, [navigation]);

  React.useEffect(() => {
    if (!DRC_ENABLED) {
      console.warn('[DRC] disabled (not dev/e2e build)');
      return;
    }
    console.log('[DRC] bridge mounting');
    // 导航单槽：actionRegistry.nav.go 经此驱动 react-navigation
    registerNavSlot((route, params) => {
      (navigation as any).navigate(route, params);
    });
    // 引擎状态变更 → 刷新 state.json（解耦接线：engineStatus 不感知快照）
    const unsubscribe = engineStatus.onChange(refreshStateSnapshot);
    void startDrcService();
    emit('app', 'app.drc_ready', {enabled: true});
    return () => {
      registerNavSlot(null);
      unsubscribe();
      stopDrcService();
    };
  }, [navigation]);

  return null;
};
