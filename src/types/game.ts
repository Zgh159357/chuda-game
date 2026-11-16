// ============================================================
// §20 产业网格沙盒与基础设施网络 —— 规格数据结构
// 用户规格要求落盘 src/types/game.d.ts；本项目为便于附带
// 纯映射常量的运行时使用，落盘为同名 game.ts（类型完全一致）。
// 与既有系统兼容口径：
//  - TerrainType（英文枚举）↔ core/types.Terrain（中文枚举）双向映射
//  - Facility 由 projects/builtNodes 派生；Infrastructure 由
//    physicalInfra/道路网派生；Tile 为持久化的网格快照。
// ============================================================
import type { Terrain } from '../core/types';

// 1. 地形与环境
export type TerrainType = 'plain' | 'mountain' | 'rocky' | 'hilly';

/** 规格地形（英文）→ 既有地形（中文） */
export const TERRAIN_TYPE_TO_CN: Record<TerrainType, Terrain> = {
  plain: '平原',
  mountain: '深山',
  rocky: '石漠化',
  hilly: '丘陵',
};

/** 既有地形（中文）→ 规格地形（英文） */
export const TERRAIN_CN_TO_TYPE: Record<Terrain, TerrainType> = {
  平原: 'plain',
  深山: 'mountain',
  石漠化: 'rocky',
  丘陵: 'hilly',
};

/** 规格地形显示名（UI 用） */
export const TERRAIN_TYPE_LABELS: Record<TerrainType, string> = {
  plain: '平原',
  mountain: '深山',
  rocky: '石漠化',
  hilly: '丘陵',
};

export function terrainToType(t: Terrain): TerrainType {
  return TERRAIN_CN_TO_TYPE[t] ?? 'plain';
}

export function typeToTerrain(t: TerrainType): Terrain {
  return TERRAIN_TYPE_TO_CN[t];
}

/** 规格环境特征（地形用英文枚举；ecology 为生态值，基建与环境会消耗） */
export interface EnvironmentTraits {
  terrain: TerrainType;
  disasterRisk: number; // 灾害风险 0-100
  clanPower: number; // 宗族势力
  ecology: number; // 生态值 0-100
}

// 2. 产业模块（地块上建的东西）
export type FacilityType = 'farm' | 'factory' | 'logistics' | 'ecommerce';

export interface Facility {
  id: string;
  type: FacilityType;
  name: string; // 如 "高标准农田", "预制菜加工厂"
  baseOutput: number; // 基础产出
  laborRequired: number; // 需要劳动力
  pollutionDelta: number; // 污染增量（工厂很高，农田为负）
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  farm: '农田',
  factory: '加工厂',
  logistics: '物流',
  ecommerce: '电商',
};

// 3. 基础设施（占用独立的一层，可以连接地块）
export type InfraType = 'road' | 'cold_chain' | '5g_base' | 'water_canal';

export interface Infrastructure {
  id: string;
  type: InfraType;
  buildCost: number; // 建造费
  maintenanceCostPerTurn: number; // 每回合维护费（吞金兽）
  debtInterest: number; // 贷款建造产生的每回合利息
  utilizationRate: number; // 利用率 0-100（冷库空置率的反向指标）
  condition: number; // 耐久度 0-100（受自然灾害影响）
}

export const INFRA_TYPE_LABELS: Record<InfraType, string> = {
  road: '公路',
  cold_chain: '冷链库',
  '5g_base': '5G 基站',
  water_canal: '引水渠',
};

// 4. 网格地块
export interface Tile {
  id: string;
  x: number;
  y: number;
  villageId: string; // 所属村（县治/安置点用 'county'/'site:<id>'）
  environment: EnvironmentTraits;
  facility: Facility | null; // 该地块的产业
  infra: Infrastructure | null; // 该地块的基建（每地块一种基建主设施）
  infoAccuracy: number; // 信息精度
}

// 5. 全局产业状态扩展（Zustand Store 由 GameState.industryGrid 承载）
export interface IndustryState {
  tiles: Tile[];
  // 地块间连线关系（无向图）
  connectedEdges: { sourceId: string; targetId: string; type: InfraType; isBlocked: boolean }[];
  totalMaintenanceCost: number; // 全县每回合总维护费
  totalDebtInterest: number; // 全县每回合总利息
}
