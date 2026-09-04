import React from 'react';
import {Pressable, Text, View, Animated} from 'react-native';

import {observer} from 'mobx-react';

import {createStyles} from './styles';

import {useTheme} from '../../hooks/useTheme';
import {L10nContext} from '../../utils';

import {CloseIcon, MicIcon, PhoneIcon} from '../../assets/icons';
import {useWaveDots} from '../ui/WaveDots/useWaveDots';

import type {PhoneCallStatus} from '../../services/phoneCall/session';

/**
 * PhoneCallOverlay — 电话模式通话界面（PHONE_SPEC §3.2）。
 *
 * 纯展示 + 手势转发：状态机在 PhoneCallSession（编排层），本组件只渲染
 * 三态（聆听/思考/播报）+ 按住说话 + 挂断；不持有任何业务逻辑。
 *
 * testID：phone-overlay / phone-hold-talk / phone-hangup（CHAT_UI_SPEC §21）。
 */
export interface PhoneCallOverlayProps {
  visible: boolean;
  status: PhoneCallStatus;
  /** 最近一条消息摘要（2 行截断，由 ChatScreen 派生传入） */
  recentText: string;
  partnerName: string;
  modelLabel: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onHangUp: () => void;
  onClose: () => void;
}

export const PhoneCallOverlay: React.FC<PhoneCallOverlayProps> = observer(
  ({
    visible,
    status,
    recentText,
    partnerName,
    modelLabel,
    onStartRecording,
    onStopRecording,
    onHangUp,
    onClose,
  }) => {
    const theme = useTheme();
    const l10n = React.useContext(L10nContext);
    const styles = createStyles({theme});

    // 播报中波形（bounce 三点，生图三点波浪同源——不新建动画体系）
    const wave = useWaveDots(status === 'speaking');

    if (!visible) {
      return null;
    }

    const recording = status === 'recording';
    const phoneCallL10n = l10n.components.phoneCall;
    const statusLabel =
      status === 'recording'
        ? phoneCallL10n.releaseToSend
        : status === 'transcribing' || status === 'awaiting_reply'
          ? phoneCallL10n.thinking
          : status === 'speaking'
            ? phoneCallL10n.speaking
            : phoneCallL10n.listening;

    return (
      <View testID="phone-overlay" style={styles.root}>
        {/* ① 顶栏：伙伴名 + 模型胶囊 + 收起 */}
        <View style={styles.topBar}>
          <View style={styles.topInfo}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            <Text style={styles.modelLabel}>{modelLabel}</Text>
          </View>
          <Pressable
            testID="phone-close"
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}>
            <CloseIcon
              width={20}
              height={20}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>
        </View>

        {/* ② 状态区：三态 icon/波形 + 文案 + 最近消息摘要 */}
        <View style={styles.statusArea}>
          {status === 'speaking' ? (
            <View style={styles.waveRow}>
              {wave.map((v, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveDot,
                    {
                      transform: [
                        {
                          translateY: v.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -10],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.statusIconWrap,
                recording && styles.statusIconWrapRecording,
              ]}>
              <MicIcon
                width={40}
                height={40}
                color={recording ? theme.colors.error : theme.colors.primary}
              />
            </View>
          )}
          <Text style={styles.statusLabel}>{statusLabel}</Text>
          {recentText ? (
            <Text style={styles.recentText} numberOfLines={2}>
              {recentText}
            </Text>
          ) : null}
        </View>

        {/* ③ 控制区：按住说话大圆钮 + 挂断 */}
        <View style={styles.controlArea}>
          <Pressable
            testID="phone-hold-talk"
            onPressIn={onStartRecording}
            onPressOut={onStopRecording}
            style={({pressed}) => [
              styles.holdButton,
              recording && styles.holdButtonRecording,
              pressed && styles.holdButtonPressed,
            ]}>
            {recording ? (
              <MicIcon width={40} height={40} color={theme.colors.onError} />
            ) : (
              <PhoneIcon
                width={40}
                height={40}
                color={theme.colors.onPrimary}
              />
            )}
            <Text
              style={[
                styles.holdLabel,
                recording && styles.holdLabelRecording,
              ]}>
              {recording
                ? phoneCallL10n.releaseToSend
                : phoneCallL10n.holdToTalk}
            </Text>
          </Pressable>
          <Pressable
            testID="phone-hangup"
            onPress={onHangUp}
            hitSlop={12}
            style={styles.hangUpBtn}>
            <Text style={styles.hangUpLabel}>{phoneCallL10n.hangUp}</Text>
          </Pressable>
        </View>
      </View>
    );
  },
);
