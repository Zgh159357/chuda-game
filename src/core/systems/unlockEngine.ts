// ============================================================
// 因果律解锁引擎（主控提示词第九节核心）
// 解锁不能只靠资源购买：必须基于「治理状态 + 事件链」。
// 纯函数，只读 state，不修改。
// ============================================================
import type {
  GameState,
  TechNodeSpec,
  UnlockCondition,
  WonderSpec,
} from '../types';
import { config } from '../../config';
import { chainOf } from '../../config/heroChains';
import { chainTriggerMet } from '../../logic/heroChain';

/** 全县干部平均疲劳 */
export function avgFatigue(state: GameState): number {
  if (state.cadres.length === 0) return 0;
  return state.cadres.reduce((s, c) => s + c.fatigue, 0) / state.cadres.length;
}

/** 全县平均返贫风险 */
export function avgReturnRisk(state: GameState): number {
  if (state.villages.length === 0) return 0;
  return state.villages.reduce((s, v) => s + v.returnRisk, 0) / state.villages.length;
}

/** 是否存在停滞/烂尾项目 */
export function hasStalledProjects(state: GameState): boolean {
  return state.projects.some((p) => p.status === 'stalled' || p.status === 'broken');
}

/** 任意一村内生治理停滞的最大回合数 */
export function maxVillageStall(state: GameState): number {
  const vals = Object.values(state.streaks.villageStall);
  return vals.length === 0 ? 0 : Math.max(...vals);
}

/** 任意一村产业强度的最大值 */
export function maxVillageIndustry(state: GameState): number {
  if (state.villages.length === 0) return 0;
  return Math.max(...state.villages.map((v) => v.industryBase));
}

/** 事件链是否已触发 */
export function hasEvents(state: GameState, requiredEvents: string[]): boolean {
  return requiredEvents.every((e) => state.eventHistory.includes(e));
}

/**
 * 因果律条件判定：返回是否满足 + 未满足的中文清单（UI tooltip 用）。
 * 条件全部为「且」关系。
 */
