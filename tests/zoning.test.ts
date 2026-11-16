// ============================================================
// 规划画区（Zoning）+ 数据图层透视（Info Views）核心层测试
// ============================================================
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import {
  applyZoningActions,
  cellKindAt,
  deriveZoningCells,
  isZoned,
  isZonableCell,
} from '../src/core/sandbox/zoning';
import { deriveGovernanceLayer, derivePovertyLayer, povertyHeat } from '../src/core/sandbox/infoViews';
import { serialize, deserialize } from '../src/core/save';
import type { RoundActions, ZoningCell } from '../src/core/types';

function idleActions(): RoundActions {
  return {
    cards: [],
    targetingLevel: 'village',
    fiscal: 0,
    coop: 0,
    dispatch: [],
    householdMeasures: [],
  };
}

describe('规划画区（Zoning）', () => {
  it('框选动作并入已规划列表：同格后规划覆盖先规划', () => {
    const base: ZoningCell[] = [{ x: 1, y: 1, kind: 'agri' }];
    const out = applyZoningActions(base, [
      { kind: 'industry', cells: [{ x: 2, y: 2 }, { x: 1, y: 1 }] },
      { kind: 'resettle', cells: [{ x: 2, y: 2 }] },
    ]);
    expect(cellKindAt(out, 1, 1)).toBe('industry');
    expect(cellKindAt(out, 2, 2)).toBe('resettle');
    expect(isZoned(out, 1, 1)).toBe(true);
    expect(isZoned(out, 3, 3)).toBe(false);
    expect(out.length).toBe(2);
  });

  it('非法格与空动作被跳过', () => {
    expect(isZonableCell(-1, 0)).toBe(false);
    expect(isZonableCell(0, 0)).toBe(true);
    expect(isZonableCell(5, 5)).toBe(true);
    expect(isZonableCell(6, 0)).toBe(false);
    expect(applyZoningActions([], undefined)).toEqual([]);
    expect(applyZoningActions([], [{ kind: 'agri', cells: [] }])).toEqual([]);
    const out = applyZoningActions([], [{ kind: 'agri', cells: [{ x: 9, y: 9 }, { x: 0, y: 0 }] }]);
    expect(out.length).toBe(1);
    expect(cellKindAt(out, 0, 0)).toBe('agri');
  });

  it('结算后写入 state.zoning，并可按用途分组派生', () => {
    const state = createInitialState(42, 'entrusted');
    const out = playRound(state, { ...idleActions(), zoning: [
      { kind: 'agri', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
      { kind: 'resettle', cells: [{ x: 5, y: 5 }] },
    ] });
    expect(out.state.zoning.length).toBe(3);
    const groups = deriveZoningCells(out.state.zoning);
    expect(groups.agri.length).toBe(2);
    expect(groups.resettle.length).toBe(1);
    expect(groups.industry.length).toBe(0);
  });

  it('存档序列化往返保留规划（v4）', () => {
    const state = createInitialState(7, 'local');
    state.zoning = [{ x: 2, y: 2, kind: 'industry' }];
    const back = deserialize(serialize(state));
    expect(back.version).toBe(15);
    expect(back.zoning).toEqual([{ x: 2, y: 2, kind: 'industry' }]);
  });
});

describe('数据图层透视（Info Views）', () => {
  it('致贫原因层：未摸排村不泄露热力', () => {
    const state = createInitialState(42, 'entrusted');
    // 开局所有村未摸排 → 热力全空
    const layer = derivePovertyLayer(state);
    expect(layer.size).toBe(0);
    // 摸排云溪村（1,2）后该村格有热力
    const out = playRound(state, { ...idleActions(), surveyVillages: ['v_yunxi'] });
    const heat = povertyHeat(out.state, 1, 2);
    expect(heat).toBeTruthy();
    // 未摸排村仍无
    expect(povertyHeat(out.state, 4, 2)).toBeNull();
    expect(povertyHeat(out.state, 3, 3)).toBeNull(); // 县治格永远无热力
  });

  it('内生治理层：未摸排村无热力、摸排后强村显绿弱村显红', () => {
    const state = createInitialState(42, 'entrusted');
    const out = playRound(state, { ...idleActions(), surveyVillages: ['v_yunxi', 'v_wuling'] });
    const layer = deriveGovernanceLayer(out.state);
    const cells = layer.filter((c) => c.heat);
    expect(cells.length).toBeGreaterThanOrEqual(2);
    // 云溪村内生治理低（约 20）→ 弱档（红）
    const yunxi = layer.find((c) => c.x === 1 && c.y === 2);
    expect(yunxi?.heat).toBe('#B33A2B');
    // 未摸排的青石村无热力（deriveGovernanceLayer 只返回有热力的格）
    expect(layer.find((c) => c.x === 2 && c.y === 4)).toBeUndefined();
  });
});
