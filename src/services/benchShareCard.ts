/**
 * benchShareCard — 跑分卡纯 JS 像素光栅化（PERF_BENCHMARK_DESIGN §10.9，B39）
 *
 * 全仓无视图截图依赖（零新依赖红线），跑分卡用像素画手搓：
 * 5×7 点阵字（固定英文标签集）+ 七段数码管数字 + 分项条形图。
 * 卡面零用户内容（设备+分数+日期），不发公网——成绩只住你手机里。
 * 像素风不是妥协，是审美（致敬《牛来》：粗糙即真诚）。
 */
import {encodePng} from './pngUtil';

export interface ShareCardInput {
  total: number;
  memory: number;
  thermal: number;
  stability: number;
  speed: number | null;
  /** 段位 ASCII（GOD CHICK / FIGHTER CHICK / FREE RANGE CHICK） */
  rank: string;
  /** YYYY-MM-DD */
  date: string;
}

// ── 5×7 点阵字（仅收录卡面用到的字形；' ' 空格）──
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ── 七段数码管（a..g 段，数字 + '-'）──
const SEGS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
};

type RGB = [number, number, number];

class Canvas {
  buf: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.buf = new Uint8Array(w * h * 3);
  }
  px(x: number, y: number, c: RGB) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      return;
    }
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        this.px(i, j, c);
      }
    }
  }
  /** 5×7 点阵字（scale 像素放大） */
  glyph(ch: string, x: number, y: number, scale: number, c: RGB) {
    const rows = FONT[ch];
    if (!rows) {
      return;
    }
    rows.forEach((row, j) => {
      for (let i = 0; i < 5; i++) {
        if (row[i] === '1') {
          this.rect(x + i * scale, y + j * scale, scale, scale, c);
        }
      }
    });
  }
  text(s: string, x: number, y: number, scale: number, c: RGB) {
    let cx = x;
    for (const ch of s) {
      this.glyph(ch, cx, y, scale, c);
      cx += 6 * scale; // 5 列字 + 1 列间隔
    }
  }
  textWidth(s: string, scale: number) {
    return s.length * 6 * scale - scale;
  }
  /** 七段数码管单字（宽 5s 高 9s） */
  seg(ch: string, x: number, y: number, s: number, c: RGB) {
    const segs = SEGS[ch];
    if (!segs) {
      return;
    }
    const t = Math.max(2, Math.floor(s * 0.7)); // 段粗
    const w = 5 * s;
    const h = 9 * s;
    const draw: Record<string, () => void> = {
      a: () => this.rect(x, y, w, t, c),
      b: () => this.rect(x + w - t, y, t, h / 2, c),
      c: () => this.rect(x + w - t, y + h / 2, t, h / 2, c),
      d: () => this.rect(x, y + h - t, w, t, c),
      e: () => this.rect(x, y + h / 2, t, h / 2, c),
      f: () => this.rect(x, y, t, h / 2, c),
      g: () => this.rect(x, y + h / 2 - t / 2, w, t, c),
    };
    for (const seg of segs) {
      draw[seg]?.();
    }
  }
  number(n: number, x: number, y: number, s: number, c: RGB) {
    const str = String(n);
    let cx = x;
    for (const ch of str) {
      this.seg(ch, cx, y, s, c);
      cx += 6 * s;
    }
  }
}

// 卡面色板（像素风暖金系；登记=本文件内聚，语义同 brandAccent 族）
const BG: RGB = [26, 20, 11];
const GOLD: RGB = [255, 179, 0];
const DIM: RGB = [150, 130, 90];
const BAR: RGB = [255, 197, 77];

export const CARD_W = 540;
export const CARD_H = 810;

/** 光栅化跑分卡 → PNG 字节（纯 JS，零依赖，零用户内容） */
export function renderScoreCardPng(input: ShareCardInput): Uint8Array {
  const cv = new Canvas(CARD_W, CARD_H);
  cv.rect(0, 0, CARD_W, CARD_H, BG);

  // 标题：POCKET CHICK / BENCHMARK
  const title = 'POCKET CHICK';
  cv.text(title, (CARD_W - cv.textWidth(title, 4)) / 2, 48, 4, GOLD);
  const sub = 'BENCHMARK';
  cv.text(sub, (CARD_W - cv.textWidth(sub, 2)) / 2, 96, 2, DIM);

  // 综合分（七段大字）+ /100
  const totalStr = String(Math.round(input.total));
  const segScale = 8;
  const totalW = totalStr.length * 6 * segScale;
  cv.number(
    Math.round(input.total),
    (CARD_W - totalW - 90) / 2,
    160,
    segScale,
    GOLD,
  );
  cv.text('100', (CARD_W + totalW) / 2 - 40, 214, 2, DIM);

  // 段位（ASCII 像素字）
  cv.text(input.rank, (CARD_W - cv.textWidth(input.rank, 2)) / 2, 280, 2, BAR);

  // 分项条形图：MEM / SPD / THM / STB（speed=null → 条 0 + 诚实 '-'）
  const items: Array<{label: string; v: number | null}> = [
    {label: 'MEM', v: input.memory},
    {label: 'SPD', v: input.speed},
    {label: 'THM', v: input.thermal},
    {label: 'STB', v: input.stability},
  ];
  const barX = 120;
  const barMaxW = 280;
  items.forEach((it, i) => {
    const y = 360 + i * 76;
    cv.text(it.label, 48, y + 8, 2, DIM);
    cv.rect(barX, y, barMaxW, 26, [60, 48, 28]); // 轨道
    if (it.v != null) {
      const w = Math.round((Math.min(it.v, 100) / 100) * barMaxW);
      cv.rect(barX, y, Math.max(w, 2), 26, BAR);
      cv.number(it.v, barX + barMaxW + 24, y - 8, 3, GOLD);
    } else {
      cv.text('-', barX + barMaxW + 24, y + 8, 2, DIM);
    }
  });

  // 日期（卡面唯一动态文本；七段数字 + 横杠）
  const dateDigits = input.date.replace(/\//g, '-');
  let dx = 150;
  for (const ch of dateDigits) {
    if (ch === '-') {
      cv.seg('-', dx, 690, 3, DIM);
    } else {
      cv.seg(ch, dx, 690, 3, DIM);
    }
    dx += 22;
  }

  // 底注：本地成绩宣言（ASCII）
  const foot = 'LOCAL ONLY';
  cv.text(foot, (CARD_W - cv.textWidth(foot, 1)) / 2, 762, 1, DIM);

  return encodePng(cv.buf, CARD_W, CARD_H);
}
