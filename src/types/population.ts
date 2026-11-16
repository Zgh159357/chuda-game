// ============================================================
// §19 人口系统：动态村民与技能演化（src/types/population.ts）
// 人群以「群体块」表达，避免逐人计算；技能等级与职业标签
// 构成劳动力供给端，后续与产业需求端做匹配。
// ============================================================

/** 村民技能等级（由低到高） */
export type SkillLevel = 'unskilled' | 'skilled' | 'expert';

/** 劳动力职业标签 */
export type JobTag =
  | 'surplus_labor' // 富余劳动力（无固定营生）
  | 'factory_worker' // 进厂务工
  | 'ecommerce_host' // 电商/直播带货
  | 'farmer' // 务农
  | 'troublemaker'; // 闹访/钉子户（劳动力匹配的负资产）

/** 村民群体块：同一技能等级+职业标签+老龄化状态的一批人 */
export interface VillagerGroup {
  id: string;
  /** 人数 */
  count: number;
  /** 技能等级 */
  skillLevel: SkillLevel;
  /** 职业标签 */
  jobTag: JobTag;
  /** 是否老龄化群体 */
  isElderly: boolean;
}

/** 村庄人口状态（挂 VillageState 或 GameState 按村索引） */
export interface VillagePopulation {
  /** 总人口 */
  totalPop: number;
  /** 群体构成 */
  groups: VillagerGroup[];
  /** 人口流失率 0-100（越高越空心化） */
  outflowRate: number;
  /** 人口回流率 0-100 */
  inflowRate: number;
}

/** 全县人口快照：按村 id 索引 */
export type PopulationIndex = Record<string, VillagePopulation>;
