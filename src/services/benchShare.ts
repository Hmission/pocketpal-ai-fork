/**
 * benchShare — 跑分卡分享链路（PERF_BENCHMARK_DESIGN §10.9，B39）
 *
 * 全仓当前无 Share 通道（生图分享已移除）——本链路新建，零新依赖：
 * 像素卡光栅化（benchShareCard）→ PNG 落缓存目录 → RN 内置 Share 尝试
 * （url + 文本摘要双带：url 被系统忽略时文本仍带分数，诚实不静默）。
 * 成绩不发公网：分享是用户主动行为且卡面零用户内容。
 */
import {Share} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {renderScoreCardPng, type ShareCardInput} from './benchShareCard';
import {toBase64} from './pngUtil';

export interface ShareOutcome {
  /** shared = 系统分享面板已唤起；failed = 失败（调用方诚实提示） */
  status: 'shared' | 'failed';
  /** PNG 落盘路径（失败也保留文件，用户可自行从文件管理器分享） */
  filePath: string | null;
}

export async function shareScoreCard(
  input: ShareCardInput,
): Promise<ShareOutcome> {
  let filePath: string | null = null;
  try {
    const png = renderScoreCardPng(input);
    filePath = `${RNFS.CachesDirectoryPath}/bench_score_${Date.now()}.png`;
    await RNFS.writeFile(filePath, toBase64(png), 'base64');
  } catch (e) {
    console.warn('[benchShare] 跑分卡落盘失败:', e);
    filePath = null;
  }

  const speedPart = input.speed == null ? '--' : String(input.speed);
  const message = `Pocket Chick Benchmark — Total ${Math.round(
    input.total,
  )}/100 (MEM ${input.memory} · SPD ${speedPart} · THM ${
    input.thermal
  } · STB ${input.stability}) · ${input.rank}`;

  try {
    await Share.share(
      filePath ? {url: `file://${filePath}`, message} : {message},
    );
    return {status: 'shared', filePath};
  } catch (e) {
    console.warn('[benchShare] 系统分享不可用:', e);
    return {status: 'failed', filePath};
  }
}
