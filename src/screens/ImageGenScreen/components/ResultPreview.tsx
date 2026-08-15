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

interface ResultPreviewProps {
  /** 横向分页 FlatList ref（编排层持有，用于 scrollToOffset） */
  previewRef: React.RefObject<FlatList<GeneratedImage> | null>;
  /** 分页宽度（onLayout 测量） */
  pageW: number;
  /** 0 页编辑槽来源图路径 */
  editSource: string | null;
  /** 生成历史（≥1 页） */
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
  onReroll: () => void;
  onDelete: () => void;
}

/**
 * ResultPreview — ①结果区：横向分页 [0页编辑槽] + 历史图；生成进度 overlay 与
 * toast 叠在预览区；当前图操作条 + 参数水印；全屏查看 Modal。
 * 只读 props 渲染，翻页/回填等逻辑由编排层 onMomentumEnd 注入。
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
  onReroll,
  onDelete,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  // 生成/编辑动效 overlay：浅色圆角（与卡片设计语言统一）；出图=盖住预览区；编辑=半透明叠在当前图上（图可见）
  const genOverlay = generating ? (
    <View style={[s.genOverlay, taskKind === 'edit' ? s.genOverlayEdit : null]}>
      {/* 三点波浪呼吸（替代旧圆形 orb 缩放） */}
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
      <Text style={s.genOverlayTitle}>
        {taskKind === 'edit' ? '正在编辑此图…' : '正在生成新图…'}
      </Text>
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
    </View>
  ) : null;

  /** FlatList 懒加载分页：只挂载可视页附近（windowSize），避免 50 张全尺寸大图
   *  同时解码导致渲染管线堵塞（HWUI 解码过载 → 全页图片空白）。 */
  const renderItem = ({item}: {item: GeneratedImage}) => (
    <View style={{width: pageW}}>
      <TouchableOpacity onPress={onOpenFullscreen}>
        <Image
          source={{uri: item.uri}}
          style={[s.preview, {width: pageW}]}
          resizeMode="contain"
        />
      </TouchableOpacity>
      {/* 信息条压在预览图顶部：模型 · 耗时 · 分辨率（DESIGN_SPEC B1 同波定稿） */}
      {item.kind !== 'upload' ? (
        <View style={s.infoOverlay} pointerEvents="none">
          <Text style={s.infoOverlayText} numberOfLines={1}>
            {[
              item.modelLabel,
              item.durationMs != null
                ? `${(item.durationMs / 1000).toFixed(1)}s`
                : null,
              `${item.width}×${item.height}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : (
        <View style={s.infoOverlay} pointerEvents="none">
          <Text style={s.infoOverlayText} numberOfLines={1}>
            {`上传图 · ${item.width}×${item.height}`}
          </Text>
        </View>
      )}
    </View>
  );

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bootedRef.current) {
      onMomentumEnd(e);
    }
  };

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
              keyExtractor={item => item.uri}
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
          {genOverlay}
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
        {currentImage && (
          <>
            {/* 操作条定稿三按钮：保存/再次生成/删除；编辑唯一入口=ComposerPanel 底部 */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.actionSave]}
                onPress={onSave}>
                <Text style={s.actionTextOnSuccess}>保存</Text>
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

      {/* 全屏查看 */}
      <Modal visible={fullscreen} transparent animationType="fade">
        <View style={s.fullscreenBackdrop}>
          <TouchableOpacity
            style={s.fullscreenTouch}
            onPress={onCloseFullscreen}>
            {currentImage ? (
              <Image
                source={{uri: currentImage}}
                style={s.fullscreenImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>
          <Text style={s.fullscreenHint}>点按关闭</Text>
        </View>
      </Modal>
    </>
  );
};
