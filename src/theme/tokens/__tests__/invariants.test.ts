/**
 * Grep-based invariants for the theming foundation.
 *
 * These tests would have been better expressed as lint rules, but PocketPal
 * doesn't ship a custom ESLint plugin and the regressions they guard are
 * cheap to express with a recursive directory walk. They complement (do
 * NOT replace) the scripts/verify-* CI checks for fonts and the Paper
 * surface — those check different concerns.
 *
 * Coverage:
 *   - No `x1Theme`, `AppTheme.X1`, or `'x1'` colorScheme reference
 *     anywhere in `src/` production code (the legacy x1 theme has been
 *     removed).
 *   - The new token surface (`theme.typography.*`, `theme.radius.*`,
 *     `theme.stroke.*`) has ZERO production consumers in this slice.
 *     Future restyle slices will start to populate them; an
 *     early consumer would make this slice accidentally visible (which
 *     would violate the no-visual-regression invariant).
 *
 * Excluded from the walk:
 *   - `__tests__` and `__mocks__` directories
 *   - `src/theme/tokens/` itself (defines the tokens, comments and types
 *     legitimately reference the names)
 *   - `src/utils/theme.ts` and `src/hooks/useTheme.ts` (the builder + hook
 *     legitimately reference `theme.typography.*` etc. in comments)
 *   - `src/utils/types.ts` (defines the Theme interface)
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..', '..', '..', 'src');

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === '__tests__' || entry.name === '__mocks__') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip JS/TS comments (line + block) so we only assert on code, not
 * comments that may reference names by intent (e.g. `// removed in a
 * later cleanup phase once consumers migrate to theme.typography.*`).
 */
function stripComments(src: string): string {
  // Order matters: block comments first to avoid clobbering URLs in
  // line-comment-stripping.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\/])\/\/.*$/gm, '$1');
}

