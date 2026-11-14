// ============================================================
// 沙盘布局与建筑清单派生：纯函数（UI 只渲染，永远可由 state 重绘）
// 6×6 地块网格：县治居中、3 村 + 1 安置点散布。
// ============================================================
import type { DraftState, GameState } from '../types';
import { config } from '../../config';

export const GRID = { w: 6, h: 6 };
export const COUNTY_CELL: [number, number] = [3, 3];
export const VILLAGE_CELLS: Record<string, [number, number]> = {
  v_yunxi: [1, 2], // 云溪村
  v_wuling: [4, 2], // 雾岭村
  v_qingshi: [2, 4], // 青石村
};
export const SITE_CELLS: Record<string, [number, number]> = {
  s_xinping: [4, 4], // 新坪安置点
};

export type CellOwner = { kind: 'village' | 'site' | 'county' | 'ground'; refId: string | null };

/** 地块归属：村庄 > 安置点 > 县治 > 空地 */
export function cellOwner(x: number, y: number): CellOwner {
  for (const [refId, [cx, cy]] of Object.entries(VILLAGE_CELLS)) {
    if (cx === x && cy === y) return { kind: 'village', refId };
  }
  for (const [refId, [cx, cy]] of Object.entries(SITE_CELLS)) {
    if (cx === x && cy === y) return { kind: 'site', refId };
  }
  if (COUNTY_CELL[0] === x && COUNTY_CELL[1] === y) return { kind: 'county', refId: null };
  return { kind: 'ground', refId: null };
}

export type SandboxBuildingKind = 'villageHall' | 'greenhouse' | 'factory' | 'solar' | 'workshop';

export interface SandboxObject {
  id: string;
  kind: SandboxBuildingKind;
  villageId: string;
  cell: [number, number];
  h: number; // 抬高（地面坐标）
  status: 'permanent' | 'preview';
  cursed?: boolean; // 补贴诅咒牌：红笔批注
  label: string;
}

/** 项目 → 建筑外形（按项目 id 定制，缺省按措施类型）；logistics.ts 据此判「工厂型」 */
export const PROJECT_KIND_MAP: Record<string, SandboxBuildingKind> = {
  p_yunxi_herb: 'greenhouse',
  p_wuling_chicken: 'workshop',
  p_qingshi_fruit: 'factory',
  p_xinping_workshop: 'factory',
  p_wuling_solar: 'solar',
  p_county_ecom: 'workshop',
};

/** 政策卡 → 落子预览建筑 */
const CARD_KIND: Record<string, SandboxBuildingKind> = {
  b_subsidy: 'greenhouse',
  b_workrelief: 'workshop',
  b_coop: 'villageHall',
  c_consumption: 'factory',
  d_collective: 'workshop',
  e_service: 'villageHall',
};

/** 沙盘建筑清单：现有项目（永久）+ 本回合落卡（半透明预览） */
export function deriveSandboxObjects(state: GameState, draft: DraftState): SandboxObject[] {
  const out: SandboxObject[] = [];

  // 永久建筑：现有项目
  for (const p of state.projects) {
    const cell = VILLAGE_CELLS[p.villageId] ?? [3, 3];
    const kind = PROJECT_KIND_MAP[p.id] ?? (p.measureId === 'industry' ? 'greenhouse' : 'workshop');
    const h = 0.18 + Math.min(0.3, (p.invested / 40) * 0.12); // 投资越大楼越高
    out.push({
      id: `p_${p.id}`,
      kind,
      villageId: p.villageId,
      cell,
      h,
      status: p.status === 'broken' ? 'permanent' : 'permanent',
      cursed: p.subsidyDependence >= 60,
      label: p.name,
    });
  }

  // 本回合预览：政策卡指派到村的落子
  for (const slot of Object.values(draft.slots)) {
    if (!slot || !slot.villageId) continue;
    const kind = CARD_KIND[slot.cardId];
    if (!kind) continue;
    const cell = VILLAGE_CELLS[slot.villageId] ?? [3, 3];
    const spec = config.policies.find((p) => p.id === slot.cardId);
    out.push({
      id: `preview_${slot.cardId}_${slot.villageId}`,
      kind,
      villageId: slot.villageId,
      cell,
      h: 0.22,
      status: 'preview',
      cursed: spec?.curse ?? false,
      label: '本回合',
    });
  }
  return out;
}
