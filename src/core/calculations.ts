import type { BuildingType, EnvironmentTraits, NodeType, PlayerAnchor, PlayerOrigin, Tile } from './types';

// ============================================================
// §12 环境与人文阻力：纯函数计算层（主控提示词：calculations.ts）
// 所有函数纯函数、可单测；不读写外部状态。
// ============================================================

/** 默认环境（县治/安置点/荒野地块用）：平原、低灾害、低宗族、低观念阻力 */
export const DEFAULT_ENVIRONMENT: EnvironmentTraits = {
  terrain: '平原',
  disasterRisk: 30,
  clanPower: 30,
  traditionalIdeology: 30,
};

/** 玩家初始身份映射：现有锚点 → 主控提示词的三类身份 */
export function originOf(anchor: PlayerAnchor): PlayerOrigin {
  switch (anchor) {
    case 'returningStudent':
      return 'origin_student'; // 返乡大学生
    case 'local':
      return 'origin_veteran'; // 本地成长 → 老资历（近似退伍军人）
    case 'entrusted':
      return 'origin_airdrop'; // 前任托付 → 接手空降（近似空降干部）
  }
}

/**
 * 项目产出计算（地形 × 人文环境修正）。
 * @returns output=最终产出（两位小数）；isFailed=是否极易烂尾（石漠化建大棚）
 */
export function calculateProjectOutput(
  tile: Tile,
  baseOutput: number
): { output: number; isFailed: boolean } {
  let coef = 1;
  let isFailed = false;
  const terrain = tile.environment.terrain;
  const building = tile.building;

  // 地形修正
  if (terrain === '石漠化' && building === '大棚') {
    coef *= 0.1; // 石漠化上建大棚：产出系数 0.1，极易烂尾
    isFailed = true;
  }
  if (terrain === '深山') {
    coef *= 0.7; // 深山运输困难：产出系数 0.7
  }

  // 人文环境修正：观念落后（传统观念阻力 > 70）排斥新事物
  if (tile.environment.traditionalIdeology > 70 && (building === '大棚' || building === '加工厂')) {
    coef *= 0.5;
  }

  return {
    output: Math.round(baseOutput * coef * 100) / 100,
    isFailed,
  };
}

/**
 * 行动精力消耗（身份修正）。基础消耗：visit 10 精力、form 10 精力。
 * 返回最终精力消耗数值；0 = 直接成功不耗精力。
 */
export function getActionCostModifier(
  actionType: 'visit' | 'form',
  tile: Tile,
  origin: PlayerOrigin
): number {
  const base = 10;

  if (origin === 'origin_student') {
    if (actionType === 'form') return base * 0.5; // 返乡大学生填表：减半
    if (actionType === 'visit' && tile.environment.clanPower > 60) return base * 1.5; // 宗族势力强：走访翻 1.5 倍
  }

  if (origin === 'origin_veteran' && actionType === 'visit') {
    if (tile.environment.traditionalIdeology > 50) return 0; // 退伍军人走访传统观念重的村：直接成功
  }

  if (origin === 'origin_airdrop' && actionType === 'visit') {
    return base * 2.0; // 空降干部村民不待见：走访翻倍
  }

  return base;
}

// ============================================================
// §13 自由拼装沙盒：资源滑块分配 + 产业链协同
// ============================================================

/** 建筑 → 产业链节点（拼装器用） */
export function buildingToNodeType(building: BuildingType | null): NodeType | null {
  switch (building) {
    case '大棚': return 'farm';
    case '加工厂': return 'factory';
    case '砖瓦房': return 'market';
    default: return null; // 茅草屋/奇观不参与产业链拼装
  }
}

/**
 * 动态民生资源滑块分配（替代 A/B/C 选项卡）。
 * 输入三项比例（任意数值，自动归一化到总额 100），返回精确数值变化。
 * - 给钱多：短期信任涨，长期「等靠要」风险高
 * - 培训+产业多：短期无收益，5 回合后产出暴增
 */
