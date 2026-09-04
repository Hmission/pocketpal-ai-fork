import React from 'react';
import {Animated, Pressable, Text, View} from 'react-native';

import {observer} from 'mobx-react';

import {createStyles} from './styles';

import {useTheme} from '../../hooks/useTheme';
import {useWaveDots} from '../ui/WaveDots/useWaveDots';
import {PerfMiniRow} from '../PerfMiniRow';
import {L10nContext} from '../../utils';
import type {PerfSnapshot} from '../../specs/NativeHardwareInfo';

import {CloseIcon, MicIcon, PhoneIcon} from '../../assets/icons';
import {formatElapsed} from '../../hooks/useElapsed';

import type {PhoneCallStatus} from '../../services/phoneCall/session';

/**
 * PhoneCallOverlay v2 — 电话模式通话界面（PHONE_SPEC §10.2「打电话式」UI）。
 *
 * 布局：①联系人区（头像+名字+模型+通话时长）②状态区（聆听/识别/思考/播报
 * 三态 + 转写回显 + 最近消息摘要）③跑分迷你行（复用 PerfMiniRow，chatTurnPerf
 * 数据源，零另造）④控制区（按住说话 84dp 涟漪 + 挂断）。
 * 引擎门控（§10.3）：engineReady=false → hold 禁用 + 加载进度条；就绪自动解锁。
 * 纯展示 + 手势转发，状态机在 PhoneCallSession。
 */
