/**
 * GenActionBar — 生图页底部吸底操作条（2026-08-26 大王裁定：出图按钮吸底常驻）
 *
 * 从 ComposerPanel 按钮区平移（2026-08-26）：出图/编辑按钮由滚动卡内
 * 上移至页面底部固定条——提示词卡折叠后一屏可见出图按钮，键盘弹出随
 * KeyboardStickyView 跟随（同聊天输入条设计语言）。
 * 逻辑与原有完全等价：Dream 双按钮（编辑/出图 + taskKind 转圈）、
 * 非 Dream（hasEditableImage 时编辑 + 出图）、任务进行期灰置禁点。
 * 任务进行态（疏一事实源）：loading/generating/queueRunning 三段统一转圈——
 * 2026-08-29 补强：队列执行中出图按钮同样转圈（此前仅灰置不转，真机不可见）。
 * 2026-08-29 真机根因（大王报障：点击后文字消失但无转圈）：出图按钮背景 primary、
 * 任务期禁用态 opacity 0.45 仍为 primary 色系——转圈同为 primary 色 → 同色相融不可见
 * （编辑按钮转圈为 onInfo 对比色正常）；转圈改 onPrimary（与「出图」文字同色，高对比可见）。
 * 未加载引导由编排层 onGenerate 处理（按钮不灰置，点击弹引导）。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import {CircularActivityIndicator} from '../../../components/CircularActivityIndicator';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';

export interface GenActionBarProps {
  /** DreamLite 族（双按钮：编辑/出图） */
  isDream: boolean;
  /** 编辑预备态：已锁定当前预览图，按钮文案「执行编辑」 */
  editArming: boolean;
  /** 编辑源图已预解码（执行编辑按钮可用条件） */
  editRgb: Float32Array | null;
  /** 预览区有可编辑图（非 Dream 编辑按钮显示条件） */
  hasEditableImage: boolean;
  /** 引擎加载中（loading 与 generating 同属任务进行期：灰置+转圈防连点） */
  loading?: boolean;
  generating: boolean;
  taskKind: 'gen' | 'edit' | 'caption' | null;
  onEditArm: () => void;
  onGenerate: () => void;
  /** 任务购物车：出图按钮切两半，左 ➕ 入队（IMAGEGEN_QUEUE_SPEC D1-A） */
  onEnqueue?: () => void;
  /** 入队总数徽标（>0 显示在 ➕ 上角） */
  queueItemCount?: number;
  /** 队列执行中（出图/➕ 均锁定） */
  queueRunning?: boolean;
  /** 队列面板入口（胶囊条点击）：仅队列非空时渲染 */
  onOpenQueue?: () => void;
  /** 胶囊摘要文案（如 “2 项 · 3 抽”） */
  queueSummary?: string;
}

export const GenActionBar: React.FC<GenActionBarProps> = ({
  isDream,
  editArming,
  editRgb,
  hasEditableImage,
  loading = false,
  generating,
  taskKind,
  onEditArm,
  onGenerate,
  onEnqueue,
  queueItemCount = 0,
  queueRunning = false,
  onOpenQueue,
  queueSummary,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  /** 任务进行态（转圈+灰置）= 三段同源：引擎加载 / 生成中 / 队列执行中 */
  const busy = loading || generating || queueRunning;
  const locked = busy;

  /** 出图按钮整体（含 ➕ 与「出图」两段）——⬆ 按钮语义与旧版完全等价 */
  const genButton = (
    <View style={[s.button, s.buttonGen, s.buttonGenSplit]}>
      {onEnqueue && (
        <TouchableOpacity
          style={[s.buttonGenPlus, locked && s.buttonDisabled]}
          disabled={locked}
          onPress={onEnqueue}
          testID="imagegen-enqueue">
          <Text style={[s.buttonText, s.buttonTextGen]}>＋</Text>
          {/* 8-27 队列按钮文本标签（大王：只有 + 号用户不懂语义，随段 opacity 统一淡化） */}
          <Text style={s.buttonGenPlusLabel}>排队</Text>
          {queueItemCount > 0 && (
            <Text style={s.buttonGenBadge} testID="imagegen-queue-badge">
              {queueItemCount}
            </Text>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[s.buttonGenMain, locked && s.buttonDisabled]}
        disabled={locked}
        testID="imagegen-generate"
        onPress={() => onGenerate()}>
        {busy ? (
          <CircularActivityIndicator
            size={theme.iconSize.m}
            color={theme.colors.onPrimary}
          />
        ) : (
          <Text style={[s.buttonText, s.buttonTextGen]}>出图</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.bottomBar} testID="imagegen-action-bar">
      {onOpenQueue && queueItemCount > 0 && (
        <TouchableOpacity
          onPress={onOpenQueue}
          disabled={queueRunning}
          style={[s.queueCapsule, queueRunning && s.buttonDisabled]}
          testID="imagegen-queue-capsule">
          <Text style={s.queueCapsuleText}>
            🛒 队列（{queueSummary ?? `${queueItemCount} 项`}）▸
          </Text>
        </TouchableOpacity>
      )}
      {isDream && (
        <View style={s.buttonRow}>
          <TouchableOpacity
            style={[
              s.button,
              s.buttonEdit,
              editArming && !editRgb && s.buttonDisabled,
            ]}
            disabled={locked || (editArming && !editRgb)}
            onPress={onEditArm}>
            {(loading || generating) && taskKind === 'edit' ? (
              <CircularActivityIndicator
                size={theme.iconSize.m}
                color={theme.colors.onInfo}
              />
            ) : (
              <Text style={[s.buttonText, s.buttonTextOnInfo]}>
                {editArming ? '执行编辑' : '编辑'}
              </Text>
            )}
          </TouchableOpacity>
          {genButton}
        </View>
      )}
      {!isDream && (
        <View style={s.buttonRow}>
          {hasEditableImage && (
            <TouchableOpacity
              style={[s.button, s.buttonEdit]}
              disabled={locked}
              onPress={onEditArm}>
              <Text style={[s.buttonText, s.buttonTextOnInfo]}>编辑</Text>
            </TouchableOpacity>
          )}
          {genButton}
        </View>
      )}
    </View>
  );
};
