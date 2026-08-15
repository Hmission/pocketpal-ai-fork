/**
 * chatImageTask — 聊天内联生图任务 runner（豆包式闭环的核心执行器）
 *
 * 双入口（单链路，调度/再来一张/重试共用）：
 *   runInlineImageTask(prompt)：纯执行——DreamLite 单通道出图→返回 {uri, error}
 *   runImageTaskCard(prompt)：插任务卡片→执行→回写卡片（图片/失败+重试标记）
 *
 * 模型裁定（大王 2026-08）：聊天闭环只走 DreamLite（端侧唯一跑通模型，
 * 4 步 DMD2 蒸馏，默认 1024×1024）。旧 SD manifest 选模（available[0]=SD3.5）
 * 已删除——实验性模型不进聊天闭环，锋利不赌。
 *
 * 锋利原则：不跳转页面、不静默失败；加载/出图全程在聊天窗口可见。
 */
import {imageGenStore} from '../store/imageGenStore';
import {chatSessionStore} from '../store';
import {promptWriter} from './promptWriter';
import {assistant} from '../utils/chat';
import {MessageType} from '../utils/types';

export interface InlineImageResult {
  uri: string | null;
  error: string | null;
  /** 管家增强后的英文 SD 提示词（未增强/失败为 null，供任务卡「管家优化为」展示） */
  enhanced: string | null;
}

export async function runInlineImageTask(
  prompt: string,
): Promise<InlineImageResult> {
  // 0. 提示词增强：管家模型就绪时，把中文描述扩写成英文 SD 提示词（提质）。
  //    失败/未就绪不阻断出图，回退原始 prompt；enhanced 带回供卡片展示（决策可见）。
  let sdPrompt = prompt;
  let enhanced: string | null = null;
  try {
    if (promptWriter.isLoaded) {
      const out = await promptWriter.writePrompt(prompt);
      if (out) {
        sdPrompt = out;
        enhanced = out;
      }
    }
  } catch {
    // 增强失败静默回退
  }

  // 1. DreamLite 单通道：内部确保引擎加载（engineMutex 互斥），
  //    驻留时秒级出图；进度写 imageGenStore 单状态机 → ActiveTaskBanner。
  const uri = await imageGenStore.generateDreamLiteEntry(
    1024,
    1024,
    4,
    sdPrompt,
  );
  if (!uri) {
    return {uri: null, error: imageGenStore.error ?? '出图失败', enhanced: null};
  }
  return {uri, error: null, enhanced};
}

/**
 * runImageTaskCard — 任务卡片闭环（单链路：scheduler 首次触发 / 「再来一张」/
 * 失败卡「重试」共用）：插卡片→出图→回写卡片。
 *   成功：imageUris=[uri]，metadata.imagePrompt 留作再生成/编辑锚点
 *   失败：文本卡片 + metadata.imageTaskFailed（渲染侧出「重试」动作）
 * 引擎驻留语义：出图后不卸载（engineMutex 仅在 chat 加载时挤占），
 * 复用路径（再来一张/重试）命中已加载引擎时秒级出图。
 */
export async function runImageTaskCard(prompt: string): Promise<void> {
  // 聊天内联生图进行中：顶部横幅让位于卡片内嵌动效（ImageTaskProgress），
  // finally 复位（含失败/异常路径），其余引擎任务仍走横幅。
  imageGenStore.setChatInlineGenerating(true);
  try {
    // 决策可见（v2.1）：占位卡文案分步——识别意图 → 管家优化提示词 → 出图（动效由 ImageTaskProgress）。
    const cardMsg = {
      id: `imgtask-${Date.now()}`,
      author: assistant,
      createdAt: Date.now(),
      text: `🎨 已识别为生图任务，管家优化提示词中…`,
      type: 'text',
      metadata: {imageTask: true, imagePrompt: prompt, modelName: '生图引擎'},
    } as MessageType.Text;
    await chatSessionStore.addMessageToCurrentSession(cardMsg);
    const sessionId = chatSessionStore.activeSessionId;
    if (!sessionId) {
      return;
    }
    // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
    const cardId = chatSessionStore.currentSessionMessages[0]?.id ?? cardMsg.id;

    const result = await runInlineImageTask(prompt);
    if (result.uri) {
      // 管家增强提示词写入 metadata（与原文不同才写），渲染侧小字展示「管家优化为」
      const metadata =
        result.enhanced && result.enhanced !== prompt
          ? {imageEnhancedPrompt: result.enhanced}
          : {};
      await chatSessionStore.updateMessage(cardId, sessionId, {
        text: `🎨 已为你生成：${prompt}`,
        imageUris: [result.uri],
        metadata,
      });
    } else {
      await chatSessionStore.updateMessage(cardId, sessionId, {
        text: `⚠️ 生图未完成：${result.error ?? '未知错误'}`,
        metadata: {imageTaskFailed: true},
      });
    }
  } finally {
    imageGenStore.setChatInlineGenerating(false);
  }
}

