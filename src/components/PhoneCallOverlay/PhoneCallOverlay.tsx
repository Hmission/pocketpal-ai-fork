import React, {useEffect} from 'react';
import {Animated, Image, Pressable, Text, View} from 'react-native';

import {observer} from 'mobx-react';

import {createStyles} from './styles';

import {useTheme} from '../../hooks/useTheme';
import {useWaveDots} from '../ui/WaveDots/useWaveDots';
import {PerfMiniRow} from '../PerfMiniRow';
import {L10nContext} from '../../utils';
import {ttsStore} from '../../store';
import type {PerfSnapshot} from '../../specs/NativeHardwareInfo';

import {
  MicIcon,
  PhoneIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from '../../assets/icons';
import {formatElapsed} from '../../hooks/useElapsed';

import type {PhoneCallStatus} from '../../services/phoneCall/session';

/**
 * PhoneCallOverlay v2.1 — 电话模式通话界面（PHONE_SPEC §11.2 复测定案）。
 *
 * 布局（自上而下）：① 联系人区（品牌小鸡图头像 + 名字回落链 + 模型 · 通话时长）
 * ② 状态区（小图标 + 一句话状态 + 副提示，六态文案见 §11.5）③ 对话回显
 * （「我说」轮次级常驻 + 「它说」回复摘要）④ 播报通路行（不可用时可点拉起
 * 既有 TTSSetupSheet，不静默失败）⑤ 跑分迷你行（复用 PerfMiniRow，默认展开）
 * ⑥ 控制区（**同一横行**：按住说话 96 + 挂断 64，caption 在圆钮下方）。
 *
 * v2.1 三条纠正：①图标着色一律走 `fill`（本仓 svgr 把 #333333 映射为
 * {props.fill}，传 color 无效 → v2.0 图标全部不渲染，见 DESIGN_SPEC §3）；
 * ②删除右上 ✕（与挂断同函数 = 重复入口）；③大空圆改为贴边状态行（不再
 * 88px 空底衬）。纯展示 + 手势转发，状态机在 PhoneCallSession。
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
  /** 本轮转写文本（轮次级常驻回显，§11.4） */
  transcript: string;
  /** 跑分迷你行数据（chatTurnPerf.livePoints 尾窗） */
  perfHistory: PerfSnapshot[];
  onStartRecording: () => void;
  onStopRecording: () => void;
  onHangUp: () => void;
}

/**
 * 三根声波柱高度区间 [min, max]（dp）——**契约常量**：单测断言区间与柱数，
 * 防后人改坏（§11.5）。首柱最低、中柱最高，呈语音波形观感。
 */
export const WAVE_BAR_RANGE: ReadonlyArray<readonly [number, number]> = [
  [12, 22],
  [16, 30],
  [10, 18],
];

/**
 * 录音/播报声波（v2.2 新增，§11.5 波形语义契约）：三根同相位异频呼吸柱。
 * 动画体系与本文件 `pulse` 同族（core Animated + JS driver，**不另引 reanimated**）。
 * 数据源诚实：`progress` 来自组件内 900ms 往复呼吸循环，不是振幅——真实振幅
 * 需原生 AudioRecord 通道（未接），因此**不假装随音量跳动**，仅表达
 * 「正在录 / 正在播」的节律；振幅真实化已入 P1 待办（§12.2）。
 */
