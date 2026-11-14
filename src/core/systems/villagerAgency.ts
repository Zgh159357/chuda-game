import type { GameState } from '../types';
import { config } from '../../config';
import { pick, randInt } from '../rng';
import { skillSum } from '../skills';
import { wonderSum } from './wonders';
import { heroSum, flawSum } from './heroes';
import type { TurnCtx } from './context';

// ============================================================
// 系统：村民主体性（P2）
// 每回合 1—3 条村民自主事件；村民有主动性隐藏值（agency），
// 会提方案、会观察玩家、会背后议论。
// §8：奇观「县域职教中心」每回合抬群众参与；人才「退休老支书」同。
// §9：人才局域增益（返贫风险下行/搬迁意愿/冷遇毒点）在此结算。
// ============================================================

export function settleVillagerAgency(state: GameState, ctx: TurnCtx): void {
  const [lo, hi] = config.balance.villagerEventsPerRound;
  const n = randInt(ctx.rng, lo, hi);
  const eventTexts = ['villager_evt_1', 'villager_evt_2', 'villager_evt_3', 'villager_evt_4', 'villager_evt_5', 'villager_evt_6', 'villager_evt_7', 'villager_evt_8'];

  const agencyGrowth = skillSum(state, 'agencyGrowth'); // 群众工作线技能加成
  const eduPush = wonderSum(state, 'educationAgency'); // 奇观：职教中心

  for (const v of state.villages) {
    // 奇观「县域职教中心」+ 人才「退休老支书」：参与每回合提升
    const glue = heroSum(state, v.id, 'socialGlue');
    if (eduPush > 0 || glue > 0) {
      v.participation = Math.min(100, v.participation + eduPush + glue);
      if (glue > 0) state.county.trust = Math.min(100, state.county.trust + glue * 0.2);
    }
    // §9 人才局域：兽医/气象员/老中医/护士 压返贫风险；韩焊工冷遇伤人
    const riskCut = heroSum(state, v.id, 'returnRiskCut');
    const cold = flawSum(state, v.id, 'coldShoulder');
    if (riskCut > 0) {
      v.returnRisk = Math.max(0, v.returnRisk - riskCut);
    }
    if (cold > 0) {
      v.participation = Math.max(0, v.participation - cold);
    }
    // §9 人才局域：林联络员做通搬迁户工作
    const relocateBoost = heroSum(state, v.id, 'relocateBoost');
    if (relocateBoost > 0) {
      for (const h of v.households) {
        if (h.tag === 'remote') {
          h.exitWillingness = Math.min(100, h.exitWillingness + relocateBoost);
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const textId = pick(ctx.rng, eventTexts);
    const source = pick(ctx.rng, state.villages).id;
    ctx.pushEvent({ type: 'villagerInitiative', round: ctx.round, source, textId });

    // 参与与信任微幅上升：村民在行动
    const v = state.villages.find((x) => x.id === source);
    if (v) {
      v.participation = Math.min(100, v.participation + randInt(ctx.rng, 1, 2));
      v.internalGovernance = Math.min(100, v.internalGovernance + 0.5 + agencyGrowth * 0.5);
    }
  }

  // 提案：高主动性户群提出方案（玩家可采纳）
  const proactive = state.villages.flatMap((v) => v.households).filter((h) => h.agency >= 55);
  const proposalChance = config.balance.proposalChance + skillSum(state, 'proposalChance');
  for (const h of proactive) {
    if (ctx.rng() < proposalChance) {
      const proposalTextId = pick(ctx.rng, ['villager_proposal_1', 'villager_proposal_2', 'villager_proposal_3', 'villager_proposal_4', 'villager_proposal_5']);
      const id = `prop_${ctx.round}_${h.id}`;
      state.pendingProposals.push({ id, round: ctx.round, source: h.id, textId: proposalTextId });
      ctx.pushEvent({
        type: 'villagerInitiative',
        round: ctx.round,
        source: h.id,
        textId: proposalTextId,
        proposal: id,
      });
    }
  }

  // 村民观察玩家：信任低时议论
  if (state.county.trust < 35 && ctx.rng() < 0.4) {
    ctx.pushEvent({ type: 'villagerInitiative', round: ctx.round, source: state.villages[0].id, textId: 'villager_evt_6' });
  }
}