/**
 * runInlineEditTask — 纯执行：聊天内图片编辑（P5 豆包式闭环）。
 * 解码源图 → DreamLite 编辑单通道（VAE Encoder 编码源图为条件，中文指令直用——
 * diptych 语义文本条件，不经过管家英文扩写）。
 */
async function runInlineEditTask(
  sourceUri: string,
  instruction: string,
): Promise<InlineImageResult> {
  const sq = 1024; // DreamLite 编辑输出 1024×1024（生图页同款）
  try {
    const rgb = await imageGenStore.decodeEditImage(
      sourceUri.replace('file://', ''),
      sq,
    );
    const uri = await imageGenStore.editDreamLiteEntry(rgb, sq, sq, 4, instruction);
    if (!uri) {
      return {uri: null, error: imageGenStore.error ?? '编辑失败', enhanced: null};
    }
    return {uri, error: null, enhanced: null};
  } catch (e) {
    return {uri: null, error: (e as Error)?.message ?? '编辑失败', enhanced: null};
  }
}

/**
 * runEditImageTaskCard — 聊天内编辑任务卡闭环（P5，单链路：
 * scheduler 编辑分支 / 编辑结果卡「继续编辑」/ 失败卡「重试」共用）：
 * 插编辑任务卡（editTask）→ 编码源图→编辑→回写结果。
 *   成功：imageUris=[uri]，metadata.editSourceUri/editInstruction 留作继续编辑锚点
 *   失败：文本卡片 + metadata.editTaskFailed（渲染侧出「重试」动作）
 */
export async function runEditImageTaskCard(
  sourceUri: string,
  instruction: string,
): Promise<void> {
  imageGenStore.setChatInlineGenerating(true);
  try {
    const cardMsg = {
      id: `edittask-${Date.now()}`,
      author: assistant,
      createdAt: Date.now(),
      text: `🖼️ 已识别为编辑任务，编码源图中…`,
      type: 'text',
      metadata: {
        editTask: true,
        editSourceUri: sourceUri,
        editInstruction: instruction,
        modelName: '生图引擎',
      },
    } as MessageType.Text;
    await chatSessionStore.addMessageToCurrentSession(cardMsg);
    const sessionId = chatSessionStore.activeSessionId;
    if (!sessionId) {
      return;
    }
    const cardId = chatSessionStore.currentSessionMessages[0]?.id ?? cardMsg.id;

    const result = await runInlineEditTask(sourceUri, instruction);
    if (result.uri) {
      await chatSessionStore.updateMessage(cardId, sessionId, {
        text: `🖼️ 已为你编辑：${instruction}`,
        imageUris: [result.uri],
        metadata: {
          editTask: true,
          editSourceUri: sourceUri,
          editInstruction: instruction,
        },
      });
    } else {
      await chatSessionStore.updateMessage(cardId, sessionId, {
        text: `⚠️ 编辑未完成：${result.error ?? '未知错误'}`,
        metadata: {
          editTask: true,
          editTaskFailed: true,
          editSourceUri: sourceUri,
          editInstruction: instruction,
        },
      });
    }
  } finally {
    imageGenStore.setChatInlineGenerating(false);
  }
}