export function checkUnlockConditions(
  state: GameState,
  cond: UnlockCondition | undefined,
): { ok: boolean; missing: string[] } {
  if (!cond) return { ok: true, missing: [] };
  const missing: string[] = [];
  const c = state.county;

  if (cond.requiredResources) {
    if (cond.requiredResources.politicalCapital !== undefined && c.politicalCapital < cond.requiredResources.politicalCapital) {
      missing.push(`政治资本 ≥ ${cond.requiredResources.politicalCapital}`);
    }
    if (cond.requiredResources.fiscalFund !== undefined && c.fiscalFund < cond.requiredResources.fiscalFund) {
      missing.push(`财政 ≥ ${cond.requiredResources.fiscalFund}`);
    }
  }
  const rs = cond.requiredState;
  if (rs) {
    if (rs.minInfoAccuracy !== undefined && c.infoAccuracy < rs.minInfoAccuracy) missing.push(`档案精度 ≥ ${rs.minInfoAccuracy}%`);
    const fatigue = avgFatigue(state);
    if (rs.minFatigue !== undefined && fatigue < rs.minFatigue) missing.push(`干部平均疲劳 ≥ ${rs.minFatigue}`);
    if (rs.maxFatigue !== undefined && fatigue > rs.maxFatigue) missing.push(`干部平均疲劳 ≤ ${rs.maxFatigue}`);
    if (rs.maxPoliticalCapital !== undefined && c.politicalCapital > rs.maxPoliticalCapital) missing.push(`政治资本 ≤ ${rs.maxPoliticalCapital}`);
    if (rs.minPoliticalCapital !== undefined && c.politicalCapital < rs.minPoliticalCapital) missing.push(`政治资本 ≥ ${rs.minPoliticalCapital}`);
    if (rs.minRound !== undefined && state.county.round < rs.minRound) missing.push(`第 ${rs.minRound} 回合后`);
    if (rs.maxRound !== undefined && state.county.round > rs.maxRound) missing.push(`第 ${rs.maxRound} 回合前`);
    if (rs.minFraudCleanStreak !== undefined && state.streaks.fraudClean < rs.minFraudCleanStreak) missing.push(`连续 ${rs.minFraudCleanStreak} 回合无造假`);
    if (rs.minCutCornersStreak !== undefined && state.streaks.cutCorners < rs.minCutCornersStreak) missing.push(`连续 ${rs.minCutCornersStreak} 回合敷衍了事`);
    if (rs.minRankStreak !== undefined && state.streaks.rank < rs.minRankStreak) missing.push(`连续 ${rs.minRankStreak} 回合考核夺魁`);
    if (rs.noStalledProjects && hasStalledProjects(state)) missing.push('全县 0 烂尾/停滞项目');
    if (rs.minVillageStall !== undefined && maxVillageStall(state) < rs.minVillageStall) missing.push(`有村内生治理停滞 ${rs.minVillageStall} 回合`);
    if (rs.minVillageIndustry !== undefined && maxVillageIndustry(state) < rs.minVillageIndustry) missing.push(`有村产业强度 ≥ ${rs.minVillageIndustry}`);
    if (rs.maxReturnRisk !== undefined && avgReturnRisk(state) > rs.maxReturnRisk) missing.push(`全县平均返贫风险 ≤ ${rs.maxReturnRisk}`);
    if (rs.minEcology !== undefined && c.ecology < rs.minEcology) missing.push(`生态 ≥ ${rs.minEcology}`);
  }
  if (cond.requiredEvents) {
    for (const ev of cond.requiredEvents) {
      if (!state.eventHistory.includes(ev)) missing.push(`未触发事件：${ev}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** 节点是否已永久解锁 */
export function isTechUnlocked(state: GameState, nodeId: string): boolean {
  return state.techUnlocked.includes(nodeId);
}

/** 隐藏节点是否已显现（条件满足即显现，即使买不起） */
export function techRevealed(state: GameState, node: TechNodeSpec): boolean {
  if (!node.hidden) return true;
  return checkUnlockConditions(state, node.conditions).ok;
}

/** 节点此刻是否可买：条件满足 + 政治资本够 + 前置已解锁 */
export function techAffordable(state: GameState, node: TechNodeSpec): boolean {
  if (isTechUnlocked(state, node.id)) return false;
  if (!techRevealed(state, node)) return false;
  if (state.county.politicalCapital < node.politicalCapitalCost) return false;
  if (node.requires && node.requires.some((r) => !isTechUnlocked(state, r))) return false;
  return checkUnlockConditions(state, node.conditions).ok;
}

/** 当前所有可买节点（UI「可解锁」用） */
export function checkTechUnlocks(state: GameState): TechNodeSpec[] {
  return config.techTree.filter((n) => techAffordable(state, n));
}

/** 奇观是否已建成 */
export function wonderBuilt(state: GameState, wonderId: string): boolean {
  const p = state.wonders.find((w) => w.id === wonderId);
  return !!p && p.built;
}

/** 隐藏奇观是否已显现 */
export function wonderRevealed(state: GameState, wonder: WonderSpec): boolean {
  if (!wonder.hidden) return true;
  return checkUnlockConditions(state, wonder.conditions).ok;
}

/** 奇观此刻是否可开工投入（条件满足 + 未建成） */
export function canInvestWonder(state: GameState, wonder: WonderSpec): boolean {
  const prog = state.wonders.find((w) => w.id === wonder.id);
  if (prog && prog.built) return false;
  if (!wonderRevealed(state, wonder)) return false;
  return checkUnlockConditions(state, wonder.conditions).ok;
}

/** 当前所有可开工奇观 */
export function checkWonderUnlocks(state: GameState): WonderSpec[] {
  return config.wonders.filter((w) => canInvestWonder(state, w));
}

/** 某人才是否已入队 */
export function heroRecruited(state: GameState, heroId: string): boolean {
  return state.heroes.some((h) => h.heroId === heroId);
}

/** §18：某人才此刻是否应进入招募池（触发条件满足 + 未入队 + 未被永拒 + 未在池中） */
export function heroOfferDue(state: GameState, heroId: string): boolean {
  const chain = chainOf(heroId);
  if (!chain || chain.recruitSteps.length === 0) return false;
  if (heroRecruited(state, heroId)) return false;
  if (chain.declineCloses && state.declinedRecruits.includes(heroId)) return false;
  if (state.pendingRecruits.some((p) => p.heroId === heroId)) return false;
  return chainTriggerMet(state, chain);
}

/** 本轮应入池的人才 id 清单（reducer 调用后写入 pendingRecruits + heroChains 进度） */
export function evaluateHeroRecruits(state: GameState): string[] {
  return config.heroes.filter((h) => heroOfferDue(state, h.id)).map((h) => h.id);
}
