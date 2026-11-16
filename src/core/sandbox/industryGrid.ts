// ============================================================
// §20 产业网格沙盒 —— 纯函数构建器（src/core/sandbox/industryGrid.ts）
// 由 GameState 派生全县产业网格（规格 IndustryState）：
//  - tiles：6×6 网格快照（村格=主产业设施、县格=冷链中枢、路网=道路基建）
//  - connectedEdges：路网相邻对（无向图）
//  - totalMaintenanceCost / totalDebtInterest：基建吞金兽的两笔账
// 口径说明（虚构数据）：每村一个代表格，tile.facility 取该村主产业
// （projects ∪ builtNodes 中 baseOutput 最高者）；版画沙盘的多建筑
// 渲染不受此影响。基建的维护费按设施条目加总，贷款利息按全县债务折算。
// ============================================================
import type { GameState } from '../types';
import type { EnvironmentTraits as SpecEnv, Facility, FacilityType, IndustryState, Infrastructure, Tile } from '../../types/game';
import { terrainToType } from '../../types/game';
import { GRID, COUNTY_CELL, SITE_CELLS, VILLAGE_CELLS, cellOwner } from './sandboxObjects';
import { roadAt } from './logistics';
import { PROJECT_TAG_MAP, industryNodes } from '../../config/industry';
import { config } from '../../config';
import { DEFAULT_ENVIRONMENT } from '../calculations';

/** 设施类型 → 污染增量（虚构口径：工厂高、农田负、物流电商中低） */
const POLLUTION_BY_TYPE: Record<FacilityType, number> = {
  farm: -2,
  factory: 8,
  logistics: 2,
  ecommerce: 1,
};

/** 产业标签 → 规格设施类型（energy 并入 factory，污染为 0） */
function facilityTypeOfTag(tag: string): FacilityType {
  switch (tag) {
    case 'primary_agri':
      return 'farm';
    case 'processing':
    case 'energy':
      return 'factory';
    case 'logistics':
      return 'logistics';
    case 'service':
    default:
      return 'ecommerce';
  }
}

/** 项目 → 规格设施 */
export function facilityFromProject(state: GameState, projectId: string): Facility | null {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p || p.status === 'broken') return null;
  const tags = PROJECT_TAG_MAP[p.id] ?? ['primary_agri'];
  const type = facilityTypeOfTag(tags[0]);
  const pollution = tags.includes('energy') ? 0 : POLLUTION_BY_TYPE[type];
  return {
    id: `fac_${p.id}`,
    type,
    name: p.name,
    baseOutput: p.effectBase,
    laborRequired: config.balance.population.laborPerProject,
    pollutionDelta: pollution,
  };
}

/** 自建产业设施 → 规格设施 */
export function facilityFromBuiltNode(state: GameState, nodeId: string): Facility | null {
  const spec = industryNodes.find((n) => n.id === nodeId);
  if (!spec) return null;
  const tags = spec.tags;
  const type = facilityTypeOfTag(tags[0]);
  const pollution = tags.includes('energy') ? 0 : POLLUTION_BY_TYPE[type];
  return {
    id: `fac_${nodeId}`,
    type,
    name: spec.name,
    baseOutput: spec.baseOutput,
    laborRequired: config.balance.population.laborPerProject,
    pollutionDelta: pollution,
  };
}

/** 某村的主产业设施（项目与自建设施中产出最高者） */
export function primaryFacilityOf(state: GameState, villageId: string): Facility | null {
  const candidates: Facility[] = [];
  for (const p of state.projects) {
    if (p.villageId === villageId) {
      const f = facilityFromProject(state, p.id);
      if (f) candidates.push(f);
    }
  }
  for (const b of state.builtNodes) {
    if (b.villageId === villageId) {
      const f = facilityFromBuiltNode(state, b.nodeId);
      if (f) candidates.push(f);
    }
  }
  candidates.sort((a, b) => b.baseOutput - a.baseOutput);
  return candidates[0] ?? null;
}

/** 网格坐标 → 所属方 id（村 id / 'county' / 'site:<id>' / ''） */
export function ownerIdOf(x: number, y: number): string {
  const owner = cellOwner(x, y);
  if (owner.kind === 'village') return owner.refId ?? '';
  if (owner.kind === 'site') return `site:${owner.refId}`;
  if (owner.kind === 'county') return 'county';
  return '';
}

