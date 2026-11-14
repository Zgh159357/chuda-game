// ============================================================
// 规划画区（Zoning）纯函数 —— 主控提示词：拖拽框选地块规划用途
// 逻辑与 UI 分离：UI 只产生 ZoningAction，结算时由此处并入 state.zoning；
// 渲染永远由 state.zoning 派生重绘。
// ============================================================
import type { GameState, ZoningAction, ZoningCell, ZoningKind } from '../types';
import { GRID } from './sandboxObjects';

/** 某格当前的规划用途（未规划 = null） */
export function cellKindAt(zoning: ZoningCell[], x: number, y: number): ZoningKind | null {
  return zoning.find((c) => c.x === x && c.y === y)?.kind ?? null;
}

/** 合法地块校验：网格内且未被村庄/县治/安置点专用格占用 */
export function isZonableCell(x: number, y: number): boolean {
  return x >= 0 && x < GRID.w && y >= 0 && y < GRID.h;
}

/**
 * 把一回合的规划动作并入已规划列表（纯函数，无副作用）。
 * 规则：后规划覆盖先规划（同格同类去重、同格异类换用途）；cells 空数组跳过。
 */
export function applyZoningActions(
  current: ZoningCell[],
  actions: ZoningAction[] | undefined,
): ZoningCell[] {
  if (!actions || actions.length === 0) return current;
  const byKey = new Map<string, ZoningCell>();
  for (const c of current) byKey.set(`${c.x},${c.y}`, c);
  for (const act of actions) {
    for (const cell of act.cells) {
      if (!isZonableCell(cell.x, cell.y)) continue;
      byKey.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y, kind: act.kind });
    }
  }
  return [...byKey.values()];
}

/** 结算入口：并入 state.zoning 并回写（reducer 调用） */
export function settleZoning(state: GameState, actions: ZoningAction[] | undefined): void {
  state.zoning = applyZoningActions(state.zoning, actions);
}

/** 派生：按用途分组的规划格（渲染用：同用途一块画填充与边界） */
export function deriveZoningCells(zoning: ZoningCell[]): Record<ZoningKind, ZoningCell[]> {
  const out: Record<ZoningKind, ZoningCell[]> = { agri: [], industry: [], resettle: [] };
  for (const c of zoning) out[c.kind].push(c);
  return out;
}

/** 派生：某格是否已规划（任意用途） */
export function isZoned(zoning: ZoningCell[], x: number, y: number): boolean {
  return zoning.some((c) => c.x === x && c.y === y);
}