export interface AllocationInput {
  money: number;
  training: number;
  industry: number;
}

export interface AllocationResult {
  moneyPct: number;
  trainingPct: number;
  industryPct: number;
  shortTermTrust: number; // 短期信任变化（结算即时生效）
  longTermOutput: number; // 长期产出增益（约 5 回合后兑现）
  fiscalSpend: number; // 财政消耗
  dependenceRisk: number; // 「等靠要」依赖风险（0-100 量纲参考）
  fiscalLabel: '小' | '中' | '大';
  summary: string; // 实时提示文案
}

export function calculateAllocationResult(allocation: AllocationInput): AllocationResult {
  const total = allocation.money + allocation.training + allocation.industry || 1;
  const money = (allocation.money / total) * 100;
  const training = (allocation.training / total) * 100;
  const industry = (allocation.industry / total) * 100;

  // 给钱：短期信任 +0.15/点，等靠要风险 +0.3/点，财政 +0.5/点
  const shortTermTrust = Math.round(money * 0.15 * 10) / 10 - Math.round(training * 0.05 * 10) / 10; // 培训短期略有阵痛
  // 培训+产业：5 回合后产出暴增（培训 ×0.6 + 产业 ×0.8）
  const longTermOutput = Math.round((training * 0.6 + industry * 0.8) * 10) / 10;
  const fiscalSpend = Math.round((money * 0.5 + industry * 0.9) * 10) / 10;
  const dependenceRisk = Math.round((money * 0.3 - industry * 0.1) * 10) / 10;

  const fiscalLabel: AllocationResult['fiscalLabel'] = fiscalSpend < 30 ? '小' : fiscalSpend < 60 ? '中' : '大';

  return {
    moneyPct: Math.round(money),
    trainingPct: Math.round(training),
    industryPct: Math.round(industry),
    shortTermTrust,
    longTermOutput,
    fiscalSpend,
    dependenceRisk,
    fiscalLabel,
    summary: `预计短期成效：${shortTermTrust >= 0 ? '+' : ''}${shortTermTrust}，长期成效：+${longTermOutput}（约5回合后兑现），财政消耗：${fiscalLabel}`,
  };
}

/**
 * 自由拼装产业链协同结算。
 * - 隐藏组合【农旅融合】：深山地块上同时有 farm（农田/大棚）+ market（民宿/市场）→ 产出与信任大幅提升
 * - 惩罚组合：石漠化建大棚 → 产出惩罚 + 烂尾风险
 */
export function calculateIndustrySynergy(tiles: Tile[]): Record<string, number> {
  const nodes = tiles
    .map((t) => buildingToNodeType(t.building))
    .filter((n): n is NodeType => n !== null);
  const hasFarm = nodes.includes('farm');
  const hasMarket = nodes.includes('market');
  const hasFactory = nodes.includes('factory');
  const hasDeepMountain = tiles.some((t) => t.environment.terrain === '深山');
  const desertGreenhouse = tiles.some(
    (t) => t.environment.terrain === '石漠化' && t.building === '大棚'
  );

  const result: Record<string, number> = { outputMul: 1, trustDelta: 0 };

  if (hasFarm && hasMarket && hasDeepMountain) {
    result.outputMul = 1.5; // 农旅融合：产出 ×1.5
    result.trustDelta = (result.trustDelta ?? 0) + 5; // 信任 +5
    result.synergy_agriTourism = 1;
  }
  if (desertGreenhouse) {
    result.outputMul = Math.round((result.outputMul ?? 1) * 0.1 * 100) / 100; // 石漠化大棚：×0.1
    result.penalty_desertGreenhouse = 1;
  }
  if (hasFactory && !hasFarm) {
    result.synergy_buyerRoute = 1; // 买办路线：全加工不种地（策划可接全局加成）
  }

  return result;
}
