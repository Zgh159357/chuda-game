import type { GameState, PolicyCardSpec, VillageState } from '../types';
import { config } from '../../config';
import { skillSum } from '../skills';
import type { TurnCtx } from './context';

// ============================================================
// 政策卡效果解析：G2 卡牌库（阶段解锁、每回合组牌组、组合技）
// 目标规则：卡片作用于"最需要的地方"（迷雾最重/产业最弱/风险最高），
// 避免玩家用卡堆数据，强制资源流向选择。
// ============================================================

type EffectKind = string;

/** 选取卡片作用的目标村 */
function focusVillage(state: GameState, kind: EffectKind): VillageState | null {
  const villages = state.villages;
  if (villages.length === 0) return null;
  switch (kind) {
    case 'infoAccuracy':
    case 'registerAll':
    case 'laborAbility':
      // 信息迷雾最重的村
      return [...villages].sort((a, b) => a.infoAccuracy - b.infoAccuracy)[0];
    case 'industryBase':
    case 'subsidyDependence':
    case 'channelStrength':
    case 'collectiveEconomy':
    case 'coopParty':
    case 'subsidyTaper':
      // 产业最弱的村（帮扶优先）
      return [...villages].sort((a, b) => a.industryBase - b.industryBase)[0];
    case 'returnRisk':
    case 'monitor':
      // 返贫风险最高的村
      return [...villages].sort((a, b) => b.returnRisk - a.returnRisk)[0];
    case 'handover':
      // 已有驻村队的村（撤队交接对象）
      return villages.find((v) => v.dispatchedUnitId) ?? villages[0];
    case 'internalGovernance':
    case 'externalEmbed':
      // 内生治理最弱的村
      return [...villages].sort((a, b) => a.internalGovernance - b.internalGovernance)[0];
    default:
      return villages[0];
  }
}

function findUnit(state: GameState): { id: string; name: string } | null {
  const free = state.units.find((u) => u.resourcePool > 5 && !state.villages.some((v) => v.dispatchedUnitId === u.id));
  return free ?? null;
}

