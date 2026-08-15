/**
 * Shape-language invariants (DESIGN_SPEC §4 — 形状语言与材质).
 *
 * Locks the canonical role→token map (`shapeRoles`) and the radius scale so
 * that a given shape role ALWAYS resolves to one radius value (同角色同值).
 * Components resolve corners via `radius[shapeRoles.<role>]`; this test pins
 * both the scale and the role map so a silent drift (renaming a role,
 * retargeting it to a different token, or rescaling a step) fails the build.
 *
 * Note: this invariant locks the canonical source. Legacy raw-numeric
 * `borderRadius` in the chat-message layer (gifted-chat-derived) is tracked
 * as CHAT_UI_SPEC debt and migrated per-track, not grep-enforced here.
 */
import {radius, shapeRoles, ShapeRole} from '../radius';

describe('shape language invariants (DESIGN_SPEC §4 — 同角色同值)', () => {
  it('radius scale matches the spec px values', () => {
    expect(radius).toEqual({
      none: 0,
      xxs: 2,
      xs: 4,
      s: 8,
      m: 12,
      ml: 16,
      l: 20,
      xl: 32,
      xxl: 40,
      full: 999,
    });
  });

  it('every shape role maps to an existing radius key', () => {
    const roles = Object.keys(shapeRoles) as ShapeRole[];
    expect(roles.length).toBeGreaterThanOrEqual(8);
    for (const role of roles) {
      const key = shapeRoles[role];
      expect(Object.prototype.hasOwnProperty.call(radius, key)).toBe(true);
    }
  });

  it('canonical role→value mapping is stable (同角色同值)', () => {
    // Each role resolves to exactly the documented px value.
    expect(radius[shapeRoles.card]).toBe(20); // 内容卡片 l(20)
    expect(radius[shapeRoles.surface]).toBe(32); // 浮层表面 xl(32)
    expect(radius[shapeRoles.rectangle]).toBe(0); // 分隔线/全幅媒体 none(0)
    expect(radius[shapeRoles.pill]).toBe(999); // 胶囊 full(999)
    expect(radius[shapeRoles.secondary]).toBe(16); // 次级容器 ml(16)
    expect(radius[shapeRoles.inputSmall]).toBe(8); // 输入框本体 s(8)
    expect(radius[shapeRoles.iconTile]).toBe(12); // IconTile m(12)
    expect(radius[shapeRoles.circle]).toBe(999); // 头像/FAB full(999)
  });

  it('pill and circle share the same value (both full) — circular roles are unambiguous', () => {
    expect(shapeRoles.pill).toBe(shapeRoles.circle);
    expect(radius[shapeRoles.pill]).toBe(radius[shapeRoles.circle]);
  });
});
