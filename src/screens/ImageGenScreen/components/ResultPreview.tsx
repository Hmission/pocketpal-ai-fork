import * as React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  FlatList,
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {GeneratedImage} from '../../../store/imageGenStore';
import {ZoomableImage} from './ZoomableImage';
import {AlertTriangleMdIcon} from '../../../assets/icons';
import {PerfPanel} from './PerfPanel';
import {BannerBar} from '../../../components/ui/BannerBar';
import {WaveDots} from '../../../components/ui/WaveDots';
import {Progress} from '../../../components/ui/Progress';

/** 预览卡片顶部横幅（瞬时任务反馈 / 编辑锁定常驻）；dismissable=true 时整卡点击关闭 */
export type PreviewBanner = {
  text: string;
  variant: 'info' | 'error' | 'warning';
  dismissable: boolean;
};

interface ResultPreviewProps {
  /** 横向分页 FlatList ref（编排层持有，用于 scrollToOffset） */
  previewRef: React.RefObject<FlatList<GeneratedImage> | null>;
  /** 分页宽度（onLayout 测量） */
  pageW: number;
  /** 0 页编辑槽来源图路径 */
  editSource: string | null;
  /** 任务历史（≥1 页：running/success/failed 三态） */
  history: GeneratedImage[];
  generating: boolean;
  /** 首屏已定位（编排层持有 bootedRef，页面切换保留状态） */
  bootedRef: React.MutableRefObject<boolean>;
  /** 是否已消费启动定位（FlatList 挂载后编排层 scrollToOffset 用） */
  onListReady: () => void;
  taskKind: 'gen' | 'edit' | 'caption' | null;
  progress: number;
  progressText: string;
  stepTime: number;
  genStartedAt: number;
  stage: string;
  now: number;
  /** B57 兼容接线：编排层仍经 useWaveDots 计算并传入（prop 契约保留），
   *  渲染已归一 ui/WaveDots（size=10），原始 Animated.Value[] 不再被消费 */
  waveDots: Animated.Value[];
  /** 当前预览图（编辑目标/操作条主体） */
  currentImage: string | null;
  currentItem: GeneratedImage | null;
  fullscreen: boolean;
  onPageW: (w: number) => void;
  onMomentumEnd: (e: {nativeEvent: {contentOffset: {x: number}}}) => void;
  onPickEditImage: () => void;
  onOpenFullscreen: () => void;
  onCloseFullscreen: () => void;
  onSave: () => void;
  /** P6-6 高清放大（独立通用能力，对当前成功图可用） */
  onUpscale: () => void;
  /** 反推当前图提示词（v4：生图成功图/上传图操作条按钮） */
  onCaption: () => void;
  /** 反推结果复制（caption 成功页） */
  onCopyCaption: (item: GeneratedImage) => void;
  /** 复刻生图（caption 成功页：Sheet 全参数 → 回填 → 出图） */
  onRemake: (item: GeneratedImage) => void;
  onReroll: () => void;
  onDelete: () => void;
  /** 信息条点击：弹出完整生图参数（提示词/耗时/尺寸/模型/种子/步数） */
  onInfoPress: (item: GeneratedImage) => void;
  /** 失败任务页：一键复制完整报错（复制+落盘 AIOS/logs） */
  onCopyError: (item: GeneratedImage) => void;
  /** 失败任务页：同参数重试 */
  onRetryTask: (item: GeneratedImage) => void;
  /** 失败任务页：删除该任务条目 */
  onDeleteTask: (item: GeneratedImage) => void;
  /** 预览卡片顶部横幅（编排层派生：编辑锁定常驻 / 瞬时任务反馈）；null=不显示 */
  previewBanner?: PreviewBanner | null;
  /** 横幅整卡点击关闭（瞬时横幅可点；编辑锁定常驻不传） */
  onDismissBanner?: () => void;
}

