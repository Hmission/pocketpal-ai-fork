import * as React from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';
import {launchImageLibrary} from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';

import {audioStore} from '../../../store/audioStore';
import {imageGenStore} from '../../../store/imageGenStore';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {Voice} from '../../../services/tts';
import {chatSessionStore} from '../../../store';

type AudioSeg = 'transcribe' | 'speak';

/**
 * AudioWorkshopTab — 创作工坊「音频工坊」tab（AUDIO_UI_SPEC v1）
 *
 * 次级分段：转写（ASR，任务化入画廊 kind='transcribe'）／朗读（TTS，复用 TTSStore）。
 * 三区结构（对齐生图 tab）：① 结果区 ② 历史区（转写记录横条）③ 创作区。
 * 锋利：ASR 原生引擎就绪前转写显式失败（Snackbar 提示），不静默。
 */
export const AudioWorkshopTab: React.FC<{
  onSnackbar: (msg: string) => void;
}> = observer(({onSnackbar}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [seg, setSeg] = React.useState<AudioSeg>('transcribe');
  const [speakText, setSpeakText] = React.useState('');
  const [voices, setVoices] = React.useState<Voice[]>([]);
  const [voiceId, setVoiceId] = React.useState<string | null>(null);

  // 转写历史（kind='transcribe'，与生图/反推同画廊统一管理）
  const transcribeHistory = React.useMemo(
    () =>
      imageGenStore.history.filter(
        h => h.kind === 'transcribe' && h.status === 'success',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageGenStore.history.length],
  );

  React.useEffect(() => {
    audioStore.refreshAsrState();
    audioStore
      .loadVoices()
      .then(list => {
        setVoices(list);
        if (list.length > 0 && !voiceId) {
          setVoiceId(list[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 选音频文件 → 转写任务化 */
  const handlePickAndTranscribe = async () => {
    const res = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
    });
    const p = res.assets?.[0]?.uri;
    if (!p) {
      return;
    }
    if (audioStore.asrState !== 'ready') {
      onSnackbar('语音模型未下载，请先下载 SenseVoice');
      return;
    }
    const text = await audioStore.transcribeTask(p);
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

  const selectedVoice =
    voices.find(v => v.id === voiceId) ?? voices[0] ?? null;

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
          style={[s.audioSeg, seg === 'speak' && s.audioSegActive]}
          onPress={() => setSeg('speak')}
          testID="audio-seg-speak">
          <Text
            style={[s.audioSegText, seg === 'speak' && s.audioSegTextActive]}>
            朗读
          </Text>
        </TouchableOpacity>
      </View>

      {seg === 'transcribe' ? (
        <>
          {/* ① 结果区：最近转写结果 */}
          <View style={s.audioResult}>
            {audioStore.transcribing ? (
              <Text style={s.audioStage}>{audioStore.transcribeStage}</Text>
            ) : transcribeHistory[0] ? (
              <>
                <Text style={s.captionCardTitle}>📝 转写结果</Text>
                <Text style={s.captionCardBody} numberOfLines={6}>
                  {transcribeHistory[0].prompt}
                </Text>
                <View style={s.audioResultBtns}>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnCopy]}
                    onPress={() => {
                      Clipboard.setString(transcribeHistory[0].prompt);
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
                        text: transcribeHistory[0].prompt,
                        type: 'text',
                      } as any);
                      onSnackbar('已发送到聊天');
                    }}
                    testID="audio-send-chat">
                    <Text style={s.audioBtnText}>发送到聊天</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={s.audioStage}>暂无转写记录</Text>
            )}
          </View>

          {/* ② 历史区：转写记录横条 */}
          <View style={s.audioStrip}>
            {transcribeHistory.slice(0, 8).map(h => (
              <View key={h.taskId} style={s.audioStripItem}>
                <Text style={s.audioStripText} numberOfLines={1}>
                  🎙 {h.prompt}
                </Text>
              </View>
            ))}
          </View>

          {/* ③ 创作区：模型管理 + 选文件转写 */}
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
          {/* ① 结果区：朗读状态 */}
          <View style={s.audioResult}>
            {audioStore.speakingText ? (
              <>
                <Text style={s.captionCardTitle}>🔊 正在朗读</Text>
                <Text style={s.captionCardBody} numberOfLines={4}>
                  {audioStore.speakingText}
                </Text>
                <View style={s.audioResultBtns}>
                  <TouchableOpacity
                    style={[s.audioBtn, s.audioBtnDelete]}
                    onPress={() => audioStore.stopSpeak()}
                    testID="audio-stop">
                    <Text style={s.audioBtnText}>停止</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={s.audioStage}>
                {audioStore.isTTSAvailable ? '输入文本开始朗读' : 'TTS 不可用（内存或设置）'}
              </Text>
            )}
          </View>

          {/* ③ 创作区：文本 + 语音选择 + 朗读 */}
          <View style={s.audioComposer}>
            <TextInput
              style={s.input}
              value={speakText}
              onChangeText={setSpeakText}
              placeholder="输入要朗读的文本…"
              multiline
            />
            <Text style={s.promptHint}>语音（已安装引擎）</Text>
            <View style={s.audioVoiceRow}>
              {voices.length === 0 ? (
                <Text style={s.audioStage}>无已安装语音（模型页/设置下载 TTS 引擎）</Text>
              ) : (
                voices.map(v => (
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
                ))
              )}
            </View>
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              onPress={() => {
                if (selectedVoice) {
                  audioStore.speak(speakText, selectedVoice).catch(() => {});
                } else {
                  onSnackbar('请先安装 TTS 引擎并选择语音');
                }
              }}
              disabled={!speakText.trim() || !audioStore.isTTSAvailable}
              testID="audio-speak">
              <Text style={s.buttonText}>朗读</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
});
