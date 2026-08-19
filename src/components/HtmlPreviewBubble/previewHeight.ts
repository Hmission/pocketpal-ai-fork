/**
 * 预览卡高度估算（2026-08-19 K90 血证：250px 硬编码截断 300×300 游戏画面，
 * 卡片高度按板面自适应）。模型游戏板面常见 300~500px，加上标题/说明/状态行
 * 约 +220px 余量；小于 320 无意义，超过 560 卡片占整屏——超出靠 WebView 内
 * 滚动（scrollEnabled=true）兜底。纯字符串解析（in-row 预览禁 JS，无法实测
 * content height）。
 */

const PREVIEW_HEIGHT_MIN = 320;
const PREVIEW_HEIGHT_MAX = 560;
const PREVIEW_HEIGHT_DEFAULT = 480;
const PREVIEW_HEIGHT_HEADROOM = 220;

const HEIGHT_PX_RE = /height\s*:\s*(\d+)px/gi;
const HEIGHT_ATTR_RE = /height\s*=\s*["'](\d+)["']/gi;

/**
 * 从模型 HTML 估出预览卡建议高度：取最大板面/容器高度（≥200px 者）加
 * 标题/说明余量，钳制到 [320, 560]；无板面线索回退默认 480。
 */
export function estimatePreviewHeight(html: string): number {
  let maxBoard = 0;
  for (const re of [HEIGHT_PX_RE, HEIGHT_ATTR_RE]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const px = parseInt(m[1], 10);
      if (px >= 200 && px > maxBoard) {
        maxBoard = px;
      }
    }
  }
  if (maxBoard === 0) {
    return PREVIEW_HEIGHT_DEFAULT;
  }
  return Math.min(
    PREVIEW_HEIGHT_MAX,
    Math.max(PREVIEW_HEIGHT_MIN, maxBoard + PREVIEW_HEIGHT_HEADROOM),
  );
}
