/* eslint-disable no-bitwise -- B51：PNG IHDR 二进制解析测试（字节位移/掩码），位运算为被测对象本身 */
import {
  encodePng,
  pngWithMeta,
  readPngMetaBytes,
  PNG_META_KEY,
  PngGenMeta,
} from '../pngUtil';

const baseMeta: PngGenMeta = {
  prompt: '一只橙色的小鸡在草地上',
  modelId: 'zimage-turbo',
  steps: 4,
  cfg: 1,
  seed: 42,
  width: 512,
  height: 512,
  backend: 'OpenCL',
  durationMs: 1234,
};

/** 逐块扫描 PNG，返回 [类型, 长度] 序列（长度按大端解析，与 PNG 规范一致） */
function scanChunks(png: Uint8Array): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  let off = 8;
  while (off + 12 <= png.length) {
    const len =
      (png[off] << 24) |
      (png[off + 1] << 16) |
      (png[off + 2] << 8) |
      png[off + 3];
    const type = String.fromCharCode(
      png[off + 4],
      png[off + 5],
      png[off + 6],
      png[off + 7],
    );
    out.push([type, len]);
    off += 12 + len;
  }
  return out;
}

describe('pngUtil tEXt 生成参数元数据（开发项3）', () => {
  it('encodePng 产物：IHDR 后无 tEXt（纯净基线）', () => {
    const png = encodePng(new Uint8Array(8 * 8 * 3), 8, 8);
    expect(scanChunks(png)).toEqual([
      ['IHDR', 13],
      ['IDAT', expect.any(Number)],
      ['IEND', 0],
    ]);
  });

  it('pngWithMeta 插入 tEXt 于 IHDR 之后，块结构保持合法', () => {
    const png = encodePng(new Uint8Array(8 * 8 * 3), 8, 8);
    const withMeta = pngWithMeta(png, baseMeta);
    const chunks = scanChunks(withMeta);
    expect(chunks[0]).toEqual(['IHDR', 13]);
    expect(chunks[1][0]).toBe('tEXt');
    expect(chunks[2][0]).toBe('IDAT');
    expect(chunks[chunks.length - 1]).toEqual(['IEND', 0]);
    // 像素零改动：IDAT 长度与纯净版一致（插块非重编码）
    const plain = scanChunks(png);
    expect(chunks[2][1]).toBe(plain[1][1]);
  });

  it('中文 prompt 往返一致（UTF-8 编码/解码）', () => {
    const withMeta = pngWithMeta(
      encodePng(new Uint8Array(4 * 4 * 3), 4, 4),
      baseMeta,
    );
    expect(readPngMetaBytes(withMeta)).toEqual(baseMeta);
  });

  it('emoji/代理对 prompt 往返一致', () => {
    const meta: PngGenMeta = {...baseMeta, prompt: '小鸡 🐣 和 🎨 调色板'};
    const withMeta = pngWithMeta(
      encodePng(new Uint8Array(4 * 4 * 3), 4, 4),
      meta,
    );
    expect(readPngMetaBytes(withMeta)?.prompt).toBe(meta.prompt);
  });

  it('超长中文 prompt 截断后块 ≤512 字节且仍为合法 UTF-8（不切多字节序列）', () => {
    const meta: PngGenMeta = {
      ...baseMeta,
      prompt: '超'.repeat(300), // 900 字节
    };
    const withMeta = pngWithMeta(
      encodePng(new Uint8Array(4 * 4 * 3), 4, 4),
      meta,
    );
    const chunks = scanChunks(withMeta);
    const tExt = chunks.find(c => c[0] === 'tEXt')!;
    // key(8) + 分隔符(1) + value ≤ 512
    expect(tExt[1]).toBeLessThanOrEqual(8 + 1 + 512);
    const back = readPngMetaBytes(withMeta);
    expect(back?.prompt).toMatch(/^超+$/); // 截断后仍是纯「超」，未混入半字节
    expect((back?.prompt as string).length).toBeLessThan(300);
  });

  it('无 meta 的图（旧图/外部图）读回 null', () => {
    expect(readPngMetaBytes(encodePng(new Uint8Array(4 * 4 * 3), 4, 4))).toBe(
      null,
    );
  });

  it('外部图的同名 key（WebUI 参数串）不识别——schema 门控', () => {
    // 手工构造一个 key=aios.gen 但 value 是非 JSON 对象（纯字符串）的 tEXt，
    // 模拟 WebUI 生态同名 key 的参数串——应被 schema 门控过滤返回 null。
    const plain = encodePng(new Uint8Array(4 * 4 * 3), 4, 4);
    const jsonValue = '"just a string, not an object"';
    const keyBytes: number[] = [];
    for (const ch of PNG_META_KEY) {
      keyBytes.push(ch.charCodeAt(0));
    }
    const dataLen = keyBytes.length + 1 + jsonValue.length;
    const block = new Uint8Array(12 + dataLen);
    block[0] = (dataLen >> 24) & 0xff;
    block[1] = (dataLen >> 16) & 0xff;
    block[2] = (dataLen >> 8) & 0xff;
    block[3] = dataLen & 0xff;
    block[4] = 0x74; // t
    block[5] = 0x45; // E
    block[6] = 0x58; // X
    block[7] = 0x74; // t
    for (let i = 0; i < keyBytes.length; i++) {
      block[8 + i] = keyBytes[i];
    }
    block[8 + keyBytes.length] = 0;
    for (let i = 0; i < jsonValue.length; i++) {
      block[9 + keyBytes.length + i] = jsonValue.charCodeAt(i);
    }
    // CRC（pngUtil 的 crc32 未导出，用 node zlib 校验不了——改为结构注入后靠门控返回 null）
    // 直接拼入 IHDR 之后（CRC 不校验读路径，readPngMetaBytes 不验 CRC）
    const insertAt = 8 + 25;
    const out = new Uint8Array(plain.length + block.length);
    out.set(plain.subarray(0, insertAt), 0);
    out.set(block, insertAt);
    out.set(plain.subarray(insertAt), insertAt + block.length);
    expect(readPngMetaBytes(out)).toBeNull();
  });

  it('非 PNG 字节返回 null（不抛错）', () => {
    expect(readPngMetaBytes(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(readPngMetaBytes(new Uint8Array(0))).toBeNull();
  });
});
