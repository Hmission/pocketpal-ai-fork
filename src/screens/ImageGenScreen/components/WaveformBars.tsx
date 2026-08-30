/**
 * WaveformBars — 音频产物波形条（AUDIO_UI_SPEC v1.10 ③）
 *
 * 简单版：读 wav PCM（16/32bit、任意采样率），截断前 20s 采样，
 * 均匀 40 桶取 RMS 归一化 → 柱状渲染。播放进度高亮已播段（primary），
 * 未播段 outlineVariant。首帧解析后内存缓存（同 uri 不再重读）。
 * 读取失败渲染空条（不阻断播放器）。
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import * as RNFS from '@dr.pogodin/react-native-fs';

const BAR_COUNT = 40;
const READ_LIMIT_SECONDS = 20;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 → Uint8Array（Hermes 无 Buffer，手写解码） */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i + 3 < clean.length || i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]);
    const c1 = B64.indexOf(clean[i + 1]);
    const c2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const c3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    if (c0 < 0 || c1 < 0) {
      break;
    }
    out[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) {
      out[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    }
    if (c3 >= 0) {
      out[p++] = ((c2 & 3) << 6) | c3;
    }
  }
  return out.subarray(0, p);
}

/** WAV 解析 → bars 归一化幅值 [0.04..1]（0 = 解析失败/空数据） */
async function readWavBars(uri: string, path: string): Promise<number[]> {
  const cached = wavCache.get(uri);
  if (cached) {
    return cached;
  }
  // ① 整读 base64（readFile 为 RNFS 成熟路径；read 分段 API 在 Hermes 异常，弃用）
  const bytes = base64ToBytes(await RNFS.readFile(path, 'base64'));
  if (
    bytes.length < 44 ||
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46
  ) {
    console.warn('[WaveformBars] not a wav:', path, bytes.length);
    return [];
  }
  // ② 扫描 chunk 定位 fmt + data
  let fmtOff = -1;
  let dataOff = -1;
  let dataLen = 0;
  let off = 12;
  while (off + 8 <= bytes.length) {
    const id =
      String.fromCharCode(bytes[off]) +
      String.fromCharCode(bytes[off + 1]) +
      String.fromCharCode(bytes[off + 2]) +
      String.fromCharCode(bytes[off + 3]);
    const sz =
      bytes[off + 4] |
      (bytes[off + 5] << 8) |
      (bytes[off + 6] << 16) |
      (bytes[off + 7] << 24);
    if (id === 'fmt ') {
      fmtOff = off + 8;
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = sz;
      break;
    }
    off += 8 + sz + (sz & 1);
  }
  if (fmtOff < 0 || dataOff < 0 || dataLen <= 0) {
    console.warn('[WaveformBars] no fmt/data chunk:', path);
    return [];
  }
  const channels = bytes[fmtOff + 2] | (bytes[fmtOff + 3] << 8);
  const sampleRate =
    bytes[fmtOff + 8] |
    (bytes[fmtOff + 9] << 8) |
    (bytes[fmtOff + 10] << 16) |
    (bytes[fmtOff + 11] << 24);
  const bits = bytes[fmtOff + 14] | (bytes[fmtOff + 15] << 8);
  const bytesPerSample = bits / 8;
  if (channels < 1 || bytesPerSample < 1) {
    console.warn('[WaveformBars] bad fmt:', path, {channels, bits});
    return [];
  }
  // ③ 截断采样段（前 20s，采样率 × 声道 × 字节对齐）
  const need = Math.min(
    dataLen,
    sampleRate * READ_LIMIT_SECONDS * bytesPerSample * channels,
  );
  const data = bytes.subarray(dataOff, dataOff + need);
  const usable = Math.floor(data.length / bytesPerSample / channels);
  const perBucket = Math.max(1, Math.floor(usable / BAR_COUNT));
  const out: number[] = [];
  for (let b = 0; b < BAR_COUNT; b++) {
    let sum = 0;
    let n = 0;
    for (
      let s = b * perBucket;
      s < Math.min((b + 1) * perBucket, usable);
      s++
    ) {
      const o = s * channels * bytesPerSample;
      // 16bit 取整样本；24/32bit 取高 16 位字节对（little-endian）
      const hi = o + (bytesPerSample > 2 ? bytesPerSample - 2 : 0);
      const v = (data[hi] | (data[hi + 1] << 8)) << 0;
      sum += v * v;
      n++;
    }
    out.push(n > 0 ? Math.sqrt(sum / n) : 0);
  }
  const max = Math.max(...out, 1);
  const bars = out.map(v => Math.min(1, Math.max(0.04, v / max)));
  wavCache.set(uri, bars);
  return bars;
}

/** uri → bars 内存缓存（产物文件内容固定不变） */
const wavCache = new Map<string, number[]>();

interface Props {
  uri: string;
  playPosition: number;
  duration: number;
  isPlaying: boolean;
}

export function WaveformBars({uri, playPosition, duration}: Props) {
  const theme = useTheme();
  const [bars, setBars] = React.useState<number[]>([]);

  React.useEffect(() => {
    let live = true;
    setBars([]);
    const path = uri.replace(/^file:\/\//, '');
    void readWavBars(uri, path)
      .then(v => {
        if (live) {
          setBars(v);
        }
      })
      .catch(e => {
        console.warn('[WaveformBars] load failed:', path, e);
        if (live) {
          setBars([]);
        }
      });
    return () => {
      live = false;
    };
  }, [uri]);

  const ratio = duration > 0 ? Math.min(1, playPosition / duration) : 0;
  return (
    <View style={styles.row} testID="waveform-bars">
      {bars.map((v, i) => {
        const played = i / BAR_COUNT <= ratio;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${Math.round(v * 100)}%`,
                backgroundColor: played
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 36,
    gap: 2,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 1.5,
    minHeight: 3,
  },
});
