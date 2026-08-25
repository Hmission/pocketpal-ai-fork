/**
 * PerfHistoryModal — 跑分历史回放（PERF_BENCHMARK_DESIGN §5/6.3，P3+P4 / B41 提共享）
 *
 * RN Modal 自持（零导航注册）：
 *  - 列表态：历史任务摘要（时间/模型/类型），新→旧
 *  - 回放态：静态全览曲线 + 播放光标（逐点推进）+ 统计卡 + 跑分卡
 * 数据源：perfRecorder（JSONL 落盘文件），读取容错（被杀无 summary 时重算）。
 *
 * B41：提为共享组件（原 ImageGenScreen 内），聊天回合遥测（chat-turn）与
 * 生图任务同库，均可在此回看——跑分数据留存、可回看（大王诉求）。
 */
import * as React from 'react';
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  perfRecorder,
  type PerfMeta,
  type PerfSession,
} from '../../services/perf/perfRecorder';
import {PSS_DANGER_KB} from '../../services/perf/perfScore';
import {useTheme} from '../../hooks';
import {createStyles} from './styles';

const PLAYBACK_CHART_HEIGHT = 120;
const PLAY_TICK_MS = 180;

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDuration = (ms: number): string => {
  if (ms <= 0) return '--';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
};

const TASK_TYPE_LABEL: Record<string, string> = {
  generated: '生图',
  upscaled: '放大',
  caption: '反推',
  transcribe: '转写',
  tts: '语音',
  upload: '上传',
  // B41：聊天回合遥测（跑分本体也留存可回看）
  'chat-turn': '聊天',
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const PerfHistoryModal: React.FC<Props> = ({visible, onClose}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [sessions, setSessions] = React.useState<PerfMeta[]>([]);
  const [session, setSession] = React.useState<PerfSession | null>(null);
  const [playIdx, setPlayIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  // 打开时刷新列表；关闭时复位回放态
  React.useEffect(() => {
    if (visible) {
      setSession(null);
      perfRecorder.listSessions().then(setSessions);
    } else {
      setPlaying(false);
      setPlayIdx(0);
    }
  }, [visible]);

  // 播放光标：逐点推进（200ms 步进，放完即停）
  React.useEffect(() => {
    if (!playing || !session) {
      return;
    }
    const t = setInterval(() => {
      setPlayIdx(i => {
        if (i >= session.points.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_TICK_MS);
    return () => clearInterval(t);
  }, [playing, session]);

  const openSession = async (taskId: string) => {
    const sess = await perfRecorder.readSession(taskId);
    if (sess) {
      setSession(sess);
      setPlayIdx(0);
      setPlaying(true);
    }
  };

  const pts = session?.points ?? [];
  const cursor = pts.length > 0 ? pts[Math.min(playIdx, pts.length - 1)] : null;
  const peakPss = pts.reduce((m, p) => Math.max(m, p.pssKb), 0);
  const peakTemp = pts.reduce((m, p) => Math.max(m, p.tempC), 0);
  const peakPower = pts.reduce((m, p) => Math.max(m, p.powerMw), 0);
  const meanPss =
    pts.length > 0 ? pts.reduce((a, p) => a + p.pssKb, 0) / pts.length : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="perf-history-modal">
      <View style={s.perfModalBackdrop}>
        <View style={s.perfModalCard}>
          {/* 头部：标题 + 返回/关闭 */}
          <View style={s.perfModalHeader}>
            <TouchableOpacity
              style={s.perfModalBackBtn}
              onPress={() => (session ? setSession(null) : onClose())}
              testID="perf-history-back">
              <Text style={s.perfModalBackText}>
                {session ? '← 列表' : '× 关闭'}
              </Text>
            </TouchableOpacity>
            <Text style={s.perfModalTitle}>
              {session
                ? `${session.meta.modelLabel ?? TASK_TYPE_LABEL[session.meta.taskType] ?? session.meta.taskType} · ${fmtTime(session.meta.startedAt)}`
                : '性能回放历史'}
            </Text>
          </View>

          {!session ? (
            /* ── 列表态 ── */
            sessions.length === 0 ? (
              <Text style={s.perfModalEmpty}>
                暂无性能记录——聊天/生成等任务结束后自动落盘
              </Text>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={m => m.taskId}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={s.perfSessionRow}
                    onPress={() => openSession(item.taskId)}
                    testID={`perf-session-${item.taskId}`}>
                    <Text style={s.perfSessionTitle}>
                      {TASK_TYPE_LABEL[item.taskType] ?? item.taskType}
                      {item.modelLabel ? ` · ${item.modelLabel}` : ''}
                    </Text>
                    <Text style={s.perfSessionMeta}>
                      {fmtTime(item.startedAt)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )
          ) : (
            /* ── 回放态 ── */
            <View style={s.perfReplayBody}>
              {/* 当前点读数（播放光标） */}
              <View style={s.perfReplayCursorRow}>
                <Text style={s.perfReplayPss}>
                  {cursor
                    ? `${(cursor.pssKb / 1024 / 1024).toFixed(1)} GB`
                    : '--'}
                </Text>
                <Text style={s.perfReplayCursorMeta}>
                  CPU {cursor && cursor.cpuPct >= 0 ? `${Math.round(cursor.cpuPct)}%` : '--'} ·{' '}
                  GPU {cursor && cursor.gpuLoadPct >= 0 ? `${Math.round(cursor.gpuLoadPct)}%` : '--'} ·{' '}
                  {cursor && cursor.tempC > 0 ? `${Math.round(cursor.tempC)}°C` : '--'}
                </Text>
              </View>
              {/* 全览曲线（播放光标高亮） */}
              <View style={s.perfReplayChart}>
                {pts.map((p, i) => (
                  <View
                    key={i}
                    style={[
                      s.perfReplayBar,
                      {
                        height: Math.max(
                          2,
                          (p.pssKb / PSS_DANGER_KB) * PLAYBACK_CHART_HEIGHT,
                        ),
                        backgroundColor:
                          i === playIdx
                            ? theme.colors.error
                            : p.pssKb > PSS_DANGER_KB * (5 / 6)
                              ? '#F5A623'
                              : theme.colors.primary,
                        opacity: playIdx >= pts.length - 1 || i <= playIdx ? 1 : 0.25,
                      },
                    ]}
                  />
                ))}
              </View>
              {/* 播放控制 */}
              <TouchableOpacity
                style={s.perfPlayBtn}
                onPress={() => {
                  if (playIdx >= pts.length - 1) {
                    setPlayIdx(0);
                  }
                  setPlaying(v => !v);
                }}
                testID="perf-play">
                <Text style={s.perfPlayBtnText}>
                  {playing ? '⏸ 暂停' : '▶ 播放'} · {Math.min(playIdx + 1, pts.length)}/{pts.length}s
                </Text>
              </TouchableOpacity>
              {/* 统计卡 */}
              <View style={s.perfStatGrid}>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>时长</Text>
                  <Text style={s.perfStatCellValue}>
                    {fmtDuration(
                      pts.length > 1 ? pts[pts.length - 1].ts - pts[0].ts : 0,
                    )}
                  </Text>
                </View>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>PSS 峰值</Text>
                  <Text style={s.perfStatCellValue}>
                    {(peakPss / 1024 / 1024).toFixed(1)}GB
                  </Text>
                </View>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>PSS 均值</Text>
                  <Text style={s.perfStatCellValue}>
                    {(meanPss / 1024 / 1024).toFixed(1)}GB
                  </Text>
                </View>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>温度峰值</Text>
                  <Text style={s.perfStatCellValue}>
                    {peakTemp > 0 ? `${Math.round(peakTemp)}°C` : '--'}
                  </Text>
                </View>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>功耗峰值</Text>
                  <Text style={s.perfStatCellValue}>
                    {peakPower > 0 ? `${(peakPower / 1000).toFixed(1)}W` : '--'}
                  </Text>
                </View>
                <View style={s.perfStatCell}>
                  <Text style={s.perfStatCellLabel}>结果</Text>
                  <Text style={s.perfStatCellValue}>
                    {session.result === 'success'
                      ? '成功'
                      : session.result === 'failed'
                        ? '失败'
                        : '中断'}
                  </Text>
                </View>
              </View>
              {/* 跑分卡 */}
              {session.score ? (
                <View style={s.perfScoreCard} testID="perf-score-card">
                  <View style={s.perfScoreTotal}>
                    <Text style={s.perfScoreTotalNum}>{session.score.total}</Text>
                    <Text style={s.perfScoreTotalLabel}>综合分</Text>
                  </View>
                  <View style={s.perfScoreItems}>
                    <Text style={s.perfScoreItem}>
                      内存安全 {session.score.memory}
                    </Text>
                    <Text style={s.perfScoreItem}>
                      温控 {session.score.thermal}
                    </Text>
                    <Text style={s.perfScoreItem}>
                      稳定性 {session.score.stability}
                    </Text>
                    {session.score.speed !== null ? (
                      <Text style={s.perfScoreItem}>
                        速度 {session.score.speed}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={s.perfModalEmpty}>
                  采样点不足，无法生成跑分卡
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
