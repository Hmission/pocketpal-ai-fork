import {StyleSheet} from 'react-native';

import {withOpacity} from '../../utils/colorUtils';

export const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    // D1：预览区顶着顶栏，去顶部 padding；左右/下保留
    content: {paddingHorizontal: 16, paddingBottom: 16, gap: 12},
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.card],
      padding: 12,
      gap: 10,
    },
    cardTitle: {
      ...theme.typography.titleS,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    hint: {...theme.typography.captionM, color: theme.colors.onSurfaceVariant},
    modelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    modelChipText: {
      flex: 1,
      ...theme.typography.uiM,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    // 胶囊内文本区（点击展开下拉）
    modelChipMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    modelChipStatus: {...theme.typography.uiS, color: theme.colors.primary},
    // 模型胶囊内快速加载按钮（未加载时显示，不展开下拉）
    chipLoadBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
    },
    chipLoadText: {
      ...theme.typography.uiS,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    // v4.2 顶部横幅 overlay：压预览区顶部（白卡实底保证图片上可读），不挡底部按钮
    bannerWrap: {
      position: 'absolute',
      top: 458,
      left: 16,
      right: 16,
      zIndex: 5,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.m,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 2},
    },
    dropPanel: {
      marginTop: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.surface],
      padding: 12,
      gap: 8,
      // 锚定下拉：盖在后续内容之上
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 4},
    },
    modelRow: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },
    modelRowMain: {flex: 1, paddingRight: 8},
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    modelName: {...theme.typography.uiM, color: theme.colors.onSurface},
    modelNote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    // 行内加载/卸载按钮（操作就近，状态可见；卸载需二次确认）
    rowActionBtn: {
      minWidth: 56,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    rowActionBtnUnload: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    rowActionText: {
      ...theme.typography.uiS,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    rowActionTextUnload: {color: theme.colors.danger},
    resultWrap: {position: 'relative'},
    preview: {width: '100%', aspectRatio: 1, borderRadius: theme.radius.s},
    // 0 页编辑槽：上传大按钮 / 待编辑图预览 + 重新上传
    editSlot: {
      aspectRatio: 1,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    editSlotImg: {width: '100%', height: '100%', borderRadius: theme.radius.s},
    uploadBig: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.m,
      paddingHorizontal: 32,
      paddingVertical: 28,
    },
    uploadBigIcon: {
      fontSize: 40,
      color: theme.colors.primary,
      fontWeight: '300',
    },
    uploadBigText: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    uploadBigHint: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    uploadFab: {
      position: 'absolute',
      bottom: 10,
      backgroundColor: withOpacity(theme.colors.info, 0.9),
      borderRadius: theme.radius.s,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    uploadFabText: {
      ...theme.typography.uiS,
      color: theme.colors.onInfo,
      fontWeight: '600',
    },
    genOverlay: {
      ...StyleSheet.absoluteFillObject,
      // 浅色圆角（与卡片设计语言统一；助手气泡点缀色 + 95% 不透明）：出图盖住预览区
      backgroundColor: theme.colors.assistantBubbleBackground + 'F2',
      borderRadius: theme.radius.s,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
    },
    genOverlayEdit: {
      // 编辑态：更低不透明度，底图可见
      backgroundColor: theme.colors.assistantBubbleBackground + 'A6',
    },
    // 三点波浪动效容器/圆点
    genDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 32,
    },
    genDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius[theme.shapeRoles.circle],
      backgroundColor: theme.colors.primary,
    },
    genOverlayTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginTop: 4,
    },
    overlayText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    overlayStage: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    // 任务化预览页（running 空白进度页 / failed 报错页）：与图片页同规格方形容器
    // padding 16→10：跑分面板（PerfPanel）向预览图宽度靠拢「稍微宽一些」，
    // 仍不超出预览卡片宽度（面板 = pageW-20 < 预览图 pageW）。
    taskPage: {
      aspectRatio: 1,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
      gap: 8,
      overflow: 'hidden',
    },
    failedTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    failedSummary: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    failedBtns: {flexDirection: 'row', gap: 8, marginTop: 8},
    failedBtn: {
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.primary,
    },
    failedBtnText: {
      ...theme.typography.uiS,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    failedBtnGhost: {
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.s,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    failedBtnGhostText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
    },
    actionRow: {flexDirection: 'row', gap: 8},
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
    },
    actionText: {...theme.typography.uiS, color: theme.colors.onSurface},
    // 语义彩色点缀（DESIGN_SPEC §1.3：bg/onX 成对使用）
    actionSave: {backgroundColor: theme.colors.success},
    actionTextOnSuccess: {
      ...theme.typography.uiS,
      color: theme.colors.onSuccess,
      fontWeight: '600',
    },
    actionEdit: {backgroundColor: theme.colors.info},
    actionTextOnInfo: {
      ...theme.typography.uiS,
      color: theme.colors.onInfo,
      fontWeight: '600',
    },
    actionReuse: {backgroundColor: theme.colors.warning},
    actionTextOnWarning: {
      ...theme.typography.uiS,
      color: theme.colors.onWarning,
      fontWeight: '600',
    },
    actionDelete: {backgroundColor: theme.colors.danger},
    actionTextOnDanger: {
      ...theme.typography.uiS,
      color: theme.colors.onDanger,
      fontWeight: '600',
    },
    // 反推紫 #6a1b9a（v4 登记，IMAGEGEN_UI_SPEC §2；与族徽章紫 #8e24aa 区分）
    actionCaption: {backgroundColor: '#6a1b9a'},
    actionTextOnCaption: {
      ...theme.typography.uiS,
      color: '#ffffff',
      fontWeight: '600',
    },
    // 反推结果卡（v4，IMAGEGEN_UI_SPEC §7.2）
    // v5 产物区整卡切换：反推提示词全卡（占满结果区，banner + 主体 + 操作行）
    captionFullPage: {
      aspectRatio: 1,
      padding: 16,
      justifyContent: 'space-between',
    },
    captionFullBody: {
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: 10,
    },
    captionCard: {
      margin: 10,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: 10,
    },
    captionCardTitle: {
      ...theme.typography.uiS,
      color: '#6a1b9a',
      fontWeight: '700',
    },
    captionCardBody: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurface,
      marginTop: 4,
    },
    captionCardHint: {
      ...theme.typography.captionS,
      color: theme.colors.outline,
      marginTop: 4,
      textAlign: 'right',
    },
    // 上传图反推 FAB（避开「重新上传」bottom 10 → 44）
    captionFab: {bottom: 44, backgroundColor: '#6a1b9a'},
    // ---- 音频工坊（AUDIO_UI_SPEC v1）----
    audioSegBar: {
      flexDirection: 'row',
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      paddingBottom: 8,
    },
    audioSeg: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: theme.radius[theme.shapeRoles.pill],
    },
    audioSegActive: {
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
    },
    audioSegText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
    },
    audioSegTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    audioResult: {
      padding: 10,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      gap: 6,
    },
    /** B36：结果区三态整卡（running 波浪 / failed 报错页居中布局，对齐生图 taskPage 语义） */
    audioResultStage: {
      minHeight: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    /** B36：历史卡选中态（结果区联动高亮，对齐生图相册缩略图选中语义） */
    audioHistoryCardActive: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    audioStage: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
    },
    audioResultBtns: {flexDirection: 'row', gap: 8, marginTop: 4},
    audioBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.radius.s,
      alignItems: 'center',
    },
    audioBtnCopy: {backgroundColor: theme.colors.success},
    audioBtnSend: {backgroundColor: theme.colors.info},
    audioBtnShare: {backgroundColor: theme.colors.info},
    audioBtnDelete: {backgroundColor: theme.colors.danger},
    audioBtnModel: {backgroundColor: theme.colors.primary},
    advancedToggle: {
      paddingVertical: 6,
      alignSelf: 'flex-start',
    },
    advancedToggleText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    advancedBox: {
      gap: 8,
      padding: 10,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    ttsSliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ttsSliderValue: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
    },
    audioBtnText: {
      ...theme.typography.uiS,
      color: '#ffffff',
      fontWeight: '600',
    },
    /** B35：音频历史横条（B38 方形卡：对齐生图相册 72px 方形缩略图，点击加载预览窗口） */
    audioHistoryStrip: {
      gap: 8,
      paddingVertical: 2,
    },
    audioHistoryCard: {
      width: 72,
      height: 72,
      padding: 6,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    audioHistoryIcon: {
      fontSize: 20,
    },
    audioHistoryText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      fontSize: 10,
    },
    audioComposer: {gap: 10},
    /** B33：生成输入框单行视觉；B38：默认两行（minHeight 66——怕用户找不到输入处） */
    audioGenInput: {minHeight: 66, maxHeight: 110},
    /** B38：播放器预览窗口（方形大卡，对齐生图预览窗口规格） */
    audioPlayerCard: {
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: 14,
      gap: 10,
      minHeight: 230,
      justifyContent: 'center',
    },
    audioPlayerCenter: {alignItems: 'center', gap: 8},
    audioPlayBig: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioPlayBigIcon: {
      fontSize: 26,
      color: '#ffffff',
      fontWeight: '700',
    },
    audioPlayerTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
      textAlign: 'center',
    },
    audioPlayerMeta: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    audioTimeline: {gap: 2},
    audioSlider: {width: '100%', height: 36},
    audioTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    audioTimeText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    audioModelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    audioVoiceRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    audioVoiceChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    audioVoiceChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: withOpacity(theme.colors.primary, 0.1),
    },
    audioVoiceText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
    },
    audioVoiceTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    // v5.1 工坊滑块按钮（IMAGEGEN_UI_SPEC §8）：单容器两段文字 + 高亮滑块（absolute 无动画）
    // 点未选中段 = 切换，点选中段 = 不动（防误触反复横跳）；比双胶囊窄约 1/3
    workshopSlider: {
      flexDirection: 'row',
      marginLeft: 8,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.primary, 0.08),
    },
    // 高亮滑块：absolute 跟随当前段（left 由 workshopTab 派生 0 | '50%'）
    workshopSliderThumb: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: '50%',
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
    },
    workshopSliderSeg: {
      // v5.3：再收窄至 36（原 48）——两字 24px（uiS）+ 左右总留白 12px（大王：留一个字符空间即可甚至不留）
      width: 36,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: theme.radius[theme.shapeRoles.pill],
    },
    workshopSliderText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
    },
    workshopSliderTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    // v5 顶栏一行：标题 + tab 胶囊（headerTitle 内）
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitleText: {
      ...theme.typography.titleS,
      color: theme.colors.onSurface,
      maxWidth: 96,
    },
    // v5.5 顶栏音频胶囊：与生图 triggerPill 同一设计语言（B38 消灭双胶囊风格）；就绪点内嵌保留
    audioHeaderDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.outlineVariant,
    },
    audioHeaderDotReady: {
      backgroundColor: theme.colors.success,
    },
    badgeSd3: {color: theme.colors.badgeSd35, fontWeight: '700'},
    badgeZ: {color: theme.colors.badgeZImage, fontWeight: '700'},
    badgeDream: {color: theme.colors.badgeDreamlite, fontWeight: '700'},
    badgeFlux: {color: theme.colors.badgeFlux, fontWeight: '700'},
    // 实验性徽章：警示色（模型可能不可用，与操作按钮橙区分）
    badgeExp: {
      color: theme.colors.warning,
      fontWeight: '700',
      ...theme.typography.captionS,
    },
    // D1 顶栏触发胶囊（挂在 IMAGE_GEN headerRight；生图域色 12% 透明底）
    // B5（DESIGN_SPEC §8 Gap Ledger）：headerRight 右缘对齐内容区右边距（16dp）
    // B8 形状纪律：加载按钮=动作 → 圆角矩形（与下方操作按钮同族），直角锚定右缘，
    // 消除双胶囊并排的视觉右伸感；模型选择器=选择器 → 保持胶囊。
    triggerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginRight: 16,
    },
    triggerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      // 与聊天顶栏模型胶囊同一设计语言：primary 12% 底 + 标准橙黄描边
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
      borderRadius: theme.radius.full,
      paddingVertical: 4,
      paddingHorizontal: 8,
      // v5.1：maxWidth 180→120（缩短 1/3）——模型名超长截断；flexShrink 让「加载」按钮永不收缩
      maxWidth: 120,
      flexShrink: 1,
      // 标准橙黄描边：与聊天顶栏模型胶囊同一处理
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    triggerText: {
      ...theme.typography.uiS,
      fontWeight: '600',
      color: theme.colors.onSurface,
      flexShrink: 1,
    },
    triggerArrow: {
      ...theme.typography.captionS,
      color: theme.colors.domain.imageGen,
    },
    triggerLoadBtn: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      // B8 形状纪律：动作=圆角矩形（radius.s），不再用胶囊
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      backgroundColor: theme.colors.primary,
      // v5.1：永不收缩（模型名超长时也不挤压加载按钮，大王红线）
      flexShrink: 0,
    },
    triggerLoadText: {
      ...theme.typography.captionS,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    dropOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 50,
      elevation: 50,
    },
    dropBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    dropPanelAbs: {
      position: 'absolute',
      // D1：overlay 起于 AppBar 下沿（overlayTop），面板紧随共后
      top: 6,
      left: 16,
      right: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.surface],
      padding: 12,
      gap: 8,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: {width: 0, height: 6},
    },
    // 信息条：预览图顶部胶囊（居中收窄 + 表面色半透明，弱化对预览的干扰）
    // 点击弹完整生图参数（提示词/耗时/尺寸/模型）——onInfoPress 由编排层接
    infoOverlayWrap: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    infoOverlay: {
      maxWidth: '88%',
      backgroundColor: theme.colors.surface + 'D9', // 表面色 85% 不透明（浅色弱化）
      borderRadius: theme.radius.full,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    infoOverlayText: {
      color: theme.colors.onSurfaceVariant,
      ...theme.typography.captionS,
    },
    // 参数详情弹窗（信息条点击）：提示词/耗时/尺寸/模型/种子/步数/时间
    // 渲染底座 OverlayCard（DESIGN_SPEC §12.1），本组样式仅保留内容行布局
    modalRow: {flexDirection: 'row', gap: 8},
    modalLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      width: 52,
    },
    modalValue: {
      ...theme.typography.captionM,
      color: theme.colors.onSurface,
      flex: 1,
    },
    modalPrompt: {
      ...theme.typography.captionM,
      color: theme.colors.onSurface,
      lineHeight: 18,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyHeaderActions: {flexDirection: 'row', alignItems: 'center', gap: 14},
    uploadText: {
      ...theme.typography.uiS,
      color: theme.colors.info,
      fontWeight: '600',
    },
    manageText: {...theme.typography.uiS, color: theme.colors.primary},
    historyItem: {marginRight: 8, position: 'relative'},
    historyThumb: {width: 72, height: 72, borderRadius: theme.radius.s},
    historyKindBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: withOpacity(theme.colors.info, 0.9),
      borderRadius: theme.radius.xs,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    historyKindText: {
      ...theme.typography.captionS,
      color: theme.colors.onInfo,
      fontWeight: '600',
    },
    historySel: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.radius.s,
      // 选中态压暗遮罩：backdrop token（遮罩语义统一）
      backgroundColor: theme.colors.backdrop,
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.s,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonRow: {flexDirection: 'row', gap: 10},
    // UpscalePanel 内容区（Sheet 载体自带背景/圆角，这里只留内边距与底部安全距）
    upscaleBody: {
      padding: 16,
      paddingBottom: 28,
    },
    // 复刻生图 Sheet（v4，IMAGEGEN_UI_SPEC §7.3）
    remakeBody: {
      padding: 16,
      paddingBottom: 28,
    },
    remakeInput: {
      flex: 1,
      minWidth: 48,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.s,
      paddingHorizontal: 8,
      paddingVertical: 6,
      color: theme.colors.onSurface,
      ...theme.typography.bodyS,
    },
    remakeInputFull: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.s,
      paddingHorizontal: 8,
      paddingVertical: 6,
      color: theme.colors.onSurface,
      ...theme.typography.bodyS,
    },
    paramRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    remakeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    remakeChipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: withOpacity(theme.colors.primary, 0.1),
    },
    remakeChipText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
    },
    remakeChipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    buttonEdit: {flex: 1, backgroundColor: theme.colors.info},
    buttonGen: {flex: 1},
    buttonSecondary: {backgroundColor: theme.colors.surface},
    buttonDanger: {backgroundColor: theme.colors.error},
    buttonDisabled: {backgroundColor: theme.colors.surface},
    buttonText: {
      color: theme.colors.onPrimary,
      ...theme.typography.uiM,
      fontWeight: '600',
    },
    buttonTextOnInfo: {color: theme.colors.onInfo},
    buttonTextOnDanger: {color: theme.colors.onError},
    error: {...theme.typography.uiS, color: theme.colors.error},
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      padding: 12,
      minHeight: 72,
      color: theme.colors.onSurface,
      textAlignVertical: 'top',
    },
    inputSmall: {minHeight: 44, padding: 8},
    advToggle: {...theme.typography.uiS, color: theme.colors.primary},
    promptHint: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    promptHintWarn: {...theme.typography.captionS, color: theme.colors.error},
    paramRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    paramLabel: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    paramInput: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      paddingHorizontal: 10,
      paddingVertical: 6,
      width: 60,
      color: theme.colors.onSurface,
    },
    sizeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
    },
    sizeBtnSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    sizeBtnText: {...theme.typography.uiS, color: theme.colors.onSurface},
    sizeBtnSub: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    statusPanel: {marginTop: 6, gap: 3},
    progressTrack: {
      height: 8,
      borderRadius: theme.radius.xs,
      backgroundColor: withOpacity(theme.colors.shadow, 0.08),
      overflow: 'hidden',
    },
    progressTrackW70: {width: '70%'},
    progressBarFill: {
      height: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.xs,
    },
    progressText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    stageText: {...theme.typography.captionS, color: theme.colors.primary},
    readyText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      marginTop: 4,
    },
    // ADR-0008 跑分式性能面板（IMAGEGEN_UI_SPEC §9）
    perfPanel: {
      marginTop: 10,
      alignSelf: 'stretch',
      backgroundColor: withOpacity(theme.colors.shadow, 0.05),
      borderRadius: theme.radius.m,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
    },
    perfHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    perfTitle: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600',
    },
    perfPssBig: {
      ...theme.typography.titleM,
      fontWeight: '700',
    },
    // v2 折叠头指标胶囊横排（CPU/GPU/温/功耗，安兔兔式实时指标行压缩形态）
    perfCapsuleRow: {
      flexDirection: 'row',
      gap: 4,
      flexShrink: 1,
    },
    perfCapsule: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    perfCapsuleText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfDeviceNote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
      marginTop: 2,
    },
    perfBody: {gap: 6, marginTop: 6},
    // v2 叠加线切换行：chips 横滑 + 右端峰值文字
    perfOverlayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    perfChipsScroll: {flexGrow: 0},
    perfOverlayChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginRight: 4,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    perfOverlayChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    perfOverlayChipText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfOverlayChipTextActive: {color: '#ffffff', fontWeight: '600'},
    perfPeak: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginLeft: 'auto',
    },
    // B39 图表容器：折线渐变面积图 / B40 多层叠加，加高到 88pt 利用预览卡纵向余量（真机验不溢出）
    perfMiniChart: {
      height: 88,
      overflow: 'hidden',
    },
    perfChartEmpty: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    // v3 指标行：自适应换行（全部指标 + 历史入口可见，不再横向滚动被裁切）。
    // 卡片加宽后（见 taskPage padding 收窄）每行可容纳 4 项，8 项折 2 行，
    // 根治「最底下一行显示不全」。
    perfMetricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 4,
    },
    perfMetric: {
      gap: 1,
      width: 62,
    },
    perfMetricLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfMetricValue: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    perfHistoryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'center',
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
    },
    perfHistoryBtnText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    // v2 回放 Modal（PerfHistoryModal）
    perfModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    perfModalCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.radius.l,
      borderTopRightRadius: theme.radius.l,
      padding: 16,
      maxHeight: '82%',
      gap: 10,
    },
    perfModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    perfModalBackBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    perfModalBackText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    perfModalTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
      flexShrink: 1,
    },
    perfModalEmpty: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: 20,
    },
    perfSessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    perfSessionTitle: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
      fontWeight: '600',
      flexShrink: 1,
    },
    perfSessionMeta: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfReplayBody: {gap: 10},
    perfReplayCursorRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    perfReplayPss: {
      ...theme.typography.titleL,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    perfReplayCursorMeta: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfReplayChart: {
      height: 120,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 1,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    perfReplayBar: {width: 2, borderRadius: 1},
    perfPlayBtn: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
    },
    perfPlayBtnText: {
      ...theme.typography.uiS,
      color: '#ffffff',
      fontWeight: '600',
    },
    perfStatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    perfStatCell: {
      flexBasis: '30%',
      gap: 2,
      padding: 8,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.onSurface, 0.04),
    },
    perfStatCellLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfStatCellValue: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '700',
    },
    // 跑分卡：左侧总分圆 + 右侧分项（Geekbench 式）
    perfScoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 12,
      borderRadius: theme.radius.m,
      backgroundColor: withOpacity(theme.colors.primary, 0.08),
    },
    perfScoreTotal: {alignItems: 'center', gap: 2},
    perfScoreTotalNum: {
      ...theme.typography.displayM,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    perfScoreTotalLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfScoreItems: {gap: 3, flexShrink: 1},
    perfScoreItem: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
    },
  });
