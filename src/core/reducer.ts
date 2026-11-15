import type { GameState, PhaseId, Quarter, Round, RoundActions, RoundOutcome, RoundRecord, Year } from './types';
import { config } from '../config';
import { seedRng } from './rng';
import { createTurnCtx } from './systems/context';
import { evaluateCheckpoints } from './systems/checkpoints';
import { resolveActions } from './systems/actions';
import { settleVillagerAgency } from './systems/villagerAgency';
import { settleSignals } from './systems/signals';
import { settleInfoFog } from './systems/infoFog';
import { settleTargeting } from './systems/targeting';
import { settleOrganization } from './systems/organization';
import { settleIndustry } from './systems/industry';
import { settleResettlement } from './systems/resettlement';
import { settleSubsidy } from './systems/subsidy';
import { settleCollaboration } from './systems/collaboration';
import { settleAssessment } from './systems/assessment';
import { settleTransmission } from './systems/transmission';
import { checkHardFailure } from './systems/hardFailure';
import { settleAchievements, settleStorylines, settleMilestones, settleCombo } from './systems/rewards';
import { regenCadres, resolveCadreActions, settleCadres } from './systems/cadres';
import { drawEventFiles, resolveEventDecisions, expireEventFiles } from './systems/events';
import { settleTechUnlocks, settleImplicitTech, techSum } from './systems/techTree';
import { settleWonderInvest, settleWonderUpkeep } from './systems/wonders';
import { resolveHeroAssign, settleRecruitChoices, heroSumAll, heroIsSick, flawSumAll } from './systems/heroes';
import { evaluateHeroRecruits } from './systems/unlockEngine';
import { settleFloorDefense, settleResilience } from './systems/resilience';
import { settleVillageSynergies } from './systems/synergy';
import { settleZoning } from './sandbox/zoning';
import { applyLogistics } from './sandbox/logistics';
import { computeStars } from './settlement/stars';
import { commitLedger } from './settlement/ledger';
import { computeFiveRatings, decideEnding } from './settlement/ending';
import { derivePhase } from './state/phaseMachine';

// ============================================================
// 回合管线 reducer：唯一允许 import 全部系统的位置。
// 系统间零 import，跨系统数据只走这里。
// 语义：playRound(prev) 结算 prev.county.round 这一回合，
//       结束后 state.round 推进到下一回合（终局/硬失败则停住）。
// 顺序固定：阶段转换→大考→行动→村民→系统结算→传导→硬失败→奖励→星级/账/history
// 重构新增：干部精力（regen/行动/settle）、公文发牌（round 开始）、
//           公文批复（行动层）、逾期自动结算（round 末）。
// ============================================================

