import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { iso, unproject, extrude, groundBounds } from '../src/core/sandbox/iso';
import { cellOwner, VILLAGE_CELLS, SITE_CELLS, deriveSandboxObjects } from '../src/core/sandbox/sandboxObjects';
import { canDrop } from '../src/core/sandbox/dropRules';
import { paperStackCount } from '../src/core/sandbox/paperStacks';
import type { DraftState } from '../src/core/types';

function baseDraft(): DraftState {
  return {
    slots: {},
    targetingLevel: 'village',
    fiscal: 0,
    coop: 0,
    commitment: 'standard',
    dispatch: [],
    householdMeasures: [],
    assessment: { density: 30, thirdParty: 10, directReport: 10 },
    investigate: [],
    repair: [],
    acceptProposal: [],
    resettle: [],
    coopChoose: [],
    skills: [],
    cadreAssignments: [],
    surveyVillages: [],
    eventDecisions: [],
    nodeActions: [],
    staminaSpent: 0,
  };
}

describe('等距沙盘：投影与地形', () => {
  it('iso 往返 unproject 可逆（误差 < 0.01）', () => {
    for (const [x, y] of [
      [0, 0],
      [3, 3],
      [5, 2],
    ] as [number, number][]) {
      const [sx, sy] = iso(x, y);
      const [rx, ry] = unproject(sx, sy);
      expect(Math.abs(rx - x)).toBeLessThan(0.01);
      expect(Math.abs(ry - y)).toBeLessThan(0.01);
    }
  });

  it('6×6 网格包围盒尺寸正确', () => {
    const b = groundBounds(6, 6);
    expect(b.width).toBeGreaterThan(600);
    expect(b.height).toBeGreaterThan(300);
  });

  it('extrude 产出墙与屋顶路径', () => {
    const { walls, roof } = extrude(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      0.3
    );
    expect(walls).toContain('M');
    expect(roof).toContain('Z');
  });

  it('cellOwner：三村/安置点/县治各归其位', () => {
    expect(cellOwner(3, 3).kind).toBe('county');
    expect(cellOwner(VILLAGE_CELLS.v_yunxi[0], VILLAGE_CELLS.v_yunxi[1])).toEqual({ kind: 'village', refId: 'v_yunxi' });
    expect(cellOwner(SITE_CELLS.s_xinping[0], SITE_CELLS.s_xinping[1])).toEqual({ kind: 'site', refId: 's_xinping' });
    expect(cellOwner(0, 0).kind).toBe('ground');
  });
});

describe('等距沙盘：建筑清单派生', () => {
  it('现有项目生成永久建筑，落卡生成预览建筑', () => {
    const state = createInitialState(0, 'returningStudent');
    const draft = baseDraft();
    draft.slots.industry = { cardId: 'b_subsidy', villageId: 'v_qingshi' };
    const objs = deriveSandboxObjects(state, draft);
    const perms = objs.filter((o) => o.status === 'permanent');
    const previews = objs.filter((o) => o.status === 'preview');
    expect(perms.length).toBeGreaterThanOrEqual(3); // 3 active + 3 stalled 项目
    expect(previews.length).toBe(1);
    expect(previews[0].kind).toBe('greenhouse');
    expect(previews[0].cursed).toBe(true); // b_subsidy 是补贴诅咒牌
  });
});

describe('等距沙盘：拖拽落子规则', () => {
  it('党建卡可落县治，产业卡必须落村', () => {
    const state = createInitialState(0, 'entrusted');
    // party 卡 → 县治 OK
    expect(canDrop({ kind: 'card', slot: 'party', cardId: 'a_dispatch' }, { kind: 'county', refId: null }, state).ok).toBe(true);
    // industry 卡 → 县治 拒绝
    expect(canDrop({ kind: 'card', slot: 'industry', cardId: 'b_subsidy' }, { kind: 'county', refId: null }, state).ok).toBe(false);
    // 未解锁卡拒绝（b_subsidy 在 A 阶段未解锁）
    expect(canDrop({ kind: 'card', slot: 'industry', cardId: 'b_subsidy' }, { kind: 'village', refId: 'v_wuling' }, state).ok).toBe(false);
  });

  it('干部可拖到村或县治，不可拖到空地', () => {
    const state = createInitialState(0, 'local');
    expect(canDrop({ kind: 'cadre', cadreId: 'cad_chen' }, { kind: 'village', refId: 'v_wuling' }, state).ok).toBe(true);
    expect(canDrop({ kind: 'cadre', cadreId: 'cad_chen' }, { kind: 'county', refId: null }, state).ok).toBe(true);
    expect(canDrop({ kind: 'cadre', cadreId: 'cad_chen' }, { kind: 'ground', refId: null }, state).ok).toBe(false);
  });
});

describe('等距沙盘：迎检文件堆', () => {
  it('无负担=0 堆，负担越高堆越多，封顶 4', () => {
    const state = createInitialState(0, 'returningStudent');
    state.county.inspectionBurden = 0;
    expect(paperStackCount(state)).toBe(0);
    state.county.inspectionBurden = 25;
    expect(paperStackCount(state)).toBe(2);
    state.county.inspectionBurden = 90;
    expect(paperStackCount(state)).toBe(4);
  });
});
