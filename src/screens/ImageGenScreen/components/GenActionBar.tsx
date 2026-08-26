/**
 * GenActionBar — 生图页底部吸底操作条（2026-08-26 大王裁定：出图按钮吸底常驻）
 *
 * 从 ComposerPanel 按钮区平移（2026-08-26）：出图/编辑按钮由滚动卡内
 * 上移至页面底部固定条——提示词卡折叠后一屏可见出图按钮，键盘弹出随
 * KeyboardStickyView 跟随（同聊天输入条设计语言）。
 * 逻辑与原有完全等价：Dream 双按钮（编辑/出图 + taskKind 转圈）、
 * 非 Dream（hasEditableImage 时编辑 + 出图）、任务进行期灰置禁点。
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
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  return (
    <View style={s.bottomBar} testID="imagegen-action-bar">
      {isDream && (
        <View style={s.buttonRow}>
          <TouchableOpacity
            style={[
              s.button,
              s.buttonEdit,
              editArming && !editRgb && s.buttonDisabled,
            ]}
            disabled={loading || generating || (editArming && !editRgb)}
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
          {/* onPress 必须显式无参调用（不可直传 onGenerate）：RN 会把 GestureResponderEvent
              作为首参传入，若直传 handleGenerate(event)，可选参 promptOverride 会收到 event，
              入口 (promptOverride ?? prompt).trim() 即抛 TypeError 被事件系统吞掉——
              现象为「有按压缩放动效但出图无反应」（2026-08-20 两台真机 + 注入三重复现） */}
          <TouchableOpacity
            style={[
              s.button,
              s.buttonGen,
              (loading || generating) && s.buttonDisabled,
            ]}
            disabled={loading || generating}
            testID="imagegen-generate"
            onPress={() => onGenerate()}>
            {(loading || generating) && taskKind === 'gen' ? (
              <CircularActivityIndicator
                size={theme.iconSize.m}
                color={theme.colors.primary}
              />
            ) : (
              <Text
                style={[
                  s.buttonText,
                  (loading || generating) && s.buttonTextDisabled,
                ]}>
                出图
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {!isDream && (
        <View style={s.buttonRow}>
          {/* 非 Dream 编辑入口（2026-08-21）：预览区有图时常驻，点击由编排层
              确认后自动切 DreamLite（SD3.5/Z-Image 无编辑引擎）；未加载不禁用 */}
          {hasEditableImage && (
            <TouchableOpacity
              style={[s.button, s.buttonEdit]}
              disabled={loading || generating}
              onPress={onEditArm}>
              <Text style={[s.buttonText, s.buttonTextOnInfo]}>编辑</Text>
            </TouchableOpacity>
          )}
          {/* 未加载不再灰置：点击由编排层弹引导（提示+展开模型下拉），新手友好 */}
          <TouchableOpacity
            style={[
              s.button,
              s.buttonGen,
              (loading || generating) && s.buttonDisabled,
            ]}
            disabled={loading || generating}
            testID="imagegen-generate"
            onPress={() => onGenerate()}>
            {loading || generating ? (
              <CircularActivityIndicator
                size={theme.iconSize.m}
                color={theme.colors.primary}
              />
            ) : (
              <Text
                style={[
                  s.buttonText,
                  (loading || generating) && s.buttonTextDisabled,
                ]}>
                出图
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
