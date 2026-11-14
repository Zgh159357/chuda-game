import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// 奖励结算（与 rewardConfig 分离）：连击 / 里程碑 / 成就 / 故事线
// 微反馈在行动过程中已 push（≤2 条由 ctx 保证）。
// ============================================================

function allHouseholds(state: GameState) {
  return state.villages.flatMap((v) => v.households);
}

/** 检查单条成就条件 */
function checkCondition(state: GameState, cond: string): boolean {
  const c = state.county;
  const households = allHouseholds(state);
  switch (cond) {
    case 'allRegistered':
      return households.length > 0 && households.every((h) => h.registered);
    case 'accurateMatch10':
      return state.accurateMatches >= 10;
    case 'allNoLaborCovered':
      return households.filter((h) => h.tag === 'noLabor').every((h) => h.covered);
    case 'burdenLowAt32':
      return c.round >= 32 && c.adminBurden < 30;
    case 'thirdParty60':
      return c.thirdPartyCoverage >= 60;
    case 'ecology80':
      return c.ecology >= 80;
    case 'repairedStopLoss':
      return state.repairModes.some((r) => r.mode === 'stopLoss');
    case 'repairedRestructure':
      return state.repairModes.some((r) => r.mode === 'restructure');
    case 'repairedCarrier':
      return state.repairModes.some((r) => r.mode === 'changeCarrier');
    case 'repairedAccountability':
      return state.repairModes.some((r) => r.mode === 'accountability');
    case 'taperSmooth':
      return c.round >= 41 && state.villages.length > 0 &&
        state.villages.reduce((s, v) => s + v.subsidyDependence, 0) / state.villages.length < 30;
    case 'directReport50':
      return c.directReport >= 50;
    case 'inspectionManiac':
      return c.assessmentDensity >= 80;
    case 'paperworkMaster':
      return c.orgCostRatio > 2;
    case 'overcommitFailed': {
      const r4 = state.history.find((h) => h.round === 4);
      return c.commitment === 'overachieve' &&
        (r4?.outcome.checkpoints.some((cp) => cp.id === 'r4_commitmentReview' && !cp.passed) ?? false);
    }
    case 'fakeProb30':
      return c.backlash.fakeProb >= 30;
    case 'meetingsHigh':
      return c.meetingBurden + c.tableBurden > 12;
    case 'subsidyAddict':
      return state.villages.length > 0 &&
        state.villages.reduce((s, v) => s + v.subsidyDependence, 0) / state.villages.length >= 70;
    case 'laoliStage3':
      return (state.storylines.find((s) => s.id === 'laoli')?.stageIndex ?? 0) >= 3;
    case 'xiaoyangStage3':
      return (state.storylines.find((s) => s.id === 'xiaoyang')?.stageIndex ?? 0) >= 3;
    case 'xiaowangStage3':
      return (state.storylines.find((s) => s.id === 'xiaowang')?.stageIndex ?? 0) >= 3;
    case 'repairer':
      return state.projectsRepaired.length >= 2;
    case 'canHoldAll':
      return state.villages.length > 0 && state.villages.every((v) => v.canHoldIndex >= 60);
    case 'tagsGoneEnding':
      return state.ending === 'tagsGone';
    default:
      return false;
  }
}

/** 成就结算 */
export function settleAchievements(state: GameState, ctx: TurnCtx): void {
  for (const ac of config.achievements) {
    if (state.unlocked.achievements.includes(ac.id)) continue;
    if (checkCondition(state, ac.condition)) {
      state.unlocked.achievements.push(ac.id);
      ctx.pushEvent({ type: 'achievement', round: ctx.round, achievementId: ac.id, isNegative: ac.isNegative });
      ctx.pushLedger(ac.isNegative ? 'cost' : 'achievement', `ac_${ac.id}`, ac.isNegative ? -6 : 6, `${ac.isNegative ? '负成就' : '成就'}：${ac.name}`);
    }
  }
}