describe('design-token grep invariants', () => {
  describe('x1 is gone (no x1Theme / AppTheme.X1 / colorScheme === "x1")', () => {
    const files = listFiles(SRC);

    it('walks at least one file (sanity check)', () => {
      // Guards against an empty walk silently making the assertion vacuous.
      expect(files.length).toBeGreaterThan(50);
    });

    it('no production file references x1Theme, AppTheme.X1, or "x1" colorScheme', () => {
      const offenders: Array<{file: string; match: string}> = [];
      // Tightly scoped regex to avoid false positives like
      // `x1FooBar`, `Mx1`, or path fragments. Each branch is a known
      // hit shape: `x1Theme`, `AppTheme.X1`, or the literal string `'x1'`.
      const patterns: RegExp[] = [
        /\bx1Theme\b/,
        /\bAppTheme\s*\.\s*X1\b/,
        /['"]x1['"]/,
      ];
      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf-8');
        const code = stripComments(raw);
        for (const re of patterns) {
          const match = code.match(re);
          if (match) {
            offenders.push({file, match: match[0]});
            break;
          }
        }
      }
      if (offenders.length > 0) {
        const detail = offenders
          .map(o => `  - ${path.relative(SRC, o.file)}: ${o.match}`)
          .join('\n');
        throw new Error(`x1 references found:\n${detail}`);
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('no production consumer of new token surface yet', () => {
    // Allow-listed files that legitimately reference the new keys:
    //   - the tokens module itself
    //   - the theme builder (`theme.ts`) and the hook (`useTheme.ts`)
    //   - the Theme interface (`types.ts`)
    //   - the DS layer at `components/ui/**` — canonical consumer of
    //     the new token surface.
    const ALLOWED_RELATIVE: ReadonlyArray<string> = [
      'theme/tokens',
      'utils/theme.ts',
      'utils/types.ts',
      'hooks/useTheme.ts',
      'components/ui',
      // First feature surface consuming the new token axes. Future
      // screens land alongside; do not relax this allow-list without a
      // matching architecture-doc note.
      'screens/OnboardingScreens',
      // Download overlay (banner + sheet + progress card) introduces the
      // pal-facing "in flight" surface using the same Figma token set as
      // onboarding; lives at app-level above the navigator.
      'components/DownloadOverlay',
      'components/DownloadProgressCard',
      // UI 统一+设计语言升级波（DESIGN_SPEC §7）：AIOS 四屏 + 生图域 +
      // 状态横幅/状态条/markdown 图片渲染迁移到 token 表面。
      'screens/ToolScreen',
      'screens/WorkspaceScreen',
      'screens/KnowledgeScreen',
      'screens/MemoryScreen',
      'screens/ImageGenScreen',
      'components/ActiveTaskBanner',
      'components/MarkdownView',
      // 同波散点字号 token 化（A3）
      'screens/ChatScreen',
      'screens/GenerationSettingsScreen',
      // v3.8 系统设置页（语言+色彩模式三选）归位 token 表面
      'screens/SystemSettingsScreen',
      'components/ChatHeader',
      'components/ImageTaskActions',
      // 生图进度内嵌动效（ImageTaskProgress，08-16 聊天全流程动效）：radius token 消费
      'components/ImageTaskProgress',
      // P0 净化（2026-08-17）：调度错误卡（TaskErrorCard）与任务卡同类，
      // 统一 danger 语义 token 消费（SPEC §3.3 error 叙事落地）
      'components/TaskErrorCard',
      // B2：设置页入口中心卡片化（IconTile + 分组 Surface）
      'screens/SettingsScreen',
      // B4：排版升级（displayS 大标题 / numericM 数字强调）
      'components/ChatEmptyPlaceholder',
      'screens/BenchmarkScreen',
      // 聊天发送按钮品牌化（圆形 primary + radius.full）
      'components/SendButton',
      // C2 色彩审计：AIOS 扫描状态栏内联样式 token 化（surfaceVariant/captionS）
      'screens/ModelsScreen',
      // B1 聊天视觉再定稿（DESIGN_SPEC §8 Gap Ledger B1）：气泡一体化 footer 收进卡片 +
      // 灰色分层 + 聊天消息层 borderRadius/legacy fonts 双轨收口 → radius/typography token。
      'components/TextMessage',
      'components/FileMessage',
      'components/ImageMessage',
      'components/ChatInput',
      'components/ChatView',
      'components/LoadingBubble',
      'components/ResponseBubble',
      'components/ThinkingBubble',
      'components/HtmlPreviewBubble',
      'components/GreetingBubble',
      'components/Menu',
      'components/ChatPalModelPickerSheet',
      'components/SuggestedPromptsRow',
      'components/ChatGenerationSettingsSheet',
      // B15 模型目录管理页（ADR-0004 双轨）：token 表面消费
      'screens/ModelDirsScreen',
      // B18 §17 → §18.2：每输出指标行并入 AssistantTurnFooter（双行合并），token 表面消费
      'components/AssistantTurnFooter',
      // §18.4 发送钮双态/停止钮重绘（批次B）：token 表面消费
      'components/StopButton',
      // B23 浮层与横幅体系收敛：RenameModal 迁 OverlayCard 底座（stroke/radius/typography token）
      'components/RenameModal',
    ];
    const files = listFiles(SRC).filter(f => {
      const rel = path.relative(SRC, f).replace(/\\/g, '/');
      return !ALLOWED_RELATIVE.some(allow => rel.startsWith(allow));
    });

    const offendingPattern = /\btheme\s*\.\s*(typography|radius|stroke)\s*\./;

    it('walks at least one file (sanity check)', () => {
      expect(files.length).toBeGreaterThan(50);
    });

    it('no production file outside the allow-list reads theme.typography/radius/stroke', () => {
      const offenders: Array<{file: string; match: string}> = [];
      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf-8');
        const code = stripComments(raw);
        const match = code.match(offendingPattern);
        if (match) {
          offenders.push({file, match: match[0]});
        }
      }
      if (offenders.length > 0) {
        const detail = offenders
          .map(o => `  - ${path.relative(SRC, o.file)}: ${o.match}`)
          .join('\n');
        throw new Error(
          `New token surface has unexpected consumers ` +
            `in this slice (invisible foundation should have zero):\n${detail}\n\n` +
            `If this is intentional (a follow-up restyle slice landing in ` +
            `the same PR), update the allow-list in invariants.test.ts.`,
        );
      }
      expect(offenders).toEqual([]);
    });
  });
});
