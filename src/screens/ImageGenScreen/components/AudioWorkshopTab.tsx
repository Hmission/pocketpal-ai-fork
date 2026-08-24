import * as React from 'react';
import {
  Animated,
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
import {SUPERTONIC_VOICES, KOKORO_VOICES, KITTEN_VOICES} from '../../../services/tts';

import {audioStore} from '../../../store/audioStore';
import {imageGenStore, GeneratedImage} from '../../../store/imageGenStore';
import {ttsStore} from '../../../store/TTSStore';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {Voice} from '../../../services/tts';
import {chatSessionStore} from '../../../store';
import {InputSlider} from '../../../components/InputSlider';
import {useWaveDots} from '../hooks/useWaveDots';
import {AlertTriangleMdIcon} from '../../../assets/icons';
import {copyAndSaveErrorReport} from '../../../utils/errorReport';

type AudioSeg = 'transcribe' | 'generate';

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
}> = observer(({onSnackbar}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [seg, setSeg] = React.useState<AudioSeg>('transcribe');
  const [genText, setGenText] = React.useState('');
  const [voiceId, setVoiceId] = React.useState<string | null>(null);
  const [speed, setSpeed] = React.useState(1.0);
  const [supertonicSteps, setSupertonicSteps] = React.useState(5);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  /** B33：录音转写进行中（录音按钮态） */
  const [recording, setRecording] = React.useState(false);
  /** B35：转写结果卡展开收起（对齐生图反推卡 captionExpanded 交互） */
  const [transcribeExpanded, setTranscribeExpanded] = React.useState(false);
  /** B36：结果区焦点条目（默认最新；历史条点按切换，对齐生图相册翻页联动） */
  const [transcribeFocusId, setTranscribeFocusId] = React.useState<string | null>(null);
  const [ttsFocusId, setTtsFocusId] = React.useState<string | null>(null);
  /** B36：running 进度卡累计秒数 */
  const [now, setNow] = React.useState(Date.now());
  const [opStartedAt, setOpStartedAt] = React.useState<number | null>(null);

  // B36：三点波浪动效（running 整卡，与生图页同设计语言；JS driver 合规）
  const waveDots = useWaveDots(audioStore.transcribing || audioStore.ttsGenerating);

  // B38：播放器进度轮询（500ms 驱动时间轴；播完自动复位）
  React.useEffect(() => {
    if (!audioStore.isPlaying) {
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
  }, [audioStore.isPlaying]);

  // 转写历史（kind='transcribe' success，历史条 + 结果区 success 页）
  const transcribeHistory = React.useMemo(
    () =>
      imageGenStore.history.filter(
        h => h.kind === 'transcribe' && h.status === 'success',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageGenStore.history.length],
  );

  // 生成历史（kind='tts' success）
  const ttsHistory = React.useMemo(
    () =>
      imageGenStore.history.filter(
        h => h.kind === 'tts' && h.status === 'success',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageGenStore.history.length],
  );

  // B36：本段全部任务（含 failed，结果区三态页数据源；历史条只列 success）
  const transcribeTasks = React.useMemo(
    () => imageGenStore.history.filter(h => h.kind === 'transcribe'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageGenStore.history.length],
  );
  const ttsTasks = React.useMemo(
    () => imageGenStore.history.filter(h => h.kind === 'tts'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageGenStore.history.length],
  );

  /** 结果区焦点（fallback 最新任务；删除/新任务自动归位） */
  const transcribeFocus =
    transcribeTasks.find(t => t.taskId === transcribeFocusId) ??
    transcribeTasks[0] ??
    null;
  const ttsFocus =
    ttsTasks.find(t => t.taskId === ttsFocusId) ?? ttsTasks[0] ?? null;

  // 新任务产生 → 焦点重置最新
  React.useEffect(() => {
    setTranscribeFocusId(null);
  }, [transcribeTasks[0]?.taskId]);
  React.useEffect(() => {
    setTtsFocusId(null);
  }, [ttsTasks[0]?.taskId]);

  // running 期间 1s 时钟（进度卡累计秒数）
  React.useEffect(() => {
    if (!audioStore.transcribing && !audioStore.ttsGenerating) {
      setOpStartedAt(null);
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [audioStore.transcribing, audioStore.ttsGenerating]);

  React.useEffect(() => {
    audioStore.refreshAsrState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 当前引擎音色清单（kokoro/supertonic/kitten 常量目录；引擎选择在顶栏 B35） */
  const genVoices = React.useMemo(() => {
    if (audioStore.genEngine === 'kokoro') {
      return KOKORO_VOICES;
    }
    if (audioStore.genEngine === 'supertonic') {
      return SUPERTONIC_VOICES;
    }
    return KITTEN_VOICES;
  }, [audioStore.genEngine]);

  React.useEffect(() => {
    if (!voiceId || !genVoices.some(v => v.id === voiceId)) {
      setVoiceId(genVoices[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStore.genEngine]);

  const selectedVoice = genVoices.find(v => v.id === voiceId) ?? null;

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
  const handleGenerate = async (text: string = genText) => {
    if (!text.trim()) {
      onSnackbar('请输入要生成的文本', 'warning');
      return;
    }
    if (!selectedVoice) {
      onSnackbar('请先选择音色', 'warning');
      return;
    }
    const out = await audioStore.generateTask(audioStore.genEngine, text, selectedVoice, {
      speed,
      numSteps: supertonicSteps,
    });
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
    setGenText(item.prompt);
    handleGenerate(item.prompt);
  };

  /** 播放/暂停切换（B38：播放器状态机在 audioStore，预览窗口与历史卡共享） */
  const handlePlay = (uri: string) => audioStore.togglePlay(uri);

  /** 时长格式化（ms → m:ss） */
  const fmtDur = (ms: number): string => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  /** 分享产物文件 */
  const handleShare = async (uri: string) => {
    try {
      await Share.open({url: `file://${uri}`});
    } catch {
      // 用户取消分享
    }
  };

  const genInstalled = ttsStore.kokoroDownloadState === 'ready';
  const supInstalled = ttsStore.supertonicDownloadState === 'ready';
  const kittenInstalled = ttsStore.kittenDownloadState === 'ready';

  return (
    <View style={s.card}>
      {/* 次级分段（复用 KnowledgeScreen tabBar 样式语义） */}
      <View style={s.audioSegBar}>
        <TouchableOpacity
          style={[s.audioSeg, seg === 'transcribe' && s.audioSegActive]}
          onPress={() => setSeg('transcribe')}
          testID="audio-seg-transcribe">
          <Text
            style={[
              s.audioSegText,
              seg === 'transcribe' && s.audioSegTextActive,
            ]}>
            转写
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.audioSeg, seg === 'generate' && s.audioSegActive]}
          onPress={() => setSeg('generate')}
          testID="audio-seg-generate">
          <Text
            style={[s.audioSegText, seg === 'generate' && s.audioSegTextActive]}>
            生成
          </Text>
        </TouchableOpacity>
      </View>

      {seg === 'transcribe' ? (
        <>
          {/* ① 结果区（B36：整卡三态——running 波浪进度 / success 全文卡 / failed 报错页） */}
          <View style={s.audioResult}>
            {audioStore.transcribing ? (
              <View style={s.audioResultStage}>
                <View style={s.genDotsRow}>
                  {waveDots.map((d, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        s.genDot,
                        {
                          transform: [
                            {
                              translateY: d.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -8],
                              }),
                            },
                          ],
                          opacity: d.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.45, 1],
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={s.genOverlayTitle}>正在转写…</Text>
                <Text style={s.overlayText}>
                  {audioStore.transcribeStage || '准备中…'} ·{' '}
                  {Math.max(0, Math.round((now - (opStartedAt ?? now)) / 1000))}s
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
                    testID="audio-copy-error">
                    <Text style={s.failedBtnText}>复制报错信息</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => handleTranscribeRetry(transcribeFocus)}
                    testID="audio-retry-transcribe">
                    <Text style={s.failedBtnGhostText}>重试</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => imageGenStore.deleteTask(transcribeFocus.taskId)}>
                    <Text style={s.failedBtnGhostText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : transcribeFocus ? (
              <>
                <Text style={s.captionCardTitle}>📝 转写结果</Text>
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
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnCopy]}
                    onPress={() => {
                      Clipboard.setString(transcribeFocus.prompt);
                      onSnackbar('已复制');
                    }}
                    testID="audio-copy">
                    <Text style={s.audioBtnText}>复制</Text>
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
                    testID="audio-send-chat">
                    <Text style={s.audioBtnText}>发送到聊天</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnDelete]}
                    onPress={() => imageGenStore.deleteTask(transcribeFocus.taskId)}
                    testID="audio-delete-transcribe">
                    <Text style={s.audioBtnText}>删除</Text>
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
                    <Text style={s.audioHistoryIcon}>🎙</Text>
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
                  testID="audio-download-model">
                  <Text style={s.audioBtnText}>
                    {audioStore.asrState === 'downloading' ? '下载中…' : '下载模型'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[
                s.button,
                s.buttonGen,
                recording && s.buttonDanger,
              ]}
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
                  {waveDots.map((d, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        s.genDot,
                        {
                          transform: [
                            {
                              translateY: d.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -8],
                              }),
                            },
                          ],
                          opacity: d.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.45, 1],
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={s.genOverlayTitle}>正在生成音频…</Text>
                <Text style={s.overlayText}>
                  {audioStore.ttsStage || '准备中…'} ·{' '}
                  {Math.max(0, Math.round((now - (opStartedAt ?? now)) / 1000))}s
                </Text>
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
                    testID="audio-copy-error">
                    <Text style={s.failedBtnText}>复制报错信息</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => handleTtsRetry(ttsFocus)}
                    testID="audio-retry-tts">
                    <Text style={s.failedBtnGhostText}>重试</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.failedBtnGhost}
                    onPress={() => imageGenStore.deleteTask(ttsFocus.taskId)}>
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
                      <Text style={s.audioPlayBigIcon}>
                        {audioStore.playingUri === ttsFocus.uri &&
                        audioStore.isPlaying
                          ? '⏸'
                          : '▶'}
                      </Text>
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
                          : ttsFocus.durationMs ?? 0,
                      )}
                    </Text>
                  </View>
                  {/* 时间轴：拖动跳播（B38） */}
                  <View style={s.audioTimeline}>
                    <Slider
                      style={s.audioSlider}
                      minimumValue={0}
                      maximumValue={Math.max(
                        audioStore.playingUri === ttsFocus.uri &&
                          audioStore.playDuration > 0
                          ? audioStore.playDuration
                          : ttsFocus.durationMs ?? 0,
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
                            : ttsFocus.durationMs ?? 0,
                          1,
                        ),
                      )}
                      onSlidingComplete={v =>
                        audioStore.seekTo(Math.round(v))
                      }
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
                            : ttsFocus.durationMs ?? 0,
                        )}
                      </Text>
                    </View>
                  </View>
                  <View style={s.audioResultBtns}>
                    {/* B33：重生成（用产物 prompt 复跑当前引擎/音色，对齐生图页「再次生成」语义） */}
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnShare]}
                      onPress={() => handleGenerate(ttsFocus.prompt)}
                      disabled={audioStore.ttsGenerating}
                      testID="audio-regen">
                      <Text style={s.audioBtnText}>重生成</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnShare]}
                      onPress={() => handleShare(ttsFocus.uri)}
                      testID="audio-share">
                      <Text style={s.audioBtnText}>分享</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.audioBtn, s.audioBtnDelete]}
                      onPress={() => {
                        if (audioStore.playingUri === ttsFocus.uri) {
                          audioStore.stopPlayback();
                        }
                        imageGenStore.deleteTask(ttsFocus.taskId);
                      }}
                      testID="audio-delete">
                      <Text style={s.audioBtnText}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <Text style={s.audioStage}>暂无音频产物，输入文本后点生成音频</Text>
            )}
          </View>

          {/* ② 历史条（B35：横向滚动，对齐生图相册 HistoryStrip 模式；点按播放产物） */}
          {ttsHistory.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                音频产物 ({ttsHistory.length})
              </Text>
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
                    <Text style={s.audioHistoryIcon}>
                      {audioStore.playingUri === h.uri && audioStore.isPlaying
                        ? '⏸'
                        : '🎵'}
                    </Text>
                    <Text style={s.audioHistoryText} numberOfLines={2}>
                      {h.prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ③ 创作区：文本 + 高级参数 + 模型管理 + 生成 */}
          <View style={s.audioComposer}>
            <TextInput
              style={[s.input, s.audioGenInput]}
              value={genText}
              onChangeText={setGenText}
              placeholder="输入要生成音频的文本…"
              multiline
            />
            <TouchableOpacity
              style={s.advancedToggle}
              onPress={() => setShowAdvanced(v => !v)}
              testID="audio-advanced-toggle">
              <Text style={s.advancedToggleText}>
                {showAdvanced ? '高级参数 ▴' : '高级参数 ▾'}
              </Text>
            </TouchableOpacity>
            {showAdvanced ? (
              <View style={s.advancedBox}>
                {/* 音色（B35：引擎选择已移顶栏胶囊，高级参数只留生成参数） */}
                <Text style={s.promptHint}>音色</Text>
                <View style={s.audioVoiceRow}>
                  {genVoices.slice(0, 10).map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        s.audioVoiceChip,
                        voiceId === v.id && s.audioVoiceChipActive,
                      ]}
                      onPress={() => setVoiceId(v.id)}>
                      <Text
                        style={[
                          s.audioVoiceText,
                          voiceId === v.id && s.audioVoiceTextActive,
                        ]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* 语速 */}
                <View style={s.ttsSliderRow}>
                  <Text style={s.promptHint}>语速</Text>
                  <Text style={s.ttsSliderValue}>{speed.toFixed(1)}×</Text>
                </View>
                <InputSlider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={speed}
                  onValueChange={setSpeed}
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
                            supertonicSteps === st && s.audioVoiceChipActive,
                          ]}
                          onPress={() => setSupertonicSteps(st)}>
                          <Text
                            style={[
                              s.audioVoiceText,
                              supertonicSteps === st && s.audioVoiceTextActive,
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
            {/* B36：模型管理行已并入顶栏下拉（引擎状态/下载/删除在顶栏胶囊内） */}
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              onPress={() => handleGenerate()}
              disabled={
                audioStore.ttsGenerating ||
                !genText.trim() ||
                !selectedVoice ||
                (audioStore.genEngine === 'kokoro'
                  ? !genInstalled
                  : audioStore.genEngine === 'supertonic'
                    ? !supInstalled
                    : !kittenInstalled)
              }
              testID="audio-generate">
              <Text style={s.buttonText}>
                {audioStore.ttsGenerating ? '生成中…' : '生成音频'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
});