/** 地块环境（规格版：地形英文枚举 + 生态取全县值） */
function envOf(state: GameState, villageId: string): SpecEnv {
  const v = state.villages.find((x) => x.id === villageId);
  const terrain = v ? v.environment.terrain : DEFAULT_ENVIRONMENT.terrain;
  return {
    terrain: terrainToType(terrain),
    disasterRisk: v?.environment.disasterRisk ?? DEFAULT_ENVIRONMENT.disasterRisk,
    clanPower: v?.environment.clanPower ?? DEFAULT_ENVIRONMENT.clanPower,
    ecology: state.county.ecology,
  };
}

/** 道路基建条目（每段一格路；维护费吞金） */
function roadInfra(x: number, y: number): Infrastructure {
  return {
    id: `infra_road_${x}_${y}`,
    type: 'road',
    buildCost: 20,
    maintenanceCostPerTurn: 0.5,
    debtInterest: 0,
    utilizationRate: 100,
    condition: 100,
  };
}

/** 全县基建清单：路网 + 冷链中枢 + 5G 基站 */
export function deriveInfrastructures(state: GameState): Infrastructure[] {
  const out: Infrastructure[] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (roadAt(state, x, y)) out.push(roadInfra(x, y));
    }
  }
  const infra = state.physicalInfra;
  if (infra.coldChainCapacity > 0) {
    out.push({
      id: 'infra_cold_chain',
      type: 'cold_chain',
      buildCost: 40,
      maintenanceCostPerTurn: 4,
      debtInterest: 0,
      utilizationRate: Math.round((1 - infra.coldChainIdleRate) * 100),
      condition: 100,
    });
  }
  if (infra.hasSmartAgriApp) {
    out.push({
      id: 'infra_5g',
      type: '5g_base',
      buildCost: 30,
      maintenanceCostPerTurn: 2,
      debtInterest: 0,
      utilizationRate: Math.round(infra.appAdoptionRate * 100),
      condition: 100,
    });
  }
  return out;
}

/** 全县产业网格总快照（规格 IndustryState） */
export function buildIndustryState(state: GameState): IndustryState {
  const tiles: Tile[] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const owner = ownerIdOf(x, y);
      const isVillage = owner !== '' && owner !== 'county' && !owner.startsWith('site:');
      const isCounty = owner === 'county';
      let facility: Facility | null = null;
      let infra: Infrastructure | null = null;
      if (isVillage) facility = primaryFacilityOf(state, owner);
      if (roadAt(state, x, y)) infra = roadInfra(x, y);
      if (isCounty && state.physicalInfra.coldChainCapacity > 0) {
        infra = {
          id: 'infra_cold_chain',
          type: 'cold_chain',
          buildCost: 40,
          maintenanceCostPerTurn: 4,
          debtInterest: 0,
          utilizationRate: Math.round((1 - state.physicalInfra.coldChainIdleRate) * 100),
          condition: 100,
        };
      }
      if (isVillage && state.physicalInfra.hasSmartAgriApp) {
        infra = {
          id: 'infra_5g',
          type: '5g_base',
          buildCost: 30,
          maintenanceCostPerTurn: 2,
          debtInterest: 0,
          utilizationRate: Math.round(state.physicalInfra.appAdoptionRate * 100),
          condition: 100,
        };
      }
      const v = state.villages.find((vv) => vv.id === owner);
      tiles.push({
        id: `${x},${y}`,
        x,
        y,
        villageId: owner,
        environment: envOf(state, owner),
        facility,
        infra,
        infoAccuracy: isCounty ? 100 : v ? v.infoAccuracy : state.county.infoAccuracy,
      });
    }
  }

  // 无向边：相邻两格都通公路
  const connectedEdges: IndustryState['connectedEdges'] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (!roadAt(state, x, y)) continue;
      const right = x + 1 < GRID.w && roadAt(state, x + 1, y);
      const down = y + 1 < GRID.h && roadAt(state, x, y + 1);
      if (right) connectedEdges.push({ sourceId: `${x},${y}`, targetId: `${x + 1},${y}`, type: 'road', isBlocked: false });
      if (down) connectedEdges.push({ sourceId: `${x},${y}`, targetId: `${x},${y + 1}`, type: 'road', isBlocked: false });
    }
  }

  const infras = deriveInfrastructures(state);
  const totalMaintenanceCost = Math.round(infras.reduce((s, i) => s + i.maintenanceCostPerTurn, 0) * 10) / 10;
  const totalDebtInterest = Math.round(Math.max(0, (state.county.debtRisk - 20)) * 0.2 * 10) / 10;

  return { tiles, connectedEdges, totalMaintenanceCost, totalDebtInterest };
}