/** 故事线推进 */
export function settleStorylines(state: GameState, ctx: TurnCtx): void {
  const households = allHouseholds(state);
  for (const sl of state.storylines) {
    const cfg = config.storylines.find((s) => s.id === sl.id);
    if (!cfg || sl.stageIndex >= cfg.stages.length) continue;
    const stage = cfg.stages[sl.stageIndex];
    const h = households.find((x) => x.id === cfg.householdId);

    let triggered = false;
    switch (sl.id) {
      case 'laoli': {
        if (!h) break;
        if (stage.trigger === 'registered' && h.registered) triggered = true;
        if (stage.trigger === 'covered' && h.covered) triggered = true;
        if (stage.trigger === 'participated' && h.agency >= 60) triggered = true;
        break;
      }
      case 'xiaoyang': {
        const site = state.sites.find((s) => s.households.includes(cfg.householdId));
        if (stage.trigger === 'relocateStart' && (h?.measureId === 'relocate')) triggered = true;
        if (stage.trigger === 'settled' && site && site.livelihoodSelfReliance >= 40) triggered = true;
        if (stage.trigger === 'selfReliant' && site && site.livelihoodSelfReliance >= 65) triggered = true;
        break;
      }
      case 'xiaowang': {
        if (!h) break;
        if (stage.trigger === 'trained' && h.measureId === 'training') triggered = true;
        const v = state.villages.find((x) => x.id === h.villageId);
        if (stage.trigger === 'started' && v && v.industryBase >= 50) triggered = true;
        if (stage.trigger === 'leading' && h.agency >= 70) triggered = true;
        break;
      }
      default:
        break;
    }

    if (triggered) {
      sl.stageIndex += 1;
      ctx.pushEvent({ type: 'storyStage', round: ctx.round, storyId: sl.id, stageIndex: sl.stageIndex });
      // 效果键解析（trust+3 / industryBase+5 / participation+8）
      if (stage.effect) {
        const m = stage.effect.match(/(\w+)([+-]\d+)/);
        if (m) {
          const key = m[1];
          const val = Number(m[2]);
          if (key === 'trust') state.county.trust = Math.max(0, Math.min(100, state.county.trust + val));
          if (key === 'industryBase') {
            const v = state.villages.find((x) => x.id === h?.villageId);
            if (v) v.industryBase = Math.min(100, v.industryBase + val);
          }
          if (key === 'participation') {
            const v = state.villages.find((x) => x.id === h?.villageId);
            if (v) v.participation = Math.min(100, v.participation + val);
          }
        }
      }
      ctx.pushLedger('transition', `story_${sl.id}_${sl.stageIndex}`, 6, `${cfg.title} 故事推进`);
      ctx.addStars(8);
    }
  }
}

/** 里程碑（解锁能力 + 记账，非纯资源）：同时发放治理经验点（G3） */
export function settleMilestones(state: GameState, ctx: TurnCtx): void {
  if (!config.balance.milestoneRounds.includes(ctx.round)) return;
  if (state.unlocked.milestones.includes(`ms_${ctx.round}`)) return;
  state.unlocked.milestones.push(`ms_${ctx.round}`);
  state.county.skillPoints += 1; // 8 个里程碑各 1 点，全满 12 点 → 必须取舍
  ctx.pushEvent({ type: 'milestone', round: ctx.round, milestoneId: `ms_${ctx.round}` });
  ctx.pushLedger('transition', `milestone_${ctx.round}`, 4, `里程碑 r${ctx.round}`);
}

/** 回合收尾：连击状态写回 + 微反馈文案抽奖（平衡型回合） */
export function settleCombo(state: GameState, ctx: TurnCtx): void {
  state.combo = ctx.combo;
  if (state.combo.streak >= 3) {
    ctx.pushFeedback('mf_model_cadre', 'mf_model_cadre_text');
  }
}
