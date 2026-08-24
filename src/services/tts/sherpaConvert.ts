import * as RNFS from '@dr.pogodin/react-native-fs';

/**
 * B36：sherpa 生成链路文件转换工具。
 *
 * 背景：fork 播放链路（@pocketpalai/react-native-speech）与 sherpa 生成链路
 * （AudioTts native）对同一模型的文件格式要求不同：
 *  - tokenizer.json（HF JSON 词表）↔ tokens.txt（"<token> <id>" 文本）
 *  - unicode_indexer.json（JSON 数组）↔ unicode_indexer.bin（int32 LE 二进制）
 *  - voice {id}.json（style_ttl/style_dp JSON）↔ {id}.bin（6×int64 头 + float32 数据）
 *
 * 各引擎 downloadModel 完成后调用本模块生成 sherpa 格式副本，生成链路
 * 与播放链路各自消费自己格式的文件，互不干扰。
 */

/** 数组 → base64（RN 无 Buffer，手写编码；仅转换期调用一次，性能可接受） */
function bytesToBase64(bytes: Uint8Array): string {
  const CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += CHARS[b0 >> 2]!;
    out += CHARS[((b0 & 3) << 4) | (b1 >> 4)]!;
    out += i + 1 < bytes.length ? CHARS[((b1 & 15) << 2) | (b2 >> 6)]! : '=';
    out += i + 2 < bytes.length ? CHARS[b2 & 63]! : '=';
  }
  return out;
}

/**
 * 从 tokenizer.json（HF 格式）生成 sherpa 的 tokens.txt。
 * 格式：每行 "<token> <id>"，按 id 升序。
 */
export async function generateKokoroTokensTxt(
  tokenizerPath: string,
  outPath: string,
): Promise<void> {
  const raw = await RNFS.readFile(tokenizerPath, 'utf8');
  const tokenizer = JSON.parse(raw) as {model?: {vocab?: Record<string, number>}};
  const vocab = tokenizer.model?.vocab;
  if (!vocab) {
    throw new Error('tokenizer.json 缺少 model.vocab');
  }
  const lines = Object.entries(vocab).map(([token, id]) => `${token} ${id}`);
  lines.sort((a, b) => Number(a.split(' ').pop()) - Number(b.split(' ').pop()));
  await RNFS.writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
}

/** 从 unicode_indexer.json（int32 数组）生成 sherpa 的 unicode_indexer.bin */
export async function convertUnicodeIndexer(
  jsonPath: string,
  binPath: string,
): Promise<void> {
  const raw = await RNFS.readFile(jsonPath, 'utf8');
  const arr = JSON.parse(raw) as number[];
  const buf = new ArrayBuffer(arr.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < arr.length; i++) {
    view.setInt32(i * 4, arr[i]!, true);
  }
  await RNFS.writeFile(binPath, bytesToBase64(new Uint8Array(buf)), 'base64');
}

/**
 * 从 voice style JSON 生成 sherpa 的 {id}.bin。
 * 布局：6×int64 LE 维度头 [1,50,256,1,8,16] + style_ttl float32 + style_dp float32。
 */
export async function convertVoiceStyle(
  jsonPath: string,
  binPath: string,
): Promise<void> {
  const raw = await RNFS.readFile(jsonPath, 'utf8');
  const style = JSON.parse(raw) as {
    style_ttl?: {data?: number[][][]};
    style_dp?: {data?: number[][][]};
  };
  const ttl = style.style_ttl?.data;
  const dp = style.style_dp?.data;
  if (!ttl || !dp) {
    throw new Error('voice style JSON 缺少 style_ttl/style_dp');
  }
  const ttlFlat: number[] = [];
  for (const d2 of ttl) {
    for (const d1 of d2) {
      ttlFlat.push(...d1);
    }
  }
  const dpFlat: number[] = [];
  for (const d2 of dp) {
    for (const d1 of d2) {
      dpFlat.push(...d1);
    }
  }
  const total = 48 + ttlFlat.length * 4 + dpFlat.length * 4;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  // 6×int64：ttl(1,50,256) + dp(1,8,16)——与 sherpa ParseVoiceStyleFromBinary 对齐
  const dims = [1, 50, 256, 1, 8, 16];
  for (let i = 0; i < 6; i++) {
    view.setBigInt64(i * 8, BigInt(dims[i]!), true);
  }
  let off = 48;
  for (const v of ttlFlat) {
    view.setFloat32(off, v, true);
    off += 4;
  }
  for (const v of dpFlat) {
    view.setFloat32(off, v, true);
    off += 4;
  }
  await RNFS.writeFile(binPath, bytesToBase64(new Uint8Array(buf)), 'base64');
}
