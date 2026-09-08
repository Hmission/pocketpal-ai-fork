/**
 * 队列/模型徽章与胶囊摘要的显示契约（2026-09-07 CHAIN_AUDIT W5）。
 *
 * 立这三条测的原因：本波把「族 → 显示名」「族 → 徽章色」「N 项 · M 抽」三处
 * 双份事实源收为单点，收口的正确性此前只有真机肉眼可验（设备不在线时无法复核）。
 * 这里把用户可见结果钉住：显示名不再打内部族键、各族色值互不相同、摘要只一种拼法。
 */
import {lightColors} from '../../../theme/tokens/colors';
import type {ModelFamily} from '../../../utils/imageGenManifest';
import {BUILTIN_MANIFESTS} from '../../../utils/imageGenManifest';
import type {Theme} from '../../../utils/types';
import {
  FAMILY_BADGE,
  FAMILY_BADGE_TOKEN,
  familyBadgeColor,
  familyBadgeLabel,
  formatQueueSummary,
  modalityBadge,
} from '../constants';

const theme = {colors: lightColors} as Theme;

const FAMILIES = Object.keys(FAMILY_BADGE_TOKEN) as ModelFamily[];

describe('模型族徽章显示契约（单点，UI_SPEC §3）', () => {
  it('显示名与模型下拉同源，不再打内部族键', () => {
    // 旧写法：QueuePanel 直接打 item.snapshot.family → 屏上出现 `sd3`/`zimage`
    expect(familyBadgeLabel('sd3')).toBe('SD3.5');
    expect(familyBadgeLabel('zimage')).toBe('Z-Image');
  });

  it('每个已知族都有非空显示名（classic 与未知键回落原始键名，不出现空徽章）', () => {
    for (const family of FAMILIES) {
      expect(familyBadgeLabel(family).length).toBeGreaterThan(0);
    }
    // 持久化边界可能落下历史/未知族键：不抛、不空，退回原样
    expect(familyBadgeLabel('some_future_family')).toBe('some_future_family');
  });

  it('显示名表与色表覆盖同一族集合（新增族必须两张表同时登记）', () => {
    expect(Object.keys(FAMILY_BADGE).sort()).toEqual(
      Object.keys(FAMILY_BADGE_TOKEN).sort(),
    );
  });

  it('族色取自已登记 token，且各族色值互不相同（副本漂移会撞色）', () => {
    const colored = FAMILIES.filter(f => FAMILY_BADGE_TOKEN[f] !== null);
    for (const family of colored) {
      expect(familyBadgeColor(theme, family)).toBe(
        theme.colors[FAMILY_BADGE_TOKEN[family]!],
      );
    }
    const distinct = new Set(colored.map(f => familyBadgeColor(theme, f)));
    expect(distinct.size).toBe(colored.length);
  });

  it('未登色族与未知族回落 info（不抛不猜色）', () => {
    expect(familyBadgeColor(theme, 'classic')).toBe(theme.colors.info);
    expect(familyBadgeColor(theme, '')).toBe(theme.colors.info);
  });

  // 视频模态契约（VIDEO_GEN_SPEC §9.2，2026-09-08）：模态是模型属性的投影，不是新 tab。
  it('模态徽章单点派生：图片不占屏，视频只给一个短标记', () => {
    expect(modalityBadge({})).toBe('');
    expect(modalityBadge({modality: 'image'})).toBe('');
    expect(modalityBadge({modality: 'video'})).toBe('视');
  });

  it('视频条目已登记，则其族徽章与色 token 必须同波在册（不得无名/无色族上屏）', () => {
    // 上窗反向断言（不得有 video 条目）已随 P1 登记完成而作废：现在钉的是「登记就必预徽章」
    const videos = BUILTIN_MANIFESTS.filter(m => m.modality === 'video');
    expect(videos.length).toBeGreaterThan(0);
    for (const m of videos) {
      expect(FAMILY_BADGE[m.family]).toBeTruthy();
      expect(FAMILY_BADGE_TOKEN[m.family]).toBeTruthy();
    }
    expect(FAMILY_BADGE.wan).toBe('Wan');
    expect(FAMILY_BADGE_TOKEN.wan).toBe('badgeWan');
  });
});

describe('队列摘要拼法契约（QUEUE_SPEC §七）', () => {
  it('项数与抽数同时出现，固定一种格式', () => {
    expect(formatQueueSummary(2, 5)).toBe('2 项 · 5 抽');
  });

  it('零值不特殊化（旧写法靠字符串缺失静默换成另一种文案）', () => {
    expect(formatQueueSummary(0, 0)).toBe('0 项 · 0 抽');
  });
});
