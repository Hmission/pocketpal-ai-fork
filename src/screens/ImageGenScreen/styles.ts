import {StyleSheet} from 'react-native';

import {withOpacity} from '../../utils/colorUtils';

export const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    // D1：预览区顶着顶栏，去顶部 padding；左右/下保留
    content: {
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.m,
      gap: theme.spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.card],
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    cardTitle: {
      ...theme.typography.titleS,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    // 2026-08-26 提示词卡折叠头：单行（标签 + 摘要 + token 计数），出图按钮一屏可见
    collapseHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    collapseHeadLabel: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    collapseHeadSummary: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    // 2026-08-26 底部吸底操作条（GenActionBar）：surface 实底 + hairline 顶分隔
    //（同聊天输入条设计语言；paddingBottom 安全区由编排层动态补）
    bottomBar: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.s,
      paddingBottom: theme.spacing.s,
    },
    hint: {...theme.typography.captionM, color: theme.colors.onSurfaceVariant},
    modelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
      gap: theme.spacing.s,
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
      gap: theme.spacing.s,
    },
    modelChipStatus: {...theme.typography.uiS, color: theme.colors.primary},
    // 模型胶囊内快速加载按钮（未加载时显示，不展开下拉）
    chipLoadBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
    },
    chipLoadText: {
      ...theme.typography.uiS,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    // v4.3 预览卡片顶部横幅 overlay：叠在图区顶部（只压预览卡片，不压历史区/创作区）；
    // 无瓷底——BannerBar 自身语义色 wash 透出（大王裁定：不要灰色底）
    bannerOverlay: {
      position: 'absolute',
      top: theme.spacing.s,
      left: theme.spacing.s,
      right: theme.spacing.s,
      zIndex: 10,
      borderRadius: theme.radius.m,
      overflow: 'hidden',
      elevation: 4,
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 2},
    },
    // 信息条被横幅顶下：横幅显示期间不与其重叠（B58：spacing 表达式 = banner 高 40 + 边距 12）
    infoOverlayPushed: {top: theme.spacing.xxl + theme.spacing.sm},
    dropPanel: {
      marginTop: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.surface],
      padding: theme.spacing.sm,
      gap: theme.spacing.s,
      // 锚定下拉：盖在后续内容之上
      elevation: 8,
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 4},
    },
    modelRow: {
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.sm,
      // 与浮层面板（dropPanelAbs）同圆角：选中描边视觉与整卡一致（2026-08-26 大王）
      borderRadius: theme.radius[theme.shapeRoles.surface],
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },
    modelRowMain: {flex: 1, paddingRight: theme.spacing.s},
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    // 本机不可用行：全行灰置（叠加在 modelRow 上）
    modelRowIncompat: {opacity: 0.45},
    modelName: {...theme.typography.uiM, color: theme.colors.onSurface},
    modelNote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
    // 行内加载/卸载按钮（操作就近，状态可见；卸载需二次确认）
    rowActionBtn: {
      minWidth: 56,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
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
      gap: theme.spacing.s,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.m,
      paddingHorizontal: theme.spacing.xl,
      // R5 裁定：28 → l+xs（24+4=28 等值表达式，spacing 表内语义化）
      paddingVertical: theme.spacing.l + theme.spacing.xs,
    },
    uploadBigIcon: {
      // B56③ 豁免：40 为「+」字形尺寸（icon 非文本排版），不入 typography 档（同 audioPlayBigIcon 26 字形）
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
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    uploadFabText: {
      ...theme.typography.uiS,
      color: theme.colors.onInfo,
      fontWeight: '600',
    },
    // B57：三点波浪容器保留（AudioWorkshopTab 包 ui/WaveDots）；
    // genDot 单点样式随迁删除（圆点渲染归一组件）
    genDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      height: 32,
    },
    genOverlayTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginTop: theme.spacing.xs,
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
    // 2026-08-26 容器自适应（根治顶部被切）：去 overflow hidden + 顶对齐 + minHeight 保底——
    // PerfPanel 默认展开（v1.2 裁定）时内容超高不再双向裁切，自然向下生长。
    taskPage: {
      aspectRatio: 1,
      minHeight: 240,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      // 内容顶部对齐（原 center：超高时上下对称裁剪 → 顶部 WaveDots/标题被切）
      justifyContent: 'flex-start',
      // 紧凑族（perfPanel/audioHistoryCard 同语）：6→xs
      padding: theme.spacing.xs,
      gap: theme.spacing.s,
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
    failedBtns: {
      flexDirection: 'row',
      gap: theme.spacing.s,
      marginTop: theme.spacing.s,
    },
    failedBtn: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
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
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
      borderRadius: theme.radius.s,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    failedBtnGhostText: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
    },
    actionRow: {flexDirection: 'row', gap: theme.spacing.s},
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.s,
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
    // 反推紫（IMAGEGEN_UI_SPEC §2；B56③ 登记为 theme.colors.imageInsight）
    actionCaption: {backgroundColor: theme.colors.imageInsight},
    actionTextOnCaption: {
      ...theme.typography.uiS,
      // 紫底白字：反推紫底上的恒定白前景（深浅模式均白，§12.6 豁免）
      color: '#ffffff',
      fontWeight: '600',
    },
    // 反推结果卡（v4，IMAGEGEN_UI_SPEC §7.2）
    // v5 产物区整卡切换：反推提示词全卡（占满结果区，banner + 主体 + 操作行）
    captionFullPage: {
      aspectRatio: 1,
      padding: theme.spacing.m,
      justifyContent: 'space-between',
    },
    captionFullBody: {
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: theme.spacing.sm,
    },
    captionCard: {
      margin: theme.spacing.sm,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: theme.spacing.sm,
    },
    captionCardTitle: {
      ...theme.typography.uiS,
      // 反推紫（B56③ 已登记 theme.colors.imageInsight）
      color: theme.colors.imageInsight,
      fontWeight: '700',
    },
    captionCardBody: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurface,
      marginTop: theme.spacing.xs,
    },
    captionCardHint: {
      ...theme.typography.captionS,
      color: theme.colors.outline,
      marginTop: theme.spacing.xs,
      textAlign: 'right',
    },
    // 上传图反推 FAB（避开「重新上传」bottom 10 → B58：spacing 表达式 40+4=44）
    // 反推紫已登记 theme.colors.imageInsight（B56③）
    captionFab: {
      bottom: theme.spacing.xxl + theme.spacing.xs,
      backgroundColor: theme.colors.imageInsight,
    },
    // ---- 音频工坊（AUDIO_UI_SPEC v1）----
    audioSegBar: {
      flexDirection: 'row',
      gap: theme.spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      paddingBottom: theme.spacing.s,
    },
    audioSeg: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
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
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      gap: theme.spacing.s,
    },
    /** B36：结果区三态整卡（running 波浪 / failed 报错页居中布局，对齐生图 taskPage 语义） */
    audioResultStage: {
      minHeight: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.s,
      paddingVertical: theme.spacing.sm,
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
    audioResultBtns: {
      flexDirection: 'row',
      gap: theme.spacing.s,
      marginTop: theme.spacing.xs,
    },
    audioBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      alignItems: 'center',
    },
    audioBtnCopy: {backgroundColor: theme.colors.success},
    audioBtnSend: {backgroundColor: theme.colors.info},
    audioBtnShare: {backgroundColor: theme.colors.info},
    audioBtnDelete: {backgroundColor: theme.colors.danger},
    audioBtnModel: {backgroundColor: theme.colors.primary},
    advancedToggle: {
      paddingVertical: theme.spacing.xs,
      alignSelf: 'flex-start',
    },
    advancedToggleText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    advancedBox: {
      gap: theme.spacing.s,
      padding: theme.spacing.sm,
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
      // 多彩色底（success/info/danger/primary）共用白字：无单一 onX token 可映射
      // （onPrimary 为深棕）——B56②登记评审，保持字面量
      color: '#ffffff',
      fontWeight: '600',
    },
    /** B35：音频历史横条（B38 方形卡：对齐生图相册 72px 方形缩略图，点击加载预览窗口） */
    audioHistoryStrip: {
      gap: theme.spacing.s,
      paddingVertical: theme.spacing.xxs,
    },
    audioHistoryCard: {
      width: 72,
      height: 72,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xxs,
    },
    audioHistoryIcon: {
      fontSize: 20,
    },
    audioHistoryText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    // B56②：10→sm(12)（区块内 gap）
    audioComposer: {gap: theme.spacing.sm},
    /** B33：生成输入框单行视觉；B38：默认两行（minHeight 66——怕用户找不到输入处） */
    audioGenInput: {minHeight: 66, maxHeight: 110},
    /** B38：播放器预览窗口（方形大卡，对齐生图预览窗口规格） */
    audioPlayerCard: {
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      padding: theme.spacing.m,
      gap: theme.spacing.sm,
      minHeight: 230,
      justifyContent: 'center',
    },
    audioPlayerCenter: {alignItems: 'center', gap: theme.spacing.s},
    audioPlayBig: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioPlayBigIcon: {
      fontSize: 26,
      // primary 底 icon：现状白字（onPrimary 为深棕字）——B56②登记评审，保持字面量
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
    audioTimeline: {gap: theme.spacing.xxs},
    audioSlider: {width: '100%', height: theme.size.controlHeight},
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
      gap: theme.spacing.s,
    },
    audioVoiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    audioVoiceChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
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
      marginLeft: theme.spacing.s,
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
    // audio 段态：滑块右移至 +50%（叠加在 workshopSliderThumb 上）
    workshopSliderThumbAudio: {
      left: '50%',
    },
    workshopSliderSeg: {
      // v5.3：再收窄至 36（原 48）——两字 24px（uiS）+ 左右总留白 12px（大王：留一个字符空间即可甚至不留）
      width: 36,
      paddingVertical: theme.spacing.xs,
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
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.outlineVariant,
    },
    audioHeaderDotReady: {
      backgroundColor: theme.colors.success,
    },
    badgeSd3: {color: theme.colors.badgeSd35, fontWeight: '700'},
    badgeZ: {color: theme.colors.badgeZImage, fontWeight: '700'},
    badgeDream: {color: theme.colors.badgeDreamlite, fontWeight: '700'},
    badgeFlux: {color: theme.colors.badgeFlux, fontWeight: '700'},
    badgeKrea2: {color: theme.colors.badgeKrea2, fontWeight: '700'},
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
      gap: theme.spacing.s,
      marginRight: theme.spacing.m,
    },
    triggerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      // 与聊天顶栏模型胶囊同一设计语言：primary 12% 底 + 标准橙黄描边
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
      borderRadius: theme.radius.full,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
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
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
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
      // B56②：下拉遮罩 rgba(0,0,0,0.25) 与 scrim 完全等值 → token
      backgroundColor: theme.colors.scrim,
    },
    dropPanelAbs: {
      position: 'absolute',
      // D1：overlay 起于 AppBar 下沿（overlayTop），面板紧随共后
      top: 6,
      left: theme.spacing.m,
      right: theme.spacing.m,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius[theme.shapeRoles.surface],
      padding: theme.spacing.sm,
      gap: theme.spacing.s,
      elevation: 12,
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: {width: 0, height: 6},
    },
    // 信息条：预览图顶部胶囊（居中收窄 + 表面色半透明，弱化对预览的干扰）
    // 点击弹完整生图参数（提示词/耗时/尺寸/模型）——onInfoPress 由编排层接
    infoOverlayWrap: {
      position: 'absolute',
      top: theme.spacing.s,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    infoOverlay: {
      maxWidth: '88%',
      backgroundColor: theme.colors.surface + 'D9', // 表面色 85% 不透明（浅色弱化）
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    infoOverlayText: {
      color: theme.colors.onSurfaceVariant,
      ...theme.typography.captionS,
    },
    // 参数详情弹窗（信息条点击）：提示词/耗时/尺寸/模型/种子/步数/时间
    // 渲染底座 OverlayCard（DESIGN_SPEC §12.1），本组样式仅保留内容行布局
    modalRow: {flexDirection: 'row', gap: theme.spacing.s},
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
    historyItem: {marginRight: theme.spacing.s, position: 'relative'},
    historyThumb: {width: 72, height: 72, borderRadius: theme.radius.s},
    historyKindBadge: {
      position: 'absolute',
      bottom: theme.spacing.xxs,
      right: theme.spacing.xxs,
      backgroundColor: withOpacity(theme.colors.info, 0.9),
      borderRadius: theme.radius.xs,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
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
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
    },
    buttonRow: {flexDirection: 'row', gap: 10},
    // UpscalePanel 内容区（Sheet 载体自带背景/圆角，这里只留内边距与底部安全距）
    upscaleBody: {
      padding: theme.spacing.m,
      paddingBottom: 28,
    },
    // 复刻生图 Sheet（v4，IMAGEGEN_UI_SPEC §7.3）
    remakeBody: {
      padding: theme.spacing.m,
      paddingBottom: 28,
    },
    remakeInput: {
      flex: 1,
      minWidth: 48,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.s,
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
      color: theme.colors.onSurface,
      ...theme.typography.bodyS,
    },
    remakeInputFull: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.s,
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
      color: theme.colors.onSurface,
      ...theme.typography.bodyS,
    },
    paramRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
      marginBottom: theme.spacing.sm,
    },
    remakeChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
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
    // 任务购物车 D1-A：出图按钮切两半（左 ➕ 入队 + 右出图），行内子段拆分
    buttonGenSplit: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 0,
      overflow: 'hidden',
    },
    buttonGenPlus: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 3,
      minWidth: 64,
      paddingHorizontal: 8,
      borderRightWidth: 1,
      borderRightColor: 'rgba(255,255,255,0.35)',
    },
    // 8-27 队列按钮文本标签（大王：只有 + 号用户不懂语义）——随段 opacity 统一淡化
    buttonGenPlusLabel: {
      color: theme.colors.onPrimary,
      ...theme.typography.uiS,
      fontWeight: '600' as const,
    },
    buttonGenMain: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
    // ➕ 上角入队总数微标（队列面板入口提示）
    buttonGenBadge: {
      position: 'absolute',
      top: 2,
      right: 3,
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: 4,
      overflow: 'hidden',
    },
    buttonTextGen: {color: theme.colors.onPrimary},
    // 队列胶囊条（面板入口，2026-08-27 实机验收增补：连点加抽不弹面板后
    // 用户经 🛒 胶囊查看/管理队列）
    queueCapsule: {
      alignSelf: 'flex-start',
      marginBottom: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
    },
    queueCapsuleText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    buttonSecondary: {backgroundColor: theme.colors.surface},
    buttonDanger: {backgroundColor: theme.colors.error},
    // 8-27 修订：禁用态改半透明主色（opacity 0.45）——旧实现 backgroundColor=surface
    // 与吸底栏同色导致按钮「漂白隐形」（白钮白字白底栏）；半透明保留主色轮廓，
    // 即大王原话「出图按钮灰掉」，文字随整段统一淡化。
    buttonDisabled: {opacity: 0.45},
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
      padding: theme.spacing.sm,
      minHeight: 72,
      color: theme.colors.onSurface,
      textAlignVertical: 'top',
    },
    inputSmall: {minHeight: theme.size.minTapTarget, padding: theme.spacing.s},
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
      gap: theme.spacing.sm,
    },
    paramLabel: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    paramInput: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      width: 60,
      color: theme.colors.onSurface,
    },
    sizeBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
    },
    sizeBtnSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    sizeBtnText: {...theme.typography.uiS, color: theme.colors.onSurface},
    sizeBtnSub: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
    statusPanel: {marginTop: theme.spacing.xs, gap: theme.spacing.xs},
    progressTrackW70: {width: '70%'},
    progressText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
    stageText: {...theme.typography.captionS, color: theme.colors.primary},
    readyText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      marginTop: theme.spacing.xs,
    },
    // ADR-0008 跑分式性能面板（IMAGEGEN_UI_SPEC §9）
    // v4：弃灰色底面板（大王：不想要灰色面板）——去 backgroundColor，
    // 改 hairline 顶部细线分隔（与聊天页指标行同一分隔语言），面板透明融入预览卡。
    perfPanel: {
      alignSelf: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      paddingHorizontal: theme.spacing.s,
      // 紧凑族（taskPage/audioHistoryCard 同语）：6→xs
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xxs,
      gap: theme.spacing.xs,
    },
    perfHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    perfTitle: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600',
    },
    perfPssBig: {
      ...theme.typography.titleS,
      fontWeight: '700',
    },
    // v2 折叠头指标胶囊横排（CPU/GPU/温/功耗，安兔兔式实时指标行压缩形态）
    perfCapsuleRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      flexShrink: 1,
    },
    perfCapsule: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    perfCapsuleText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    perfBody: {gap: theme.spacing.xs, marginTop: theme.spacing.xs},
    // v2 叠加线切换行：chips 横滑 + 右端峰值文字
    perfOverlayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    perfChipsScroll: {flexGrow: 0},
    perfOverlayChip: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      marginRight: theme.spacing.xs,
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
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    // primary 底 chip 白字（onPrimary 为深棕字）——B56②登记评审，保持字面量
    perfOverlayChipTextActive: {color: '#ffffff', fontWeight: '600'},
    perfPeak: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginLeft: 'auto',
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    // B43 图例行（叠全时）：色点 + 通道名横排一行，图表可读性（紫色线=功耗等）
    perfLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing.s,
      paddingVertical: theme.spacing.xxs,
    },
    perfLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    perfLegendDot: {
      width: 6,
      height: 6,
      // 6×6 正圆点：radius 3 半值 → full（B56②）
      borderRadius: theme.radius.full,
    },
    perfLegendText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
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
    // 卡片加宽（taskPage padding 6）+ 字号收紧（10/11pt）后每行可容纳 5 项，
    // 8 项 + 历史按钮折 2 行，根治「最底下一行显示不全」。
    perfMetricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    perfMetric: {
      gap: theme.spacing.xxs,
      width: 58,
    },
    perfMetricLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    perfMetricValue: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
      fontWeight: '600',
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    perfHistoryBtn: {
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
      alignSelf: 'center',
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
    },
    perfHistoryBtnText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
    // B41：回放 Modal 样式随 PerfHistoryModal 迁至 components/PerfHistoryModal/styles.ts
  });
