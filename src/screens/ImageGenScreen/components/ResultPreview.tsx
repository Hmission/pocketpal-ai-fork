import * as React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  FlatList,
  Animated,
  Modal,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {GeneratedImage} from '../../../store/imageGenStore';
import {ZoomableImage} from './ZoomableImage';

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
  taskKind: 'gen' | 'edit' | null;
  progress: number;
  progressText: string;
  stepTime: number;
  genStartedAt: number;
  stage: string;
  now: number;
  toast: string | null;
  toastOpacity: Animated.Value;
  /** 三点波浪动效（useWaveDots） */
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
  toast,
  toastOpacity,
  waveDots,
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
  onReroll,
  onDelete,
  onInfoPress,
  onCopyError,
  onRetryTask,
  onDeleteTask,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  // 进度卡内容（running 任务页与编辑态 overlay 共用）
  const progressBody = (title: string) => (
    <>
      {/* 三点波浪呼吸 */}
      <View style={s.genDotsRow}>
        {waveDots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              s.genDot,
              {
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.45, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
      <Text style={s.genOverlayTitle}>{title}</Text>
      <View style={[s.progressTrack, s.progressTrackW70]}>
        <View
          style={[s.progressBarFill, {width: `${Math.max(progress, 2)}%`}]}
        />
      </View>
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
    </>
  );

  // 编辑态动效：半透明叠在当前图上（图可见）——仅编辑保留 overlay 语义；
  // 出图进度归 running 任务页（空白页），不再叠在旧图上。
  const editOverlay =
    generating && taskKind === 'edit' ? (
      <View style={[s.genOverlay, s.genOverlayEdit]}>
        {progressBody('正在编辑此图…')}
      </View>
    ) : null;

  /** FlatList 懒加载分页：只挂载可视页附近（windowSize），避免 50 张全尺寸大图
   *  同时解码导致渲染管线堵塞（HWUI 解码过载 → 全页图片空白）。 */
  const renderItem = ({item}: {item: GeneratedImage}) => {
    const status = item.status ?? 'success';

    // running：空白预览页 + 进度卡（放大任务：原图背景 + 半透明进度，见原图在放大）
    if (status === 'running') {
      const isUpscale = item.kind === 'upscaled';
      const title =
        taskKind === 'edit'
          ? '正在编辑此图…'
          : isUpscale
            ? '正在放大此图…'
            : '正在生成新图…';
      return (
        <View style={{width: pageW}}>
          <View style={[s.taskPage, {width: pageW}]}>
            {isUpscale && item.sourceUri ? (
              <>
                <Image
                  source={{uri: item.sourceUri}}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="contain"
                />
                <View style={[s.genOverlay, s.genOverlayEdit]}>
                  {progressBody(title)}
                </View>
              </>
            ) : (
              progressBody(title)
            )}
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
            <Text style={s.failedIcon}>⚠</Text>
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

    // success：图片 + 信息条
    return (
      <View style={{width: pageW}}>
        <TouchableOpacity onPress={onOpenFullscreen}>
          <Image
            source={{uri: item.uri}}
            style={[s.preview, {width: pageW}]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        {/* 信息条：预览图顶部胶囊（居中收窄 + 表面色半透明，弱化干扰）；点击弹完整参数 */}
        <View style={s.infoOverlayWrap} pointerEvents="box-none">
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
          {editOverlay}
          {/* 轻量滚动信息条：保存/编辑等操作的即时反馈，不打断操作 */}
          {toast ? (
            <Animated.View
              pointerEvents="none"
              style={[s.toastBar, {opacity: toastOpacity}]}>
              <Text style={s.toastText} numberOfLines={2}>
                {toast}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        {showActionRow && (
          <>
            {/* 操作条定稿四按钮：保存/放大/再次生成/删除；编辑唯一入口=ComposerPanel 底部 */}
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
          </>
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
