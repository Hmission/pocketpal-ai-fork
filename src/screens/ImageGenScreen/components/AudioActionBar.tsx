/**
 * AudioActionBar — 音频工坊底部吸底操作条（2026-08-30 大王裁定：生成按钮吸底常驻）
 *
 * 生图页「出图」按钮吸底裁定（2026-08-26）平移：音频生成段主操作「生成音频」
 * 按钮常驻页面底部——键盘弹出随 KeyboardStickyView 上移（同聊天输入条设计语言）。
 * store 驱动：audioStore 与 AudioWorkshopTab 共享（audioSeg/genText/voiceId/speed/
 * supertonicSteps/ttsGenerating），仅 generate 段渲染（转写段主操作在 composer 不吸底）。
 * 8-29 真机根因沿用：primary 底转圈须 onPrimary（同色相融不可见）。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';

import {CircularActivityIndicator} from '../../../components/CircularActivityIndicator';
import {audioStore} from '../../../store/audioStore';
import {ttsStore} from '../../../store/TTSStore';
import {
  KITTEN_VOICES,
  KOKORO_VOICES,
  SUPERTONIC_VOICES,
} from '../../../services/tts';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';

export const AudioActionBar: React.FC<{
  onSnackbar: (msg: string, variant?: 'info' | 'warning' | 'error') => void;
}> = observer(({onSnackbar}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  // 仅生成段渲染（转写段主操作在 composer，不吸底）
  // observer 本地读：audioSeg 是 observable 属性，切换经 observer 重渲染
  const seg = audioStore.audioSeg;
  if (seg !== 'generate') {
    return null;
  }

  // 引擎/音色派生（与 AudioWorkshopTab 同源同构）
  const genEngine = audioStore.genEngine;
  const genVoices =
    genEngine === 'kokoro'
      ? KOKORO_VOICES
      : genEngine === 'supertonic'
        ? SUPERTONIC_VOICES
        : KITTEN_VOICES;
  const selectedVoice =
    genVoices.find(v => v.id === audioStore.voiceId) ?? null;
  const engineReady =
    genEngine === 'kokoro'
      ? ttsStore.kokoroDownloadState === 'ready'
      : genEngine === 'supertonic'
        ? ttsStore.supertonicDownloadState === 'ready'
        : ttsStore.kittenDownloadState === 'ready';

  const busy = audioStore.ttsGenerating;
  const canGen = !!audioStore.genText.trim() && !!selectedVoice && engineReady;

  const onGenerate = async () => {
    // 兜底校验（防 disabled 竞态；与 AudioWorkshopTab handleGenerate 同语义）
    if (!audioStore.genText.trim()) {
      onSnackbar('请输入要生成的文本', 'warning');
      return;
    }
    if (!selectedVoice) {
      onSnackbar('请先选择音色', 'warning');
      return;
    }
    const out = await audioStore.generateTask(
      genEngine,
      audioStore.genText,
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

  return (
    <View style={s.bottomBar} testID="audio-action-bar">
      {/* 8-30 底部裁切修复：按钮体量/渲染树与生图出图按钮同构（buttonRow 行容器
          + buttonGenMain 内衬），避免单按钮直挂 bar 时触区缩水沉入底部手势区 */}
      <View style={s.buttonRow}>
        <TouchableOpacity
          style={[
            s.button,
            s.buttonGen,
            s.buttonGenMain,
            (busy || !canGen) && s.buttonDisabled,
          ]}
          disabled={busy || !canGen}
          testID="audio-generate"
          onPress={() => onGenerate().catch(() => {})}>
          {busy ? (
            <CircularActivityIndicator
              size={theme.iconSize.m}
              color={theme.colors.onPrimary}
            />
          ) : (
            <Text style={[s.buttonText, s.buttonTextGen]}>生成音频</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});