/** 从回合号确定性派生 rng 种子（同 seed+round 永远同结果） */
function hashSeed(seed: number, round: Round): number {
  let h = seed >>> 0;
  h = (h ^ Math.imul(round, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  return h;
}

/** 解析时间标签 → year/quarter（保持显示一致） */
function parseTimeLabel(label: string): { year: Year; quarter: Quarter } {
  const m = label.match(/^(\d{4})(H1|H2|Q([1-4]))/);
  if (!m) return { year: 2030, quarter: 1 };
  const year = Number(m[1]) as Year;
  const quarter = (m[2] === 'H1' ? 1 : m[2] === 'H2' ? 3 : Number(m[3])) as Quarter;
  return { year, quarter };
}

/** 阶段转换：解锁该阶段政策卡 + 开场文案 */
function applyPhaseTransition(state: GameState, prevPhase: PhaseId, round: Round, ctx: ReturnType<typeof createTurnCtx>): void {
  const phase = state.county.phase;
  if (phase === prevPhase) return;
  for (const p of config.policies) {
    if (p.phase === phase && !state.unlocked.policies.includes(p.id)) {
      state.unlocked.policies.push(p.id);
    }
  }
  ctx.pushEvent({ type: 'phaseChange', round, phase, textId: `phase_${phase.toLowerCase()}_enter` });
}

/** 回合收入：财政拨付 + 干部精力恢复 + 组长个人精力恢复（重构：cadrePower = Σ干部精力） */
function applyIncome(state: GameState): void {
  const c = state.county;
  c.fiscalFund += config.balance.fiscalPerRound;
  // §9：机制树「小额信贷/虚假招商」与人才「钱所长/鲁会计」的财政效率
  c.fiscalFund += techSum(state, 'fiscalPerRound') + heroSumAll(state, 'fiscalEfficiency');
  regenCadres(state);
  // 双层视图：每回合开始恢复组长个人精力（§10 老支书毒点：精力上限 −staminaCap）
  const staminaCapCut = flawSumAll(state, 'staminaCap');
  c.playerStamina = Math.max(1, config.balance.playerStaminaMax - staminaCapCut);
}

/** §9：因果律记账——事件历史 + 连击/暗访相关的长期状态 */
function settleCausality(state: GameState, ctx: ReturnType<typeof createTurnCtx>, prevFraudCount: number): void {
  // 事件历史（去重追加，上限 60）
  for (const ev of ctx.events) {
    const key = `${ev.type}`;
    if (state.eventHistory.length >= 60) state.eventHistory.shift();
    state.eventHistory.push(key);
  }
  // 造假干净连击 / 敷衍连击（C 批复=瞒报 → fraudRecords 增长）
  const fraudThisRound = state.fraudRecords.length > prevFraudCount;
  state.streaks.fraudClean = fraudThisRound ? 0 : state.streaks.fraudClean + 1;
  state.streaks.cutCorners = fraudThisRound ? state.streaks.cutCorners + 1 : 0;
}

export function playRound(prev: GameState, actions: RoundActions, maxRounds: Round = 50): RoundOutcome {
  if (prev.status === 'ended') {
    throw new Error('本局已结束，不能再推进回合。');
  }

  // 1. 深拷贝工作副本；round = 本回合（prev 里存的就是待结算回合）
  const state: GameState = structuredClone(prev);
  const round = state.county.round;
  const prevPhase = state.county.phase;
  const prevFraudCount = prev.fraudRecords.length;

  // 2. 时间与阶段
  state.county.phase = derivePhase(round);
  const label = config.timeLabels[round - 1];
  if (label) {
    const { year, quarter } = parseTimeLabel(label);
    state.county.year = year;
    state.county.quarter = quarter;
  }

  const rng = seedRng(hashSeed(state.seed, round));
  const ctx = createTurnCtx(state, rng, round);

  // 3. 收入
  applyIncome(state);

  // 3.5 §9 奇观维护费（万人安置区等吸血项目，财政不足转债务）
  settleWonderUpkeep(state, ctx);

  // 4. 阶段转换（解锁卡 + 开场文案）
  applyPhaseTransition(state, prevPhase, round, ctx);

  // 4.5 公文发牌（重构：事件文件入箱）
  drawEventFiles(state, ctx);

  // 5. 大考评估（用上一回合的账面）
  evaluateCheckpoints(state, ctx);

  // 6. 干部行动（重构：换岗驻村 / 入户摸排——摸排先行，本回合施策即享受揭雾效果）
  resolveCadreActions(state, actions, ctx);

  // 6.5 行动解析（扣资源 / 出卡 / 建档 / 派队 / 处置 / 追查 / 修复 / 节点交互 / 弃批）
  resolveActions(state, actions, ctx);

  // 6.51 §8 机制树解锁（耗政治资本）
  settleTechUnlocks(state, actions.techUnlocks, ctx);

  // 6.52 §8 超级工程投入（分期砸财政）
  settleWonderInvest(state, actions.wonderInvest, ctx);

  // 6.53 §8 人才派驻（人才觉醒在摸排时发生）
  resolveHeroAssign(state, actions.heroAssign, ctx);

  // 6.54 §9 人才两难抉择结算（接受/拒绝）
  settleRecruitChoices(state, actions.recruitChoices, ctx);

  // 6.56 §9 隐式解锁：敷衍成性 → 「台账美化」自动解锁（无成本，代价自担）
  settleImplicitTech(state, ctx);

  // 6.57 §9 人才觉醒：事件链触发两难招募（沈书记/老赵头等）
  const offered = evaluateHeroRecruits(state);
  for (const spec of offered) {
    if (!spec.recruit) continue;
    state.pendingRecruits.push({ heroId: spec.id, question: spec.recruit.question });
    ctx.pushEvent({ type: 'recruitOffered', round, heroId: spec.id });
    ctx.pushFeedback('mf_villager_card', 'recruit_offered_text');
  }

  // 6.58 §9 人才病倒（沈书记这类周期倒下的，本回合增益失效并上报）
  for (const h of state.heroes) {
    if (heroIsSick(state, h.heroId)) {
      ctx.pushEvent({ type: 'heroSick', round, heroId: h.heroId });
      ctx.pushLedger('cost', `hero_sick_${h.heroId}`, -2, '人才病倒休养，增益暂停');
    }
  }

  // 6.55 规划画区（Zoning：框选地块规划用途，长期空间决策，本版仅空间标注）
  settleZoning(state, actions.zoning);

  // 6.6 公文批复（重构：按玩家批复结算）
  resolveEventDecisions(state, actions, ctx);

  // 7. 村民自主事件（P2）
  settleVillagerAgency(state, ctx);

  // 8. 模糊信号（P5）
  settleSignals(state, ctx);

  // 9. 系统结算（顺序固定）
  settleInfoFog(state, ctx);
  settleTargeting(state, ctx);
  settleOrganization(state, actions, ctx);
  settleFloorDefense(state, ctx); // §10 底线防御：内生治理将破 20 → 自动拨财政锁底（组织之后）
  settleIndustry(state, ctx);
  applyLogistics(state, ctx); // 物流/产业链：工厂项目缺原料/道路/物流站 → 烂尾+扣财政
  settleVillageSynergies(state, ctx); // §14 涌现式融合：资源标签 × 产业标签 → 流派解锁
  settleResettlement(state, ctx);
  settleSubsidy(state, ctx);
  settleCollaboration(state, ctx);
  settleAssessment(state, ctx);

  // 10. 传导与状态更新
  settleTransmission(state, ctx);

  // 10.1 §10 组织韧性结算（恢复 +5/回合；本回合有入户走访/摸排 +5）
  const hadVisit =
    (actions.cards ?? []).includes('a_visit') || (actions.surveyVillages?.length ?? 0) > 0;
  settleResilience(state, ctx, hadVisit);

  // 10.5 干部收尾（重构：疲劳/士气漂移 + 过劳判定）
  settleCadres(state, ctx);

  // 10.6 逾期公文自动结算（重构）
  expireEventFiles(state, ctx);

  // 11. 硬失败判定
  checkHardFailure(state, ctx);

  // 12. 奖励结算
  settleAchievements(state, ctx);
  settleStorylines(state, ctx);
  settleMilestones(state, ctx);
  settleCombo(state, ctx);

  // 13. 星级 + 入账 + 终局
  const stars = computeStars(ctx.starScore);
  commitLedger(state, ctx.ledgerDelta);

  let gameStatus: 'running' | 'ended' = state.status;
  if (!ctx.ended && round >= maxRounds) {
    ctx.ended = true;
  }
  if (ctx.ended) {
    gameStatus = 'ended';
    state.status = 'ended';
    const ratings = computeFiveRatings(state);
    state.ending = decideEnding(state, ratings, ctx.failures);
    state.county.canHoldIndex =
      state.villages.length === 0
        ? 0
        : state.villages.reduce((s, v) => s + v.canHoldIndex, 0) / state.villages.length;
  }

  const outcome: RoundOutcome = {
    round,
    state,
    events: ctx.events,
    microFeedbacks: ctx.microFeedbacks,
    stars,
    checkpoints: ctx.checkpoints,
    failures: ctx.failures,
    ledgerDelta: ctx.ledgerDelta,
    gameStatus,
  };

  // 13.5 §9 因果律记账：事件历史 + 干净/敷衍连击（解锁条件的长期记忆）
  settleCausality(state, ctx, prevFraudCount);

  // 14. 历史快照（先归档，再推进回合号）
  // ⚠ 快照必须先剔除 history 再克隆：history 里每条记录自带快照，
  // 若整棵树深拷贝，第 n 回合的克隆成本指数级增长（OOM 根因）。
  const { history: _archivedHistory, ...snapshotBody } = state;
  const record: RoundRecord = {
    round,
    outcome: {
      round,
      events: ctx.events,
      microFeedbacks: ctx.microFeedbacks,
      stars,
      checkpoints: ctx.checkpoints,
      failures: ctx.failures,
      ledgerDelta: ctx.ledgerDelta,
      gameStatus,
    },
    stateSnapshot: { ...structuredClone(snapshotBody), history: [] },
  };
  state.history.push(record);

  // 15. 回合推进：终局/硬失败则停在当回合，否则进入下一回合
  if (!ctx.ended) {
    state.county.round = (round + 1) as Round;
  }

  return outcome;
}