const WaveBars = ({
  progress,
  color,
}: {
  progress: Animated.Value;
  color: string;
}) => {
  const theme = useTheme();
  const styles = createStyles({theme});
  return (
    <View style={styles.waveWrap} testID="phone-wave">
      {WAVE_BAR_RANGE.map((range, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            i === 1 ? styles.waveBarTall : null,
            {
              backgroundColor: color,
              height: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [range[0], range[1]],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

/** 联系人头像：品牌小鸡图（与聊天空态同一资产，零新增——§11.2） */
const PARTNER_AVATAR = require('../../assets/pocketpal-dark-v2.png');

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
  }) => {
    const theme = useTheme();
    const l10n = React.useContext(L10nContext);
    const styles = createStyles({theme});
    const t = l10n.components.phoneCall;

    // 播报通路显式化（§11.3）：observer 直读 ttsStore（MobX 字段访问即订阅），
    // 不经 props 接线——单一事实源，零 prop 膨胀。
    const ttsAvailable = ttsStore.isTTSAvailable;
    const hasVoice = ttsStore.currentVoice != null;
    const ttsReady = ttsAvailable && hasVoice;
    const ttsStatusText = !ttsAvailable
      ? t.ttsDisabled
      : !hasVoice
        ? t.ttsNoVoice
        : t.ttsReady;

    // 思考/播报中波形（bounce 三点，生图三点波浪同源——不新建动画体系）
    const wave = useWaveDots(
      status === 'speaking' || status === 'awaiting_reply',
    );

    // 按住涟漪脉冲（录音中整钮呼吸，JS driver——动画纪律收口）
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

    // 录音/播报声波（v2.2）：三根异频呼吸柱，与 pulse 同一套 core Animated 体系。
    // **hooks 必须全部在 `if (!visible) return null` 之前声明**：2026-09-05 真机证，
    // 将本 effect 放到早退之后会在「打开通话页」那一帧抛
    // `Rendered more hooks than during the previous render` 致命 JS 异常直接杀进程。
    const waveProgress = React.useRef(new Animated.Value(0)).current;
    useEffect(() => {
      if (status !== 'recording' && status !== 'speaking') {
        waveProgress.setValue(0);
        return undefined;
      }
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveProgress, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(waveProgress, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    if (!visible) {
      return null;
    }

    const recording = status === 'recording';
    const transcribing = status === 'transcribing';
    const thinking = status === 'awaiting_reply';
    const speaking = status === 'speaking';
    const unlocked = engineReady;

    // 六态主文案 + 副提示（§11.5 一句话体系，全角标点，第一人称「我」）
    const statusLabel = recording
      ? t.releaseToSend
      : transcribing
        ? t.recognizing
        : thinking
          ? t.thinking
          : speaking
            ? t.speaking
            : unlocked
              ? transcript
                ? t.listening
                : t.readyToTalk
              : t.engineLoading;
    const hintText = recording
      ? t.hintRecording
      : transcribing
        ? t.hintTranscribing
        : thinking
          ? t.hintThinking
          : speaking
            ? t.hintSpeaking
            : unlocked
              ? t.hintIdle
              : t.hintEngineLoading;

    const holdScale = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.04],
    });
    const loadingPct =
      engineLoading && engineLoading.progress >= 0
        ? Math.round(engineLoading.progress * 100)
        : null;
    // 「它说」= 回复落流后的摘要；与「我说」同文（回复未落流时末条仍是自己）
    // 时不重复显示。
    const partnerText =
      (thinking || speaking) &&
      recentText.trim() &&
      recentText.trim() !== transcript.trim()
        ? recentText
        : '';

    // 状态行视觉（§11.5 波形语义契约）：录音/播报 = 呼吸声波柱（有真实相位）；
    // 思考 = 三点跳动（等待回合的真实推进信号）；转写/空闲聆听 =
    // 三根不等高**静态**柱——无数据源不造假波形。
    const renderStatusGlyph = () => {
      if (recording) {
        return <WaveBars progress={waveProgress} color={theme.colors.error} />;
      }
      if (speaking) {
        return (
          <WaveBars progress={waveProgress} color={theme.colors.primary} />
        );
      }
      if (thinking) {
        return (
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
                          outputRange: [0, -6],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        );
      }
      return (
        <View style={styles.waveWrap} testID="phone-ambient">
          <View style={[styles.ambientBar, styles.ambientBar1]} />
          <View style={[styles.ambientBar, styles.ambientBar2]} />
          <View style={[styles.ambientBar, styles.ambientBar3]} />
        </View>
      );
    };

    return (
      <View testID="phone-overlay" style={styles.root}>
        {/* ① 联系人区（打电话仪式）：小鸡头像 + 名字 + 模型 · 通话时长 */}
        <View style={styles.contactArea} testID="phone-contact">
          <View style={styles.avatarRing}>
            <Image
              testID="phone-avatar"
              source={PARTNER_AVATAR}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.partnerName} numberOfLines={1}>
            {partnerName}
          </Text>
          <View style={styles.contactMetaRow}>
            {modelLabel ? (
              <Text style={styles.modelLabel} numberOfLines={1}>
                {modelLabel}
              </Text>
            ) : null}
            <Text style={styles.elapsed} testID="phone-elapsed">
              {formatElapsed(elapsedSeconds)}
            </Text>
          </View>
        </View>

        {/* ② 状态区：引擎加载门控 或 （小图标 + 状态 + 副提示 + 对话回显 + 播报通路 + 跑分行） */}
        <View style={styles.statusArea}>
          {!unlocked && engineLoading ? (
            <View
              style={styles.engineLoadingWrap}
              testID="phone-engine-progress">
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
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          ) : (
            <View style={styles.dialogArea}>
              <View style={styles.statusRow}>
                {renderStatusGlyph()}
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              </View>
              <Text style={styles.hintText}>{hintText}</Text>

              {/* 对话回显（§11.4：转写轮次级常驻，不再只在 transcribing 一瞬） */}
              {transcript ? (
                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel}>{t.mineLabel}</Text>
                  <Text
                    testID="phone-transcript"
                    style={styles.lineContent}
                    numberOfLines={2}>
                    {`「${transcript}」`}
                  </Text>
                </View>
              ) : null}
              {partnerText ? (
                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel}>{t.partnerLabel}</Text>
                  <Text style={styles.lineContentMuted} numberOfLines={2}>
                    {partnerText}
                  </Text>
                </View>
              ) : null}

              {/* 播报通路（§11.3：不可静默失败，不可用时可点去设置） */}
              <Pressable
                testID="phone-tts-status"
                onPress={ttsReady ? undefined : () => ttsStore.openSetupSheet()}
                hitSlop={8}
                style={styles.ttsRow}>
                {ttsReady ? (
                  <VolumeOnIcon
                    fill={theme.colors.primary}
                    width={theme.iconSize.xs}
                    height={theme.iconSize.xs}
                  />
                ) : (
                  <VolumeOffIcon
                    fill={theme.colors.error}
                    width={theme.iconSize.xs}
                    height={theme.iconSize.xs}
                  />
                )}
                <Text
                  style={[styles.ttsText, !ttsReady && styles.ttsTextAction]}>
                  {ttsStatusText}
                </Text>
              </Pressable>

              {/* ③ 跑分迷你行（复用 PerfMiniRow——核心资产，chatTurnPerf 同源，默认展开） */}
              <View
                style={styles.perfRow}
                testID="phone-perf-row"
                pointerEvents="box-none">
                <PerfMiniRow
                  history={perfHistory}
                  defaultExpanded
                  chartHeight={48}
                  testIDPrefix="phone-perf"
                />
              </View>
            </View>
          )}
        </View>

        {/* ④ 控制区（§11.2 v2.2 定案）：**挂断居左、按住说话居右**，两钮分居两侧
            （最大间距，根治大王报的「离得太近会误触」）；同一基线，caption 在圆外下方。 */}
        <View style={styles.controlArea} testID="phone-controls">
          <View style={styles.controlItem}>
            <Pressable
              testID="phone-hangup"
              onPress={onHangUp}
              hitSlop={8}
              style={styles.hangupButton}>
              {/* 挂断符号 = 电话图标横置（业界通话结束语义，不另造图标资产） */}
              <View style={styles.hangupGlyph}>
                <PhoneIcon
                  fill={theme.colors.onError}
                  width={theme.iconSize.l}
                  height={theme.iconSize.l}
                />
              </View>
            </Pressable>
            <Text style={styles.controlCaption}>{t.hangUp}</Text>
          </View>

          <Animated.View
            style={[styles.controlItem, {transform: [{scale: holdScale}]}]}>
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
              <MicIcon
                fill={
                  recording
                    ? theme.colors.onError
                    : unlocked
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant
                }
                width={theme.iconSize.xl}
                height={theme.iconSize.xl}
              />
            </Pressable>
            <Text
              style={[
                styles.controlCaption,
                recording && styles.controlCaptionRecording,
                !unlocked && styles.controlCaptionDisabled,
              ]}>
              {recording
                ? t.releaseToSend
                : unlocked
                  ? t.holdToTalk
                  : t.engineLoading}
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  },
);
