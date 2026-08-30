import * as React from 'react';
import {
  NativeModules,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import {pick, types} from '@react-native-documents/picker';
import Clipboard from '@react-native-clipboard/clipboard';
import Share from 'react-native-share';
import {resolveAudioPath} from '../../../services/asrEngine';
import {getPlayPosition} from '../../../services/ttsEngine';
import {
  SUPERTONIC_VOICES,
  KOKORO_VOICES,
  KITTEN_VOICES,
} from '../../../services/tts';

import {audioStore} from '../../../store/audioStore';
import {imageGenStore, GeneratedImage} from '../../../store/imageGenStore';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {chatSessionStore} from '../../../store';
import {InputSlider} from '../../../components/InputSlider';
import {WaveDots} from '../../../components/ui/WaveDots';
import {
  AlertTriangleMdIcon,
  HeadphonesMdIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
} from '../../../assets/icons';
import {WaveformBars} from './WaveformBars';
import {PerfPanel} from './PerfPanel';
import {copyAndSaveErrorReport} from '../../../utils/errorReport';
import {BannerBar} from '../../../components/ui/BannerBar';
import type {PreviewBanner} from './ResultPreview';

/**
 * AudioWorkshopTab — 创作工坊「音频工坊」tab（AUDIO_UI_SPEC v1.4）
 *
 * 次级分段：转写（ASR，任务化入画廊 kind='transcribe'）／生成（TTS 合成 wav 文件，
 * kind='tts' 入画廊；产物落盘 AIOS/audio/output/，共享存储用户可见）。
 * 三区结构（对齐生图 tab）：① 结果区（产物卡）② 历史区 ③ 创作区（composer）。
 * 锋利：引擎未装/未就绪 → 显式报错（任务化 failed 收口），无兜底降级。
 */
export const AudioWorkshopTab: React.FC<{
  onSnackbar: (msg: string, variant?: 'info' | 'warning' | 'error') => void;
  /** 顶部横幅（瞬时任务反馈，叠卡片顶部不压创作区；整卡可点关闭；
      编辑锁定常驻不传——生图 tab 专属状态） */
  banner?: PreviewBanner | null;
  onDismissBanner?: () => void;
}> = observer(({onSnackbar, banner, onDismissBanner}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  /** B33：录音转写进行中（录音按钮态） */
  const [recording, setRecording] = React.useState(false);
  /** B35：转写结果卡展开收起（对齐生图反推卡 captionExpanded 交互） */
  const [transcribeExpanded, setTranscribeExpanded] = React.useState(false);
  /** B36：结果区焦点条目（默认最新；历史条点按切换，对齐生图相册翻页联动） */
  const [transcribeFocusId, setTranscribeFocusId] = React.useState<
    string | null
  >(null);
  const [ttsFocusId, setTtsFocusId] = React.useState<string | null>(null);
  /** B36：running 进度卡累计秒数 */
  const [now, setNow] = React.useState(Date.now());
  const [opStartedAt, setOpStartedAt] = React.useState<number | null>(null);

  // B36：三点波浪动效（running 整卡，与生图页同设计语言；JS driver 合规——
  // B57 渲染归一 ui/WaveDots，active 语义由条件渲染承载）
  const dotsActive = audioStore.transcribing || audioStore.ttsGenerating;

  // B38：播放器进度轮询（500ms 驱动时间轴；播完自动复位）
  // observer 本地读（MobX 惯例）：isPlaying 是 observable 属性，插入/结束经 observer
  // 重渲染 → 局部变量刷新 → effect 重跑（启动/停止轮询），行为等价。
  const isPlaying = audioStore.isPlaying;
  React.useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const t = setInterval(async () => {
      try {
        const st = await getPlayPosition();
        runInAction(() => {
          audioStore.playPosition = st.position;
          audioStore.playDuration = st.duration;
          if (!st.isPlaying) {
            audioStore.isPlaying = false;
            if (st.duration > 0 && st.position >= st.duration - 400) {
              // 播完：复位到起点（保留 uri，按钮回「播放」）
              audioStore.playPosition = 0;
            }
          }
        });
      } catch {
        // 轮询失败静默，下一拍重试
      }
    }, 500);
    return () => clearInterval(t);
  }, [isPlaying]);

  // 转写历史（kind='transcribe' success，历史条 + 结果区 success 页）
  // 转写/生成任务派生（v1.10：observer 内直接派生——useMemo 依赖 history.length
  // 对 finishTask 的 status patch 不重算，新转写成功后历史条/结果三态页永不刷新，
  // 2026-08-30 真机实锤；MobX 字段访问即订阅，直接 filter 每次渲染派生）
  const transcribeHistory = imageGenStore.history.filter(
    h => h.kind === 'transcribe' && h.status === 'success',
  );

  // 生成历史（kind='tts' success）
  const ttsHistory = imageGenStore.history.filter(
    h => h.kind === 'tts' && h.status === 'success',
  );

  // B36：本段全部任务（含 failed，结果区三态页数据源；历史条只列 success）
  const transcribeTasks = imageGenStore.history.filter(
    h => h.kind === 'transcribe',
  );
  const ttsTasks = imageGenStore.history.filter(h => h.kind === 'tts');

  /** 结果区焦点（fallback 最新任务；删除/新任务自动归位） */
  const transcribeFocus =
    transcribeTasks.find(t => t.taskId === transcribeFocusId) ??
    transcribeTasks[0] ??
    null;
  const ttsFocus =
    ttsTasks.find(t => t.taskId === ttsFocusId) ?? ttsTasks[0] ?? null;

  // 新任务产生 → 焦点重置最新（依赖数组提取为具名变量：避免下标访问表达式）
  const transcribeLatestTaskId = transcribeTasks[0]?.taskId;
  React.useEffect(() => {
    setTranscribeFocusId(null);
  }, [transcribeLatestTaskId]);
  const ttsLatestTaskId = ttsTasks[0]?.taskId;
  React.useEffect(() => {
    setTtsFocusId(null);
  }, [ttsLatestTaskId]);

  // running 期间 1s 时钟（进度卡累计秒数）
  // observer 本地读（MobX 惯例，ImageGenScreen 同款）：transcribing/ttsGenerating 是
  // observable 属性，变化触发 observer 重渲染 → 局部变量刷新 → effect 重跑（启停 tick）。
  const transcribing = audioStore.transcribing;
  const ttsGenerating = audioStore.ttsGenerating;
  React.useEffect(() => {
    if (!transcribing && !ttsGenerating) {
      setOpStartedAt(null);
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [transcribing, ttsGenerating]);

  React.useEffect(() => {
    audioStore.refreshAsrState();
  }, []);

  /** 当前引擎音色清单（kokoro/supertonic/kitten 常量目录；引擎选择在顶栏 B35） */
  // observer 本地读：genEngine 是 observable 属性，切换经 observer 重渲染 → 局部变量
  // 刷新 → useMemo 重算音色清单，行为等价。
  const genEngine = audioStore.genEngine;
  const genVoices = React.useMemo(() => {
    if (genEngine === 'kokoro') {
      return KOKORO_VOICES;
    }
    if (genEngine === 'supertonic') {
      return SUPERTONIC_VOICES;
    }
    return KITTEN_VOICES;
  }, [genEngine]);

  React.useEffect(() => {
    if (
      !audioStore.voiceId ||
      !genVoices.some(v => v.id === audioStore.voiceId)
    ) {
      audioStore.setVoiceId(genVoices[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStore.genEngine]);

  const selectedVoice =
    genVoices.find(v => v.id === audioStore.voiceId) ?? null;

  /** 选音频文件 → 转写任务化（DocumentPicker 选 wav；原生层只收 wav 16k） */
  const handlePickAndTranscribe = async () => {
    let res;
    try {
      res = await pick({
        type: [types.audio, 'application/octet-stream'],
        allowMultiSelection: false,
      });
    } catch {
      return; // 用户取消选择
    }
    const p = res[0]?.uri;
    if (!p) {
      return;
    }
    if (audioStore.asrState !== 'ready') {
      onSnackbar('语音模型未下载，请先下载 SenseVoice');
      return;
    }
    // DocumentPicker 返回 content:// uri，文件名在编码路径片段里
    const displayName = decodeURIComponent(
      (p.split('/').pop() ?? '').split('?')[0] ?? '',
    );
    if (!displayName.toLowerCase().endsWith('.wav')) {
      onSnackbar('请选择 wav 音频文件（16kHz）');
      return;
    }
    onSnackbar('正在准备音频…');
    let localPath: string;
    try {
      localPath = await resolveAudioPath(p);
    } catch (e) {
      console.warn('[AudioWorkshop] 音频读取失败:', e);
      onSnackbar('音频读取失败');
      return;
    }
    setOpStartedAt(Date.now());
    const text = await audioStore.transcribeTask(localPath);
    if (text) {
      onSnackbar('转写完成');
    } else {
      onSnackbar('转写失败，详见结果区');
    }
  };

  /** 下载 SenseVoice 模型 */
  const handleDownloadAsr = async () => {
    try {
      await audioStore.downloadAsrModel();
      onSnackbar('语音模型下载完成');
    } catch (e) {
      onSnackbar((e as Error)?.message ?? '下载失败');
    }
  };

  /** 生成音频（任务化入画廊）；text 缺省用输入框内容（重生成/录音回填可传参） */
  const handleGenerate = async (text: string = audioStore.genText) => {
    if (!text.trim()) {
      onSnackbar('请输入要生成的文本', 'warning');
      return;
    }
    if (!selectedVoice) {
      onSnackbar('请先选择音色', 'warning');
      return;
    }
    const out = await audioStore.generateTask(
      audioStore.genEngine,
      text,
      selectedVoice,
      {
        speed: audioStore.speed,
        numSteps: audioStore.supertonicSteps,
      },
    );
    if (out) {
      onSnackbar('音频已生成');
    } else {
      onSnackbar('生成失败，详见结果区', 'error');
    }
  };

  /** B36：failed 页一键复制完整报错（复制 + 落盘 AIOS/logs，与生图 failed 页同链路） */
  const handleCopyError = async (item: GeneratedImage) => {
    const path = await copyAndSaveErrorReport({
      summary: item.errorSummary ?? '音频任务失败',
      detail: item.errorDetail ?? '',
    });
    onSnackbar(path ? `报错已复制并保存：${path}` : '报错已复制');
  };

  /** B36：转写 failed 重试（同源重发；录音缓存文件可能已清 → 显式失败不静默） */
  const handleTranscribeRetry = async (item: GeneratedImage) => {
    if (!item.uri) {
      onSnackbar('源文件路径不可用，请重新选择音频文件', 'warning');
      return;
    }
    setOpStartedAt(Date.now());
    const text = await audioStore.transcribeTask(item.uri);
    onSnackbar(text ? '转写完成' : '转写失败，详见结果区');
  };

  /** B33：录音转写（AudioRecord PCM→WAV → SenseVoice） */
  const handleRecordToggle = async () => {
    if (recording) {
      const p = await NativeModules.AudioRecord.stopRecording();
      setRecording(false);
      if (!p) {
        onSnackbar('录音文件为空', 'error');
        return;
      }
      setOpStartedAt(Date.now());
      const text = await audioStore.transcribeTask(p);
      if (text) {
        onSnackbar('转写完成');
      } else {
        onSnackbar('转写失败，详见结果区');
      }
      return;
    }
    if (audioStore.asrState !== 'ready') {
      onSnackbar('语音模型未下载，请先下载 SenseVoice');
      return;
    }
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        onSnackbar('录音权限被拒绝', 'error');
        return;
      }
    }
    setOpStartedAt(Date.now());
    try {
      await NativeModules.AudioRecord.startRecording();
      setRecording(true);
      onSnackbar('正在录音，再次点击停止并转写');
    } catch (e) {
      onSnackbar((e as Error)?.message ?? '录音启动失败', 'error');
    }
  };

  /** B36：生成 failed 重试（复用产物 prompt 同文本重发，对齐生图「重试」语义） */
  const handleTtsRetry = (item: GeneratedImage) => {
    if (!item.prompt) {
      onSnackbar('无可用提示词，请重新输入', 'warning');
      return;
    }
    audioStore.setGenText(item.prompt);
    handleGenerate(item.prompt);
  };

  /** 播放/暂停切换（B38：播放器状态机在 audioStore，预览窗口与历史卡共享） */
  const handlePlay = (uri: string) => audioStore.togglePlay(uri);

  /** 时长格式化（ms → m:ss） */
  const fmtDur = (ms: number): string => {
    const secs = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  /** 分享产物文件 */
  const handleShare = async (uri: string) => {
    try {
      await Share.open({url: `file://${uri}`});
    } catch {
      // 用户取消分享
    }
  };

  return (
    <View style={s.card}>
      {/* 卡片顶部横幅（v4.3：与生图 tab 同一设计语言——语义色 wash 无灰底，整卡点击关闭） */}
      {banner ? (
        <View style={s.bannerOverlay} pointerEvents="box-none">
          <BannerBar
            variant={banner.variant}
            text={banner.text}
            onPress={banner.dismissable ? onDismissBanner : undefined}
            onDismiss={banner.dismissable ? onDismissBanner : undefined}
          />
        </View>
      ) : null}
      {/* 次级分段（复用 KnowledgeScreen tabBar 样式语义） */}
      <View style={s.audioSegBar}>
        <TouchableOpacity
          style={[
            s.audioSeg,
            audioStore.audioSeg === 'transcribe' && s.audioSegActive,
          ]}
          onPress={() => audioStore.setAudioSeg('transcribe')}
          hitSlop={{top: 10, bottom: 10}}
          testID="audio-seg-transcribe">
          <Text
            style={[
              s.audioSegText,
              audioStore.audioSeg === 'transcribe' && s.audioSegTextActive,
            ]}>
            转写
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.audioSeg,
            audioStore.audioSeg === 'generate' && s.audioSegActive,
          ]}
          onPress={() => audioStore.setAudioSeg('generate')}
          hitSlop={{top: 10, bottom: 10}}
          testID="audio-seg-generate">
          <Text
            style={[
              s.audioSegText,
              audioStore.audioSeg === 'generate' && s.audioSegTextActive,
            ]}>
            生成
          </Text>
        </TouchableOpacity>
      </View>

      {audioStore.audioSeg === 'transcribe' ? (
        <>
          {/* ① 结果区（B36：整卡三态——running 波浪进度 / success 全文卡 / failed 报错页） */}
          <View style={s.audioResult}>
            {audioStore.transcribing ? (
              <View style={s.audioResultStage}>
                <View style={s.genDotsRow}>
                  {/* B57：归一 ui/WaveDots（原 10px/8gap/8 振幅视觉参数回传） */}
                  <WaveDots
                    active={dotsActive}
                    size={10}
                    gap={8}
                    translateY={8}
                  />
                </View>
                <Text style={s.genOverlayTitle}>正在转写…</Text>
                <Text style={s.overlayText}>
                  {audioStore.transcribeStage || '准备中…'} ·{' '}
                  {Math.max(0, Math.round((now - (opStartedAt ?? now)) / 1000))}
                  s
                </Text>
              </View>
            ) : transcribeFocus?.status === 'failed' ? (
              <View style={s.audioResultStage}>
                <AlertTriangleMdIcon
                  width={34}
                  height={34}
                  stroke={theme.colors.danger}
                />
                <Text style={s.failedTitle}>转写失败</Text>
                <Text style={s.failedSummary} numberOfLines={3}>
                  {transcribeFocus.errorSummary ?? '未知错误'}
                </Text>
                <View style={s.failedBtns}>
                  <TouchableOpacity
                    style={s.failedBtn}
                    onPress={() => handleCopyError(transcribeFocus)}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-copy-error">
                    <Text style={s.failedBtnText}>复制报错信息</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => handleTranscribeRetry(transcribeFocus)}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-retry-transcribe">
                    <Text style={s.failedBtnGhostText}>重试</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() =>
                      imageGenStore.deleteTask(transcribeFocus.taskId)
                    }
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}>
                    <Text style={s.failedBtnGhostText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : transcribeFocus ? (
              <>
                <Text style={s.audioTranscribeTitle}>转写结果</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setTranscribeExpanded(v => !v)}
                  testID="audio-transcribe-body">
                  <Text
                    style={s.captionCardBody}
                    numberOfLines={transcribeExpanded ? undefined : 3}>
                    {transcribeFocus.prompt}
                  </Text>
                  <Text style={s.captionCardHint}>
                    {transcribeExpanded ? '收起 ▴' : '展开 ▾'}
                  </Text>
                </TouchableOpacity>
                <View style={s.audioResultBtns}>
                  {/* v1.10：对照播放（源音频已持久化 AIOS/audio/transcribe/；播放中变暂停） */}
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnSend]}
                    onPress={() =>
                      audioStore.togglePlay(transcribeFocus.uri).catch(() => {})
                    }
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-play-source">
                    <Text style={[s.audioBtnText, s.audioBtnTextSend]}>
                      {audioStore.playingUri === transcribeFocus.uri &&
                      audioStore.isPlaying
                        ? '暂停原文'
                        : '播放原文'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnCopy]}
                    onPress={() => {
                      Clipboard.setString(transcribeFocus.prompt);
                      onSnackbar('已复制');
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-copy">
                    <Text style={[s.audioBtnText, s.audioBtnTextCopy]}>
                      复制
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnSend]}
                    onPress={() => {
                      chatSessionStore.addMessageToCurrentSession({
                        id: '',
                        author: 'user',
                        createdAt: Date.now(),
                        text: transcribeFocus.prompt,
                        type: 'text',
                      } as any);
                      onSnackbar('已发送到聊天');
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-send-chat">
                    <Text style={[s.audioBtnText, s.audioBtnTextSend]}>
                      发送到聊天
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnDelete]}
                    onPress={() =>
                      imageGenStore.deleteTask(transcribeFocus.taskId)
                    }
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-delete-transcribe">
                    <Text style={[s.audioBtnText, s.audioBtnTextDelete]}>
                      删除
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={s.audioStage}>暂无转写记录</Text>
            )}
          </View>

          {/* ② 历史条（B35：横向滚动，对齐生图相册 HistoryStrip 模式；点按复制转写文本） */}
          {transcribeHistory.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                转写记录 ({transcribeHistory.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.audioHistoryStrip}>
                {transcribeHistory.map(h => (
                  <TouchableOpacity
                    key={h.taskId}
                    style={[
                      s.audioHistoryCard,
                      transcribeFocus?.taskId === h.taskId &&
                        s.audioHistoryCardActive,
                    ]}
                    onPress={() => setTranscribeFocusId(h.taskId)}
                    testID={`audio-history-transcribe-${h.taskId}`}>
                    <MicIcon
                      width={20}
                      height={20}
                      stroke={theme.colors.onSurfaceVariant}
                    />
                    <Text style={s.audioHistoryText} numberOfLines={2}>
                      {h.prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ③ 创作区：模型管理 + 录音转写 + 选文件转写 */}
          <View style={s.audioComposer}>
            <View style={s.audioModelRow}>
              <Text style={s.promptHint}>
                SenseVoice（中英日韩粤）
                {audioStore.asrState === 'ready'
                  ? ' · 已就绪'
                  : audioStore.asrState === 'downloading'
                    ? ` · 下载中 ${audioStore.asrProgress}%`
                    : audioStore.asrState === 'error'
                      ? ' · 下载失败'
                      : ' · 未下载'}
              </Text>
              {audioStore.asrState !== 'ready' && (
                <TouchableOpacity
                  style={[s.audioBtn, s.audioBtnModel]}
                  onPress={handleDownloadAsr}
                  disabled={audioStore.asrState === 'downloading'}
                  hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                  testID="audio-download-model">
                  <Text style={[s.audioBtnText, s.audioBtnTextModel]}>
                    {audioStore.asrState === 'downloading'
                      ? '下载中…'
                      : '下载模型'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[s.button, s.buttonGen, recording && s.buttonDanger]}
              onPress={handleRecordToggle}
              disabled={audioStore.transcribing}
              testID="audio-record">
              <Text style={s.buttonText}>
                {recording
                  ? '■ 停止并转写'
                  : audioStore.transcribing
                    ? '转写中…'
                    : '录音转写'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              onPress={handlePickAndTranscribe}
              disabled={audioStore.transcribing}
              testID="audio-pick">
              <Text style={s.buttonText}>
                {audioStore.transcribing ? '转写中…' : '选择音频文件转写'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          {/* ① 结果区（B36：整卡三态——running 波浪进度 / success 产物卡 / failed 报错页） */}
          <View style={s.audioResult}>
            {audioStore.ttsGenerating ? (
              <View style={s.audioResultStage}>
                <View style={s.genDotsRow}>
                  <WaveDots
                    active={dotsActive}
                    size={10}
                    gap={8}
                    translateY={8}
                  />
                </View>
                <Text style={s.genOverlayTitle}>正在生成音频…</Text>
                <Text style={s.overlayText}>
                  {audioStore.ttsStage || '准备中…'} ·{' '}
                  {Math.max(0, Math.round((now - (opStartedAt ?? now)) / 1000))}
                  s
                </Text>
                {/* v1.11：跑分面板（复用生图 PerfPanel——任务流统一跑分；
                    perfRecorder 由 beginTask 统一触发，TTS 任务同样采样） */}
                <PerfPanel />
              </View>
            ) : ttsFocus?.status === 'failed' ? (
              <View style={s.audioResultStage}>
                <AlertTriangleMdIcon
                  width={34}
                  height={34}
                  stroke={theme.colors.danger}
                />
                <Text style={s.failedTitle}>生成失败</Text>
                <Text style={s.failedSummary} numberOfLines={3}>
                  {ttsFocus.errorSummary ?? '未知错误'}
                </Text>
                <View style={s.failedBtns}>
                  <TouchableOpacity
                    style={s.failedBtn}
                    onPress={() => handleCopyError(ttsFocus)}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-copy-error">
                    <Text style={s.failedBtnText}>复制报错信息</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => handleTtsRetry(ttsFocus)}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                    testID="audio-retry-tts">
                    <Text style={s.failedBtnGhostText}>重试</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => imageGenStore.deleteTask(ttsFocus.taskId)}
                    hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}>
                    <Text style={s.failedBtnGhostText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : ttsFocus ? (
              <>
                {/* B38：播放器预览窗口（方形大卡，对齐生图预览窗口规格） */}
                <View style={s.audioPlayerCard}>
                  <View style={s.audioPlayerCenter}>
                    <TouchableOpacity
                      style={s.audioPlayBig}
                      onPress={() => handlePlay(ttsFocus.uri)}
                      testID="audio-play-big">
                      {audioStore.playingUri === ttsFocus.uri &&
                      audioStore.isPlaying ? (
                        <PauseIcon width={26} height={26} stroke="#ffffff" />
                      ) : (
                        <PlayIcon width={26} height={26} stroke="#ffffff" />
                      )}
                    </TouchableOpacity>
                    <Text style={s.audioPlayerTitle} numberOfLines={2}>
                      {ttsFocus.prompt}
                    </Text>
                    <Text style={s.audioPlayerMeta}>
                      {ttsFocus.modelLabel} ·{' '}
                      {fmtDur(
                        audioStore.playingUri === ttsFocus.uri &&
                          audioStore.playDuration > 0
                          ? audioStore.playDuration
                          : (ttsFocus.durationMs ?? 0),
                      )}
                    </Text>
                  </View>
                  {/* v1.10：波形条（读 wav PCM 40 柱；播放进度高亮，未播 outline） */}
                  <WaveformBars
                    uri={ttsFocus.uri}
                    playPosition={
                      audioStore.playingUri === ttsFocus.uri
                        ? audioStore.playPosition
                        : 0
                    }
                    duration={
                      audioStore.playingUri === ttsFocus.uri &&
                      audioStore.playDuration > 0
                        ? audioStore.playDuration
                        : (ttsFocus.durationMs ?? 0)
                    }
                    isPlaying={
                      audioStore.playingUri === ttsFocus.uri &&
                      audioStore.isPlaying
                    }
                  />
                  {/* 时间轴：拖动跳播（B38） */}
                  <View style={s.audioTimeline}>
                    <Slider
                      style={s.audioSlider}
                      minimumValue={0}
                      maximumValue={Math.max(
                        audioStore.playingUri === ttsFocus.uri &&
                          audioStore.playDuration > 0
                          ? audioStore.playDuration
                          : (ttsFocus.durationMs ?? 0),
                        1,
                      )}
                      value={Math.min(
                        audioStore.playingUri === ttsFocus.uri
                          ? audioStore.playPosition
                          : 0,
                        Math.max(
                          audioStore.playingUri === ttsFocus.uri &&
                            audioStore.playDuration > 0
                            ? audioStore.playDuration
                            : (ttsFocus.durationMs ?? 0),
                          1,
                        ),
                      )}
                      onSlidingComplete={v => audioStore.seekTo(Math.round(v))}
                      minimumTrackTintColor={theme.colors.primary}
                      maximumTrackTintColor={theme.colors.outlineVariant}
                      thumbTintColor={theme.colors.primary}
                    />
                    <View style={s.audioTimeRow}>
                      <Text style={s.audioTimeText}>
                        {fmtDur(
                          audioStore.playingUri === ttsFocus.uri
                            ? audioStore.playPosition
                            : 0,
                        )}
                      </Text>
                      <Text style={s.audioTimeText}>
                        {fmtDur(
                          audioStore.playingUri === ttsFocus.uri &&
                            audioStore.playDuration > 0
                            ? audioStore.playDuration
                            : (ttsFocus.durationMs ?? 0),
                        )}
                      </Text>
                    </View>
                  </View>
                  <View style={s.audioResultBtns}>
                    {/* B33：重生成（用产物 prompt 复跑当前引擎/音色，对齐生图页「再次生成」语义） */}
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnWarn]}
                      onPress={() => handleGenerate(ttsFocus.prompt)}
                      disabled={audioStore.ttsGenerating}
                      hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                      testID="audio-regen">
                      <Text style={[s.audioBtnText, s.audioBtnTextWarn]}>
                        重生成
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnShare]}
                      onPress={() => handleShare(ttsFocus.uri)}
                      hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                      testID="audio-share">
                      <Text style={[s.audioBtnText, s.audioBtnTextShare]}>
                        分享
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnDelete]}
                      onPress={() => {
                        if (audioStore.playingUri === ttsFocus.uri) {
                          audioStore.stopPlayback();
                        }
                        imageGenStore.deleteTask(ttsFocus.taskId);
                      }}
                      hitSlop={{top: 10, bottom: 10, left: 4, right: 4}}
                      testID="audio-delete">
                      <Text style={[s.audioBtnText, s.audioBtnTextDelete]}>
                        删除
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <Text style={s.audioStage}>
                暂无音频产物，输入文本后点生成音频
              </Text>
            )}
          </View>

          {/* ② 历史条（B35：横向滚动，对齐生图相册 HistoryStrip 模式；点按播放产物） */}
          {ttsHistory.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>音频产物 ({ttsHistory.length})</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.audioHistoryStrip}>
                {ttsHistory.map(h => (
                  <TouchableOpacity
                    key={h.taskId}
                    style={[
                      s.audioHistoryCard,
                      ttsFocus?.taskId === h.taskId && s.audioHistoryCardActive,
                    ]}
                    onPress={() => setTtsFocusId(h.taskId)}
                    testID={`audio-history-tts-${h.taskId}`}>
                    {audioStore.playingUri === h.uri && audioStore.isPlaying ? (
                      <PauseIcon
                        width={20}
                        height={20}
                        stroke={theme.colors.onSurfaceVariant}
                      />
                    ) : (
                      <HeadphonesMdIcon
                        width={20}
                        height={20}
                        stroke={theme.colors.onSurfaceVariant}
                      />
                    )}
                    <Text style={s.audioHistoryText} numberOfLines={2}>
                      {h.prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ③ 创作区：文本 + 高级参数 + 模型管理 */}
          <View style={s.audioComposer}>
            <TextInput
              style={[s.input, s.audioGenInput]}
              value={audioStore.genText}
              onChangeText={v => audioStore.setGenText(v)}
              placeholder="输入要生成音频的文本…"
              multiline
            />
            <TouchableOpacity
              style={s.advancedToggle}
              onPress={() => setShowAdvanced(v => !v)}
              hitSlop={{top: 10, bottom: 10}}
              testID="audio-advanced-toggle">
              <Text style={s.advancedToggleText}>
                {showAdvanced ? '高级参数 ▴' : '高级参数 ▾'}
              </Text>
            </TouchableOpacity>
            {showAdvanced ? (
              <View style={s.advancedBox}>
                {/* 音色（B35：引擎选择已移顶栏胶囊，高级参数只留生成参数；
                    B38c：Kokoro 接入中文音色后共 24 个——slice(0,10) 会截掉末尾中文音色，
                    改为按语言分组渲染，中文组在前，英文 22 chip 由 flexWrap 换行承载） */}
                <Text style={s.promptHint}>音色</Text>
                {[
                  {
                    label: '中文',
                    voices: genVoices.filter(v => v.language === 'zh'),
                  },
                  {
                    label: '英文',
                    voices: genVoices.filter(v => v.language !== 'zh'),
                  },
                ]
                  .filter(g => g.voices.length > 0)
                  .map(group => (
                    <View key={group.label} style={s.audioVoiceRow}>
                      {group.voices.map(v => (
                        <TouchableOpacity
                          key={v.id}
                          style={[
                            s.audioVoiceChip,
                            audioStore.voiceId === v.id &&
                              s.audioVoiceChipActive,
                          ]}
                          onPress={() => audioStore.setVoiceId(v.id)}
                          hitSlop={{top: 10, bottom: 10}}>
                          <Text
                            style={[
                              s.audioVoiceText,
                              audioStore.voiceId === v.id &&
                                s.audioVoiceTextActive,
                            ]}>
                            {v.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                {/* 语速 */}
                <View style={s.ttsSliderRow}>
                  <Text style={s.promptHint}>语速</Text>
                  <Text style={s.ttsSliderValue}>
                    {audioStore.speed.toFixed(1)}×
                  </Text>
                </View>
                <InputSlider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={audioStore.speed}
                  onValueChange={v => audioStore.setSpeed(v)}
                />
                {/* Supertonic 专属：步数（语种由 sherpa-onnx 自动检测，na 语义） */}
                {audioStore.genEngine === 'supertonic' ? (
                  <>
                    <Text style={s.promptHint}>步数</Text>
                    <View style={s.audioVoiceRow}>
                      {[1, 2, 3, 5, 10, 20].map(st => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            s.audioVoiceChip,
                            audioStore.supertonicSteps === st &&
                              s.audioVoiceChipActive,
                          ]}
                          onPress={() => audioStore.setSupertonicSteps(st)}
                          hitSlop={{top: 10, bottom: 10}}>
                          <Text
                            style={[
                              s.audioVoiceText,
                              audioStore.supertonicSteps === st &&
                                s.audioVoiceTextActive,
                            ]}>
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
});