export function applyCardEffects(
  state: GameState,
  card: PolicyCardSpec,
  playedIds: string[],
  ctx: TurnCtx,
  explicitVillageId?: string,
): boolean {
  // 成本校验
  if (state.county.cadrePower < card.cost.cadre) return false;
  if (state.county.fiscalFund < card.cost.fiscal) return false;
  if (state.county.cooperationFund < card.cost.coop) return false;
  state.county.cadrePower -= card.cost.cadre;
  state.county.fiscalFund -= card.cost.fiscal;
  state.county.cooperationFund -= card.cost.coop;

  // 双层视图重构：卡槽可显式指派到村（沙盘落点），缺省回退自动聚焦
  const assigned = explicitVillageId
    ? state.villages.find((x) => x.id === explicitVillageId) ?? null
    : null;
  const target = (kind: EffectKind): VillageState | null => assigned ?? focusVillage(state, kind);

  for (const ef of card.effects) {
    const v = target(ef.kind);
    switch (ef.kind) {
      case 'registerAll':
        for (const village of state.villages) {
          for (const h of village.households) h.registered = true;
          village.infoAccuracy = Math.min(100, village.infoAccuracy + 8);
        }
        state.county.tableBurden += 4; // 建档=台账
        break;
      case 'dispatch': {
        const unit = findUnit(state);
        if (unit && v && !v.dispatchedUnitId) {
          v.dispatchedUnitId = unit.id;
          v.externalEmbed = Math.min(100, v.externalEmbed + 15);
          const u = state.units.find((x) => x.id === unit.id)!;
          u.resourcePool -= 10;
          const rel = state.relationships.find((r) => r.label.includes('工作队'));
          if (rel) rel.value = Math.min(100, rel.value + 5);
        }
        break;
      }
      case 'infoAccuracy':
        if (v) v.infoAccuracy = Math.min(100, v.infoAccuracy + ef.value);
        break;
      case 'trust':
        state.county.trust = Math.min(100, state.county.trust + ef.value);
        break;
      case 'participation':
        if (v) v.participation = Math.min(100, v.participation + ef.value);
        break;
      case 'industryBase':
        if (v) v.industryBase = Math.min(100, v.industryBase + ef.value);
        break;
      case 'subsidyDependence':
        if (v) v.subsidyDependence = Math.min(100, v.subsidyDependence + ef.value);
        break;
      case 'laborAbility':
        if (v) {
          for (const h of v.households) h.laborAbility = Math.min(1, h.laborAbility + ef.value / 100);
        }
        break;
      case 'exitWillingness':
        if (v) {
          for (const h of v.households) h.exitWillingness = Math.min(100, h.exitWillingness + ef.value);
        }
        break;
      case 'coopParty':
        if (v) v.coopType = 'partyBranch';
        break;
      case 'inspectionPrep':
        // 迎检准备：账面好看，负担上升，形式主义累积
        state.county.inspectionBurden = Math.max(0, state.county.inspectionBurden - 6);
        state.county.formality += 8;
        state.county.tableBurden += 6;
        break;
      case 'thirdParty':
        state.county.thirdPartyCoverage = Math.min(100, state.county.thirdPartyCoverage + ef.value);
        break;
      case 'channelStrength':
        if (v) v.industryChannel = Math.min(100, v.industryChannel + ef.value);
        break;
      case 'adminBurden':
        state.county.adminBurden = Math.max(0, state.county.adminBurden + ef.value);
        break;
      case 'politicalCapital':
        state.county.politicalCapital = Math.max(0, state.county.politicalCapital + ef.value);
        break;
      case 'returnRisk':
        for (const village of state.villages) {
          village.returnRisk = Math.max(0, village.returnRisk + ef.value);
        }
        break;
      case 'monitor':
        // 防返贫监测：压低最高风险村的返贫风险
        if (v) v.returnRisk = Math.max(0, v.returnRisk + ef.value);
        break;
      case 'subsidyTaper':
        for (const village of state.villages) {
          village.subsidyDependence = Math.max(0, village.subsidyDependence - ef.value);
        }
        for (const p of state.projects) {
          p.subsidyDependence = Math.max(0, p.subsidyDependence - ef.value);
        }
        break;
      case 'handover': {
        if (v) {
          // 组织建设技能：撤队交接留下更厚的内生治理遗产
          v.internalGovernance = Math.min(100, v.internalGovernance + 10 + skillSum(state, 'handoverLegacy'));
          v.externalEmbed = Math.max(0, v.externalEmbed - 10);
          if (v.dispatchedUnitId) {
            const u = state.units.find((x) => x.id === v.dispatchedUnitId);
            if (u) u.politicalCredit = Math.min(100, u.politicalCredit + 5);
            v.dispatchedUnitId = null;
          }
        }
        break;
      }
      case 'collectiveEconomy':
        if (v) v.collectiveEconomy = Math.min(100, v.collectiveEconomy + ef.value);
        break;
      case 'assessmentDensity':
        state.county.assessmentDensity = Math.max(0, Math.min(100, state.county.assessmentDensity + ef.value));
        break;
      case 'internalGovernance':
        if (v) v.internalGovernance = Math.min(100, v.internalGovernance + ef.value);
        break;
      case 'externalEmbed':
        if (v) v.externalEmbed = Math.max(0, v.externalEmbed + ef.value);
        break;
      case 'relativeMonitor':
        state.county.relativeMonitor = true;
        break;
      default:
        break;
    }
  }

  // 组合技（同回合打出搭档卡 → 追加效果）
  if (card.combo) {
    for (const partnerId of card.combo) {
      if (!playedIds.includes(partnerId)) continue;
      const partner = config.policies.find((p) => p.id === partnerId);
      if (!partner) continue;
      const v = focusVillage(state, partner.effects[0]?.kind ?? 'industryBase');
      if (!v) continue;
      if (card.id === 'b_workrelief' && partnerId === 'b_training') {
        // 扶志组合：以工代赈+技能培训
        v.participation = Math.min(100, v.participation + 5);
        for (const h of v.households) h.exitWillingness = Math.min(100, h.exitWillingness + 5);
      } else if (card.id === 'c_consumption' && partnerId === 'b_coop') {
        // 组织市场组合：支部领办+消费帮扶
        v.industryChannel = Math.min(100, v.industryChannel + 8);
        v.dualBindStability = Math.min(100, v.dualBindStability + 4);
      }
    }
  }

  return true;
}
