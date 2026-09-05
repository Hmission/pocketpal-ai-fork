import React, {useEffect} from 'react';
import {Animated, Image, Pressable, ScrollView, Text, View} from 'react-native';

import {observer} from 'mobx-react';

import {createStyles} from './styles';

import {useTheme} from '../../hooks/useTheme';
import {useWaveDots} from '../ui/WaveDots/useWaveDots';
import {PerfMiniRow} from '../PerfMiniRow';
import {L10nContext} from '../../utils';
import {chatSessionStore, ttsStore} from '../../store';
import {audioLevel} from '../../services/phoneCall/audioLevel';
import {assistantId, userId} from '../../utils/chat';
import type {MessageType} from '../../utils/types';
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
 * PhoneCallOverlay v2.4 — 电话模式通话界面（PHONE_SPEC §11.2 + §14.1 布局契约）。
 *
 * 布局（自上而下）：① 联系人区（品牌小鸡图头像 + 名字 + 模型 · 通话时长）
 * ② 状态区（波形/三点/静态柱 + 主状态 + 一行副提示，六态文案见 §11.5）
 * ③ **对话流**（flex:1 铺满主区：伙伴句深色 / 我说浅色，本轮未落库转写补为末条）
 * ④ 播报通路行 ⑤ 跑分迷你行（对话流之下、控制区之上，把垂直空间让给字幕）
 * ⑥ 控制区（挂断居左 / 按住说话居右，72dp 等大分居两侧）。
 *
 * 三条纪律（真机血证，勿回退）：①图标着色一律走 `fill`（本仓 svgr 把 #333333
 * 映射为 {props.fill}，传 color 无效 → v2.0 图标全部不渲染，见 DESIGN_SPEC §3）；
 * ②不另造入口与容器（右上 ✕ 与挂断同函数已删；跑分复用 PerfMiniRow）；
 * ③hooks 全部在 `if (!visible) return null` 之前声明。纯展示 + 手势转发，
 * 状态机在 PhoneCallSession；对话流与播报通路同源规则＝observer 直读 store，
 * 不新增 props 接线（§11.3）。
 */