export interface PhoneCallOverlayProps {
  visible: boolean;
  status: PhoneCallStatus;
  /** 最近一条消息摘要（2 行截断，由 ChatScreen 派生传入） */
  recentText: string;
  partnerName: string;
  modelLabel: string;
  /** 引擎就绪门控（engineStatus.chat/prompter 任一 ready） */
  engineReady: boolean;
  /** 未就绪时加载信息（progress/stage，engineStatus 单源） */
  engineLoading: {progress: number; stage: string} | null;
  /** 通话时长秒数（useElapsed 驱动） */
  elapsedSeconds: number;
  /** 转写回显文本（transcribing 态显示） */
  transcript: string;
  /** 跑分迷你行数据（chatTurnPerf.livePoints 尾窗） */
  perfHistory: PerfSnapshot[];
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
    engineReady,
    engineLoading,
    elapsedSeconds,
    transcript,
    perfHistory,
    onStartRecording,
    onStopRecording,
    onHangUp,
    onClose,
  }) => {
    const theme = useTheme();
    const l10n = React.useContext(L10nContext);
    const styles = createStyles({theme});
    const phoneCallL10n = l10n.components.phoneCall;

    // 播报/思考中波形（bounce 三点，生图三点波浪同源——不新建动画体系）
    const wave = useWaveDots(
      status === 'speaking' || status === 'awaiting_reply',
    );

    // 按住涟漪脉冲（录音中 scale 呼吸，JS driver——动画纪律收口）
    const pulse = React.useRef(new Animated.Value(0)).current;
    React.useEffect(() => {
      if (status === 'recording') {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0,
              duration: 500,
              useNativeDriver: false,
            }),
          ]),
        );
        loop.start();
        return () => loop.stop();
      }
      pulse.setValue(0);
      return undefined;
    }, [status, pulse]);

    if (!visible) {
      return null;
    }

    const recording = status === 'recording';
    const transcribing = status === 'transcribing';
    const thinking = status === 'awaiting_reply';
    const speaking = status === 'speaking';
    const unlocked = engineReady;

    // 三态文案（§10.3 反馈闭环：识别中独立于思考中）
    const statusLabel = recording
      ? phoneCallL10n.releaseToSend
      : transcribing
        ? phoneCallL10n.recognizing
        : thinking
          ? phoneCallL10n.thinking
          : speaking
            ? phoneCallL10n.speaking
            : unlocked
              ? phoneCallL10n.listening
              : phoneCallL10n.engineLoading;

    const holdScale = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.06],
    });
    const partnerInitial = partnerName.trim().slice(0, 1) || '?';
    const loadingPct =
      engineLoading && engineLoading.progress >= 0
        ? Math.round(engineLoading.progress * 100)
        : null;

    return (
      <View testID="phone-overlay" style={styles.root}>
        {/* ① 联系人区（打电话仪式）：头像 + 名字 + 模型 + 通话时长 */}
        <View style={styles.contactArea} testID="phone-contact">
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{partnerInitial}</Text>
            </View>
          </View>
          <Text style={styles.partnerName} numberOfLines={1}>
            {partnerName}
          </Text>
          <View style={styles.contactMetaRow}>
            <Text style={styles.modelLabel} numberOfLines={1}>
              {modelLabel}
            </Text>
            <Text style={styles.elapsed} testID="phone-elapsed">
              {formatElapsed(elapsedSeconds)}
            </Text>
          </View>
        </View>

        {/* ② 状态区：三态 + 转写回显 + 最近消息摘要 / 引擎加载进度 */}
        <View style={styles.statusArea}>
          {!unlocked && engineLoading ? (
            <View
              style={styles.engineLoadingWrap}
              testID="phone-engine-progress">
              <View style={styles.waveRowSmall}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={styles.waveDotSmall} />
                ))}
              </View>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              {loadingPct !== null ? (
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, {width: `${loadingPct}%`}]}
                  />
                </View>
              ) : null}
              {engineLoading.stage ? (
                <Text style={styles.progressStage} numberOfLines={1}>
                  {engineLoading.stage}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              {recording ? (
                <Animated.View
                  style={[
                    styles.statusIconWrap,
                    styles.statusIconWrapRecording,
                    {transform: [{scale: holdScale}]},
                  ]}>
                  <MicIcon width={40} height={40} color={theme.colors.error} />
                </Animated.View>
              ) : speaking || thinking ? (
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
                <View style={styles.statusIconWrap}>
                  <MicIcon
                    width={40}
                    height={40}
                    color={theme.colors.primary}
                  />
                </View>
              )}
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              {/* 转写实时回显（§10.3：输入成功反馈） */}
              {transcribing && transcript ? (
                <Text
                  testID="phone-transcript"
                  style={styles.transcript}
                  numberOfLines={2}>
                  「{transcript}」
                </Text>
              ) : null}
              {recentText && !transcribing ? (
                <Text style={styles.recentText} numberOfLines={2}>
                  {recentText}
                </Text>
              ) : null}
              {/* ③ 跑分迷你行（复用 PerfMiniRow——核心资产，chatTurnPerf 同源） */}
              <View
                style={styles.perfRow}
                testID="phone-perf-row"
                pointerEvents="box-none">
                <PerfMiniRow
                  history={perfHistory}
                  defaultExpanded={false}
                  chartHeight={48}
                  testIDPrefix="phone-perf"
                />
              </View>
            </>
          )}
        </View>

        {/* ④ 控制区：按住说话（未就绪禁用）+ 挂断 */}
        <View style={styles.controlArea}>
          <Pressable
            testID="phone-hold-talk"
            onPressIn={unlocked ? onStartRecording : undefined}
            onPressOut={unlocked ? onStopRecording : undefined}
            disabled={!unlocked}
            style={({pressed}) => [
              styles.holdButton,
              recording && styles.holdButtonRecording,
              !unlocked && styles.holdButtonDisabled,
              pressed && unlocked && styles.holdButtonPressed,
            ]}>
            {recording ? (
              <MicIcon width={40} height={40} color={theme.colors.onError} />
            ) : (
              <PhoneIcon
                width={40}
                height={40}
                color={
                  unlocked
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceDisabled
                }
              />
            )}
            <Text
              style={[
                styles.holdLabel,
                recording && styles.holdLabelRecording,
                !unlocked && styles.holdLabelDisabled,
              ]}>
              {recording
                ? phoneCallL10n.releaseToSend
                : unlocked
                  ? phoneCallL10n.holdToTalk
                  : phoneCallL10n.engineLoading}
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

        {/* 右上角收起（悬浮，避开联系人区） */}
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
    );
  },
);
