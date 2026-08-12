/**
 * ActiveTaskBanner — 聊天窗口内的引擎任务横幅（调度叙事的可见面）
 *
 * 观察 engineStatus.busy：有引擎在 加载/运行/出错 时，在聊天区顶部显示
 * 一条 slim 横幅（引擎名 + 阶段 + 进度），出错时提供 重试/去生图页。
 * 空闲时渲染 null——不占空间、不臃肿。
 *
 * 数据源唯一：engineStatus（promptWriter / imageGenStore 写入）。
 */
import * as React from 'react';
import {View, Text, StyleSheet, ActivityIndicator, TouchableOpacity} from 'react-native';
import {observer} from 'mobx-react';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {engineStatus, EngineKind} from '../../store/engineStatus';
import {ROUTES} from '../../utils/navigationConstants';

const ENGINE_NAME: Record<EngineKind, string> = {
  prompter: '管家模型',
  chat: '对话模型',
  image: '生图引擎',
};

export const ActiveTaskBanner: React.FC = observer(() => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const busy = engineStatus.busy;
  if (!busy) {
    return null;
  }
  const st = engineStatus.engines[busy];
  const isError = st.phase === 'error';
  const indeterminate = st.progress < 0;

  return (
    <View
      style={[
        styles.wrap,
        isError && styles.wrapError,
        // ChatScreen 是 headerShown:false，横幅位于屏幕顶端 → 必须避让系统状态栏
        {paddingTop: insets.top + 6},
      ]}>
      <View style={styles.row}>
        {isError ? (
          <Text style={styles.icon}>⚠️</Text>
        ) : indeterminate ? (
          <ActivityIndicator size="small" color="#6750A4" />
        ) : (
          <Text style={styles.icon}>⚙️</Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {ENGINE_NAME[busy]}
        </Text>
        <Text style={styles.stage} numberOfLines={1}>
          {isError
            ? st.error ?? '出错'
            : st.stage ||
              (st.phase === 'loading'
                ? '加载中…'
                : st.phase === 'running'
                  ? '运行中…'
                  : '')}
        </Text>
        {!indeterminate && !isError && (
          <Text style={styles.pct}>{st.progress}%</Text>
        )}
      </View>

      {/* 进度条（确定进度时） */}
      {!indeterminate && !isError && (
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${st.progress}%`}]} />
        </View>
      )}

      {/* 出错操作区：生图引擎出错 → 引导去生图页（那里有完整模型选择/下载/排查） */}
      {isError && busy === 'image' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate(ROUTES.IMAGE_GEN as never)}>
            <Text style={styles.btnText}>去生图页排查</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EDE7F6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1C4E9',
  },
  wrapError: {
    backgroundColor: '#FDECEA',
    borderBottomColor: '#F5C6C0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3c3c43',
  },
  stage: {
    flex: 1,
    fontSize: 11,
    color: '#666',
  },
  pct: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6750A4',
  },
  track: {
    marginTop: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D1C4E9',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#6750A4',
  },
  actions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  btnText: {
    fontSize: 11,
    color: '#6750A4',
  },
});
