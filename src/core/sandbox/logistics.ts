// ============================================================
// 物流网络与产业链（Logistics）纯函数 —— 主控提示词第七节
// 地块不是孤立的：道路连通性 + 物流覆盖 + 产业链闭环。
// 工厂型项目缺任一环节 → 直接判定烂尾并扣财政（一次性）。
// ============================================================
import type { GameState, Tile, ZoningCell } from '../types';
import type { TurnCtx } from '../systems/context';
import { wonderBuilt } from '../systems/wonders';
import {
  COUNTY_CELL,
  SITE_CELLS,
  VILLAGE_CELLS,
  PROJECT_KIND_MAP,
} from './sandboxObjects';

const GRID_W = 6;
const GRID_H = 6;

/** 基础道路格：村庄 / 县治 / 安置点 */
function isBaseRoadCell(x: number, y: number): boolean {
  for (const [, [cx, cy]] of Object.entries(VILLAGE_CELLS)) if (cx === x && cy === y) return true;
  for (const [, [cx, cy]] of Object.entries(SITE_CELLS)) if (cx === x && cy === y) return true;
  if (COUNTY_CELL[0] === x && COUNTY_CELL[1] === y) return true;
  return false;
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function adjacentRoaded(x: number, y: number, roadSet: Set<string>): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of dirs) {
    if (roadSet.has(keyOf(x + dx, y + dy))) return true;
  }
  return false;
}

/** 道路集合：基础格 + 手动修的路 + 紧邻道路的已规划格（固定点迭代，机耕道延伸） */
export function deriveRoadSet(state: GameState): Set<string> {
  // 奇观「跨山大桥」：全县路网贯通
  if (wonderBuilt(state, 'w_bridge')) {
    const all = new Set<string>();
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) all.add(keyOf(x, y));
    return all;
  }
  const zonedKeys = new Set(state.zoning.map((z) => keyOf(z.x, z.y)));
  const road = new Set<string>();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (isBaseRoadCell(x, y)) road.add(keyOf(x, y));
    }
  }
  for (const r of state.extraRoads) road.add(keyOf(r.x, r.y));
  // 规划格自动延伸：紧邻道路格即通机耕道
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of zonedKeys) {
      if (road.has(k)) continue;
      const [x, y] = k.split(',').map(Number);
      if (adjacentRoaded(x, y, road)) {
        road.add(k);
        changed = true;
      }
    }
  }
  return road;
}

/** 单格是否通公路 */
export function roadAt(state: GameState, x: number, y: number): boolean {
  return deriveRoadSet(state).has(keyOf(x, y));
}

/** 单格是否被物流覆盖（物流站建成 + 通公路） */
export function logisticsCoveredAt(state: GameState, x: number, y: number): boolean {
  return state.county.logisticsStation && roadAt(state, x, y);
}

/** 派生全部地块（Tile：道路/物流覆盖/规划用途） */
export function deriveTiles(state: GameState): Tile[] {
  const road = deriveRoadSet(state);
  const zoned = new Map(state.zoning.map((z: ZoningCell) => [keyOf(z.x, z.y), z.kind]));
  const tiles: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const k = keyOf(x, y);
      const roaded = road.has(k);
      tiles.push({
        x,
        y,
        road: roaded,
        logisticsCovered: state.county.logisticsStation && roaded,
        zoningKind: zoned.get(k) ?? null,
      });
    }
  }
  return tiles;
}

export type ChainLink = 'supply' | 'road' | 'logistics';

/** 工厂型项目的产业链闭环判定：原料（通公路的农业规划区）+ 道路 + 物流站 */
export function chainStatus(state: GameState, projectId: string): { ok: boolean; missing: ChainLink[] } {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return { ok: true, missing: [] };
  const kind = PROJECT_KIND_MAP[project.id];
  if (kind !== 'factory') return { ok: true, missing: [] };

  const missing: ChainLink[] = [];
  // 原料：至少一块已规划农业区且通公路
  const road = deriveRoadSet(state);
  const hasSupply = state.zoning.some((z) => z.kind === 'agri' && road.has(keyOf(z.x, z.y)));
  if (!hasSupply) missing.push('supply');
  // 道路：项目所在村格通公路（基础格恒通；此处校验完整性）
  const cell = VILLAGE_CELLS[project.villageId];
  if (cell && !road.has(keyOf(cell[0], cell[1]))) missing.push('road');
  // 销路：县级物流站
  if (!state.county.logisticsStation) missing.push('logistics');
  return { ok: missing.length === 0, missing };
}

/**
 * 物流结算（reducer 在 industry 之后调用）：
 * B 阶段起（round≥5），工厂型项目产业链不闭环 → 烂尾 + 财政 −5（一次性）。
 */
export function applyLogistics(state: GameState, ctx: TurnCtx): void {
  if (ctx.round < 5) return;
  for (const p of state.projects) {
    if (PROJECT_KIND_MAP[p.id] !== 'factory') continue;
    if (p.status !== 'active') continue;
    const st = chainStatus(state, p.id);
    if (st.ok) continue;
    p.status = 'stalled';
    state.county.fiscalFund = Math.max(0, state.county.fiscalFund - 5);
    ctx.pushEvent({
      type: 'chainStall',
      round: ctx.round,
      textId: 'chain_stall_1',
      projectId: p.id,
      missing: st.missing,
    });
    ctx.pushLedger('cost', `chain_${p.id}`, -5, `${p.name} 产业链断裂`);
    ctx.addStars(-10);
  }
}
