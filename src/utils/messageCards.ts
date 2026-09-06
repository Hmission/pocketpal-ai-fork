import type {MessageType} from './types';

/**
 * 消息卡 metadata 标记名的**唯一清单**（PHONE_SPEC §14.1 / CHAT_UI_SPEC）。
 *
 * 为什么要有这个文件：这些标记名此前在两处各自枚举——`PhoneCallOverlay` 的
 * 非对话卡黑名单与 `ChatScreen` 的任务卡动作槽判定。并列声明的必然结局是
 * 新增卡类型时漏改一处（2026-09-05 真机已为此付过一次代价：任务占位卡被
 * 当成「伙伴说的话」铺进通话字幕）。
 *
 * ⚠ 但**两处消费的语义并不相同**，所以这里收敛的是「标记名」，不是「一个集合」：
 * - 字幕过滤要的是**所有**非对话卡（含 system / captionTask）；
 * - 动作槽要的是**可操作的**任务卡（imageTask / editTask / taskError），
 *   把 system 卡算进去就会给系统提示长出一个「再来一张」按钮。
 * 因此下面的判定函数各自显式组合，不提供「通用的一份数组」让人误用。
 */
export const CARD_METADATA_KEYS = [
  'system',
  'imageTask',
  'imageTaskFailed',
  'editTask',
  'editTaskFailed',
  'captionTask',
  'captionTaskFailed',
  'taskError',
] as const;

export type CardMetadataKey = (typeof CARD_METADATA_KEYS)[number];

/** 标记名 → 是否落卡（false 与缺失同等对待，与写入方 `?? false` 对齐）。 */
const hasFlag = (
  meta: Record<string, unknown> | undefined,
  key: CardMetadataKey,
): boolean => meta?.[key] != null && meta[key] !== false;

/**
 * 非对话卡：通话字幕不显示。
 * **`butler` 故意不在此列**——管家直答卡会被原地回写成真正回复文本，
 * 那是伙伴说的话（PHONE_SPEC §14.1 真机补修结论）。
 */
export const isNonDialogueCard = (m: MessageType.Any): boolean =>
  CARD_METADATA_KEYS.some(k =>
    hasFlag(m.metadata as Record<string, unknown> | undefined, k),
  );

/** 有动作槽的任务卡（生图 / 编辑）：不含 system、captionTask、taskError。 */
export const isTaskActionCard = (m: MessageType.Any): boolean => {
  const meta = m.metadata as Record<string, unknown> | undefined;
  return hasFlag(meta, 'imageTask') || hasFlag(meta, 'editTask');
};

/** 调度错误卡（重试入口）。 */
export const isTaskErrorCard = (m: MessageType.Any): boolean =>
  hasFlag(m.metadata as Record<string, unknown> | undefined, 'taskError');

/**
 * 生成中占位卡：任务卡且既未回写失败标记、也未回写图片 → 内嵌生成动效，
 * 不显示动作条（回写成功后才出「再来一张 / 编辑图片」）。
 */
export const isGeneratingTaskCard = (m: MessageType.Any): boolean => {
  if (!isTaskActionCard(m)) {
    return false;
  }
  const meta = m.metadata as Record<string, unknown> | undefined;
  if (hasFlag(meta, 'imageTaskFailed') || hasFlag(meta, 'editTaskFailed')) {
    return false;
  }
  const imageUris = (m as {imageUris?: string[]}).imageUris;
  return !(imageUris && imageUris.length > 0);
};