/**
 * ResultPreview — ①结果区：横向分页 [0页编辑槽] + 任务页（三态）。
 *
 * 任务化（2026-08 开发者预览版）：每次生成/编辑 = 一个持久化任务条目：
 *  - running：空白预览页 + 进度卡（不再叠在旧图上）
 *  - success：回填图片 + 信息条 + 操作条
 *  - failed：报错页保留（摘要 + 一键复制完整报错 + 重试/删除）
 * 编辑态动效例外：仍半透明叠在当前图上（图上可见编辑过程）。
 */
export const ResultPreview: React.FC<ResultPreviewProps> = ({
  previewRef,
  pageW,
  editSource,
  history,
  generating,
  bootedRef,
  onListReady,
  taskKind,
  progress,
  progressText,
  stepTime,
  genStartedAt,
  stage,
  now,
  currentImage,
  currentItem,
  fullscreen,
  onPageW,
  onMomentumEnd,
  onPickEditImage,
  onOpenFullscreen,
  onCloseFullscreen,
  onSave,
  onUpscale,
  onCaption,
  onCopyCaption,
  onRemake,
  onReroll,
  onDelete,
  onInfoPress,
  onCopyError,
  onRetryTask,
  onDeleteTask,
  previewBanner,
  onDismissBanner,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  // 反推结果卡展开态（组件内局部状态；翻页重置）
  const [captionExpanded, setCaptionExpanded] = React.useState(false);

  // 进度卡内容（running 任务页）：完整跑分面板 PerfPanel 默认展开——
  // 2026-08-27 大王裁定：反推/编辑/放大与生成同属一套引擎任务流，
  // 一律走 blank 任务页 + 完整 PerfPanel（不叠图、不折叠、不特殊化），
  // 预览卡片跑分卡与生图完全一致。
  const progressBody = (title: string) => (
    <>
      {/* 三点波浪呼吸（B57：渲染归一 ui/WaveDots，prop 接线保留） */}
      <WaveDots size={10} />
      <Text style={s.genOverlayTitle}>{title}</Text>
      {/* B57：进度条归一 ui/Progress（height=8 保原视觉；宽度 70% 收窄） */}
      <Progress
        height={8}
        value={Math.max(progress, 2)}
        style={s.progressTrackW70}
      />
      <Text style={s.overlayText}>
        {progressText
          ? `采样 ${progressText}` +
            (stepTime > 0 ? `（${stepTime.toFixed(1)}s/步）` : '')
          : '加载权重/准备中…'}
        {' · '}
        {Math.max(0, Math.round((now - genStartedAt) / 1000))}s
      </Text>
      {stage ? (
        <Text style={s.overlayStage} numberOfLines={2}>
          ▸ {stage}
        </Text>
      ) : null}
      {/* 与生成同一路径：完整跑分面板（ADR-0008，默认展开叠全） */}
      <PerfPanel />
    </>
  );

  // 2026-08-27 大王裁定：反推/编辑/放大与生成同一路径（blank 任务页），
  // 不再有叠图 overlay（旧 absolute 叠图与任务页双渲染导致内容叠加）；
  // 任务进行中的进度反馈统一由 running 任务页承担（编排层 beginTask 后即 scroll）。

  /** FlatList 懒加载分页：只挂载可视页附近（windowSize），避免 50 张全尺寸大图
   *  同时解码导致渲染管线堵塞（HWUI 解码过载 → 全页图片空白）。 */
  const renderItem = ({item}: {item: GeneratedImage}) => {
    const status = item.status ?? 'success';

    // running：空白预览页 + 进度卡（2026-08-27 全任务类型统一：
    // 反推/编辑/放大/生成同一 blank 页 + 完整 PerfPanel，与生图完全一致）
    if (status === 'running') {
      const isUpscale = item.kind === 'upscaled';
      const isCaption = item.kind === 'caption';
      const title =
        taskKind === 'edit'
          ? '正在编辑此图…'
          : taskKind === 'caption' || isCaption
            ? '正在反推提示词…'
            : isUpscale
              ? '正在放大此图…'
              : '正在生成新图…';
      return (
        <View style={{width: pageW}}>
          <View style={[s.taskPage, {width: pageW}]}>
            {progressBody(title)}
          </View>
        </View>
      );
    }

    // failed：报错页保留（摘要 + 一键复制完整报错 + 重试/删除）
    if (status === 'failed') {
      return (
        <View style={{width: pageW}}>
          <View
            style={[s.taskPage, {width: pageW}]}
            testID="imagegen-failed-page">
            <AlertTriangleMdIcon
              width={34}
              height={34}
              stroke={theme.colors.danger}
            />
            <Text style={s.failedTitle}>生成失败</Text>
            <Text style={s.failedSummary} numberOfLines={3}>
              {item.errorSummary ?? '未知错误'}
            </Text>
            <View style={s.failedBtns}>
              <TouchableOpacity
                style={s.failedBtn}
                onPress={() => onCopyError(item)}
                testID="imagegen-copy-error">
                <Text style={s.failedBtnText}>复制报错信息</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.failedBtnGhost}
                onPress={() => onRetryTask(item)}
                testID="imagegen-retry-task">
                <Text style={s.failedBtnGhostText}>重试</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.failedBtnGhost}
                onPress={() => onDeleteTask(item)}
                testID="imagegen-delete-task">
                <Text style={s.failedBtnGhostText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // success：图片 + 信息条；caption 任务整卡切换为提示词产物卡（v5，产物区规则）
    const isCaptionItem = item.kind === 'caption';
    return (
      <View style={{width: pageW}}>
        {isCaptionItem ? (
          <View style={[s.captionFullPage, {width: pageW}]}>
            {/* 顶部 banner 胶囊：反推来源（点击弹参数详情 + 回填） */}
            <View
              style={[s.infoOverlayWrap, previewBanner && s.infoOverlayPushed]}
              pointerEvents="box-none">
              <TouchableOpacity
                style={s.infoOverlay}
                activeOpacity={0.7}
                onPress={() => onInfoPress(item)}>
                <Text style={s.infoOverlayText} numberOfLines={1}>
                  {[
                    '反推',
                    item.modelLabel,
                    item.durationMs != null
                      ? `${(item.durationMs / 1000).toFixed(1)}s`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* 提示词产物主体：默认 3 行折叠 + 展开收起 */}
            <TouchableOpacity
              style={s.captionFullBody}
              activeOpacity={0.8}
              onPress={() => setCaptionExpanded(v => !v)}>
              <Text style={s.captionCardTitle}>✨ 反推提示词</Text>
              <Text
                style={s.captionCardBody}
                numberOfLines={captionExpanded ? undefined : 3}>
                {item.prompt || '（无输出）'}
              </Text>
              <Text style={s.captionCardHint}>
                {captionExpanded ? '收起 ▲' : '展开 ▼'}
              </Text>
            </TouchableOpacity>
            {/* 操作行：复制 / 复刻生图 / 删除 */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.actionSave]}
                onPress={() => onCopyCaption(item)}>
                <Text style={s.actionTextOnSuccess}>复制</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionReuse]}
                onPress={() => onRemake(item)}>
                <Text style={s.actionTextOnWarning}>复刻生图</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionDelete]}
                onPress={onDelete}>
                <Text style={s.actionTextOnDanger}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={onOpenFullscreen}>
              <Image
                source={{uri: item.uri}}
                style={[s.preview, {width: pageW}]}
                resizeMode="contain"
              />
            </TouchableOpacity>
            {/* 信息条：预览图顶部胶囊（居中收窄 + 表面色半透明，弱化干扰）；点击弹完整参数 */}
            <View
              style={[s.infoOverlayWrap, previewBanner && s.infoOverlayPushed]}
              pointerEvents="box-none">
              <TouchableOpacity
                style={s.infoOverlay}
                activeOpacity={0.7}
                onPress={() => onInfoPress(item)}>
                <Text style={s.infoOverlayText} numberOfLines={1}>
                  {item.kind !== 'upload'
                    ? [
                        item.modelLabel,
                        item.durationMs != null
                          ? `${(item.durationMs / 1000).toFixed(1)}s`
                          : null,
                        `${item.width}×${item.height}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : `上传图 · ${item.width}×${item.height}`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bootedRef.current) {
      onMomentumEnd(e);
    }
  };

  // 操作条仅对成功图展示（失败页按钮在页内；running 页无操作）
  const showActionRow =
    !!currentImage && (currentItem?.status ?? 'success') === 'success';

  return (
    <>
      <View style={s.card}>
        <View
          style={s.resultWrap}
          onLayout={e => onPageW(e.nativeEvent.layout.width)}>
          {pageW > 0 ? (
            <FlatList
              ref={previewRef}
              data={history}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.taskId ?? item.uri}
              getItemLayout={(_, index) => ({
                length: pageW,
                offset: pageW * (index + 1), // 0 页 = 编辑槽 header
                index,
              })}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={5}
              onLayout={() => onListReady()}
              onMomentumScrollEnd={onMomentum}
              ListHeaderComponent={
                <View style={[s.editSlot, {width: pageW}]}>
                  {editSource ? (
                    <>
                      <Image
                        source={{
                          uri: editSource.startsWith('file://')
                            ? editSource
                            : `file://${editSource}`,
                        }}
                        style={s.editSlotImg}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={s.uploadFab}
                        onPress={onPickEditImage}>
                        <Text style={s.uploadFabText}>重新上传</Text>
                      </TouchableOpacity>
                      {/* v4：上传图同样可反推（有图即反推，IMAGEGEN_UI_SPEC §2） */}
                      <TouchableOpacity
                        style={[s.uploadFab, s.captionFab]}
                        onPress={onCaption}
                        disabled={generating}>
                        <Text style={s.uploadFabText}>反推</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={s.uploadBig}
                      onPress={onPickEditImage}>
                      <Text style={s.uploadBigIcon}>＋</Text>
                      <Text style={s.uploadBigText}>上传本地图片</Text>
                      <Text style={s.uploadBigHint}>
                        从手机相册选图，输入指令进行 AI 编辑
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              renderItem={renderItem}
            />
          ) : null}
          {/* 预览卡片顶部横幅（v4.3：弃屏级 top:458 中间浮条——移入图区顶部，只压预览卡片；
              无灰底，语义色 wash 透出；瞬时横幅整卡点击关闭） */}
          {previewBanner ? (
            <View style={s.bannerOverlay} pointerEvents="box-none">
              <BannerBar
                variant={previewBanner.variant}
                text={previewBanner.text}
                onPress={
                  previewBanner.dismissable ? onDismissBanner : undefined
                }
                onDismiss={
                  previewBanner.dismissable ? onDismissBanner : undefined
                }
              />
            </View>
          ) : null}
        </View>
        {/* 操作条 v4：生图/放大成功图五按钮；caption 任务操作条在页内（守卫：无图/caption 均不渲染） */}
        {showActionRow && currentItem?.kind !== 'caption' && (
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionBtn, s.actionSave]}
              onPress={onSave}>
              <Text style={s.actionTextOnSuccess}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.actionEdit]}
              onPress={onUpscale}>
              <Text style={s.actionTextOnInfo}>放大</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.actionCaption]}
              onPress={onCaption}
              disabled={generating}>
              <Text style={s.actionTextOnCaption}>反推</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.actionReuse]}
              onPress={onReroll}>
              <Text style={s.actionTextOnWarning}>再次生成</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.actionDelete]}
              onPress={onDelete}>
              <Text style={s.actionTextOnDanger}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 全屏查看：双指缩放/拖动 + 单击关闭（ZoomableImage，浅色遮罩）；
          条件渲染：每次打开重新挂载，缩放/位移共享值自动归位 */}
      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={onCloseFullscreen}>
        {fullscreen ? (
          <ZoomableImage uri={currentImage} onClose={onCloseFullscreen} />
        ) : null}
      </Modal>
    </>
  );
};