export interface PhoneCallOverlayProps {
  visible: boolean;
  status: PhoneCallStatus;
  partnerName: string;
  modelLabel: string;
  /** 引擎就绪门控（engineStatus.chat/prompter 任一 ready） */
  engineReady: boolean;
  /** 未就绪时加载信息（progress/stage，engineStatus 单源） */
  engineLoading: {progress: number; stage: string} | null;
  /** 通话时长秒数（useElapsed 驱动） */
  elapsedSeconds: number;
  /** 本轮转写文本：轮次级常驻（§11.4），未落库时补为对话流末条浅色行（§14.1） */
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
 * 三根声波柱（v2.4 起录音期由**真实振幅**驱动，§14.2）。
 * 动画体系与本文件 `pulse` 同族（core Animated + JS driver，**不另引 reanimated**）。
 * 数据源分两条，各自诚实：
 * - `recording`：`progress` ← 原生 RMS 事件（`audioLevel` 单通道，20Hz 命令式推入，
 *   不触发 React 重渲染）——无声即回落，**不造假波形**；
 * - `speaking`：`progress` ← 组件内 900ms 往复呼吸（麦克风已停、播报无振幅回传，
 *   只作「正在播」节律提示，不声称是音量）。
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

/**
 * 对话流一行（§14.1）：`me`=我说（浅色），`partner`=它说（深色主读）。
 * 数据源 = chatSessionStore 当前会话消息 + 未落库的实时转写。
 */
type DialogueLine = {id: string; role: 'me' | 'partner'; text: string};

/**
 * 非对话卡片判定（§14.1 v2.4 真机补修）：通话字幕只放**真实对话**。
 * 2026-09-05 K90 铁证：上一版只挡 `metadata.system`，结果「🎨 已识别为生图任务，
 * 管家优化提示词中…」这类**任务占位卡**（`type:'text'` + author=assistant，但无
 * system 标记）被当成「伙伴说的话」铺进字幕，读着像 bug。
 *
 * 标记集来自写入方（单一事实）：`chatImageTask.ts`（imageTask/editTask/captionTask
 * 及其 Failed 变体）、`useChatScheduler.insertTaskError`（taskError）、
 * `useChatSession.addSystemMessage`（system）。**`butler` 不在此列**——管家直答卡
 * 会被原地回写为真正回复文本，那是伙伴说的话，必须保留。
 * TODO(P1)：与 ChatScreen 任务卡动作槽的同源枚举收敛为一个 util（现为两处并列声明）。
 */
const CARD_METADATA_KEYS = [
  'system',
  'imageTask',
  'imageTaskFailed',
  'editTask',
  'editTaskFailed',
  'captionTask',
  'captionTaskFailed',
  'taskError',
] as const;

const isNonDialogueCard = (m: MessageType.Any): boolean => {
  const meta = m.metadata as Record<string, unknown> | undefined;
  if (!meta) {
    return false;
  }
  return CARD_METADATA_KEYS.some(k => meta[k] != null && meta[k] !== false);
};

/**
 * 消息归属判定（v2.4 自查修正）：**不得假设「type=text 就是我说」**——
 * 系统提示（模型未加载 / Completion failed 等）也是 text 且 author=assistant，
 * 旧写法会把报错当「我说的话」铺进字幕。口径与 contextCompaction.speakerOf 一致：
 * 先按 author id 判，author 缺失（存量脏数据/测试桩）再按消息类型回退。
 */
const dialogueRoleOf = (m: MessageType.Any): 'me' | 'partner' => {
  if (m.author?.id === userId) {
    return 'me';
  }
  if (m.author?.id === assistantId) {
    return 'partner';
  }
  return m.type === 'assistant_turn' ? 'partner' : 'me';
};

/** 未落库的实时转写行 id（也是 testID=phone-transcript 的唯一挂点） */
const LIVE_LINE_ID = 'phone-live-transcript';
/** 对话流尾窗口（防长通话无限渲染；上滚看更早历史不在本期范围） */
const DIALOGUE_TAIL = 12;

/** 联系人头像：品牌小鸡图（与聊天空态同一资产，零新增——§11.2） */
const PARTNER_AVATAR = require('../../assets/pocketpal-dark-v2.png');

export const PhoneCallOverlay: React.FC<PhoneCallOverlayProps> = observer(
  ({
    visible,
    status,
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

    // 对话流（§14.1 v2.4：铺满主区，取代「我说/它说」两行摘要）——observer 直读
    // chatSessionStore（与播报通路同一源规则，不新增 props 接线）。
    //
    // **顺序契约（2026-09-05 K90 真机定位，旧写法整条反了）**：
    // `currentSessionMessages` 是**新在旧前**——`addMessageToCurrentSession` 用
    // `unshift`、DB 读取用 `Q.sortBy('position', Q.desc)`、ChatView 是 `inverted` 列表。
    // 所以「最近 DIALOGUE_TAIL 条」= 数组**头部** `slice(0, N)`，再**倒序遍历**成
    // 屏上「旧→新」字幕；直接 `forEach` + `slice(-N)` 会把最旧 N 条当最新，
    // 真机表现为「字幕停在开场问候语，伙伴的新回复永远看不到」。
    const dialogue: DialogueLine[] = [];
    // 无活动会话时 getter 可能返 undefined（store 契约），不得在此抛错杀通话页
    const recent = (chatSessionStore.currentSessionMessages ?? []).slice(
      0,
      DIALOGUE_TAIL,
    );
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const m = recent[i];
      if (m.type === 'text') {
        // 系统提示与任务卡（生图/编辑/反推/调度错误）不是「谁说了什么」：
        // 一律不入字幕（v2.4 真机补修，否则报错与进度文案会被当成对话）
        if (isNonDialogueCard(m)) {
          continue;
        }
        const text = (m as MessageType.Text).text?.trim();
        if (text) {
          dialogue.push({id: m.id, role: dialogueRoleOf(m), text});
        }
      } else if (m.type === 'assistant_turn') {
        // 契约：可见文本只读 `steps`（metadata.steps 是落盘形态，消费方禁读）
        const text = (m as MessageType.AssistantTurn).steps
          .map(s => s.content?.trim() ?? '')
          .filter(Boolean)
          .join('\n');
        if (text) {
          dialogue.push({id: m.id, role: 'partner', text});
        }
      }
    }
    // 本轮转写尚未落库（或刚落库）：未落库时补为末条浅色行（§11.4 常驻语义不回退）
    const lastLine = dialogue[dialogue.length - 1];
    if (transcript.trim() && lastLine?.text !== transcript.trim()) {
      dialogue.push({id: LIVE_LINE_ID, role: 'me', text: transcript.trim()});
    }

    // 声波数据源（v2.4 换真实振幅，§14.2）：
    // - 录音期 = 原生 RMS 事件驱动（无声即回落，不造假）
    // - 播报期 = 900ms 呼吸循环（麦克风已停，无振幅源，诚实作节律提示）
    // **hooks 必须全部在 `if (!visible) return null` 之前声明**：2026-09-05 真机证，
    // 放早退之后会在「打开通话页」那一帧抛 Rendered more hooks 致命 JS 异常杀进程。
    const waveProgress = React.useRef(new Animated.Value(0)).current;
    const levelAnim = React.useRef(new Animated.Value(0)).current;
    const scrollRef = React.useRef<ScrollView>(null);
    // 贴底几何（§14.1）：视口高 / 内容高各记一份，任一变化都重算精确偏移
    const viewportHRef = React.useRef(0);
    const contentHRef = React.useRef(0);
    const stickToBottom = React.useCallback(() => {
      const y = contentHRef.current - viewportHRef.current;
      if (y > 0) {
        scrollRef.current?.scrollTo({y, animated: false});
      }
    }, []);
    useEffect(() => {
      if (status !== 'speaking') {
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
    useEffect(() => {
      if (status !== 'recording') {
        levelAnim.setValue(0);
        return undefined;
      }
      // 真实振幅驱动（事件约 20Hz，命令式推入 Animated，不触发 React 重渲染）
      return audioLevel.subscribe(l => {
        Animated.timing(levelAnim, {
          toValue: l,
          duration: 90,
          useNativeDriver: false,
        }).start();
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);
    // 自动贴底（§14.1）不用 useEffect + InteractionManager（那个时机新行尚未测量），
    // 也不用 scrollToEnd：2026-09-05 K90 真机证它读的是**未含 contentContainerStyle
    // padding 的旧高**，稳定少滚 6dp（=18px），最新一行永远差一截。现由
    // onContentSizeChange / onLayout 双入口喂入权威几何，算精确偏移（见下方 JSX）。

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

    // 状态行视觉（§11.5 波形语义契约）：录音/播报 = 呼吸声波柱（有真实相位）；
    // 思考 = 三点跳动（等待回合的真实推进信号）；转写/空闲聆听 =
    // 三根不等高**静态**柱——无数据源不造假波形。
    const renderStatusGlyph = () => {
      if (recording) {
        return <WaveBars progress={levelAnim} color={theme.colors.error} />;
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

              {/* 对话流（§14.1）：全文铺满主区，伙伴句深色 / 我说浅色，自动到底；
                  本轮转写未落库时也常驻（§11.4 不回退，testID 仍为 phone-transcript） */}
              <ScrollView
                ref={scrollRef}
                style={styles.conversation}
                contentContainerStyle={styles.conversationContent}
                showsVerticalScrollIndicator={false}
                onLayout={e => {
                  viewportHRef.current = e.nativeEvent.layout.height;
                  stickToBottom();
                }}
                onContentSizeChange={(_contentWidth, contentHeight) => {
                  // 此回调在新内容**测量完成后**触发，h 已含 contentContainerStyle
                  // padding，是算真实底的唯一可靠数据源（逐字播报期也跟随）。
                  contentHRef.current = contentHeight;
                  stickToBottom();
                }}
                testID="phone-dialogue">
                {dialogue.map(line => (
                  <Text
                    key={line.id}
                    testID={
                      line.id === LIVE_LINE_ID ? 'phone-transcript' : undefined
                    }
                    style={[
                      styles.conversationLine,
                      line.role === 'partner'
                        ? styles.conversationPartner
                        : styles.conversationMe,
                    ]}>
                    {line.text}
                  </Text>
                ))}
              </ScrollView>

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
                  width={theme.iconSize.xl}
                  height={theme.iconSize.xl}
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
