// ============================================================
// 人才（Hero Talent）—— 主控提示词第九节：图鉴式触发招募
// 不再随机抽卡：每个人才都有事件链触发条件 + 两难抉择。
// 红线：不做英雄叙事——人才是村里本来就有的能人，不是天降救星。
// ============================================================
import type { GameState, HeroFlawKind, HeroTalentKind } from '../types';
import { config } from '../../config';
import { chainOf } from '../../config/heroChains';
import { optionAffordable, rollRecruitOption } from '../../logic/heroChain';
import type { TurnCtx } from './context';

/** 某村人才中某类增益值的总和（病倒中的人才不计；extraTalent 双绝活一并计入） */
export function heroSum(state: GameState, villageId: string, kind: HeroTalentKind): number {
  let sum = 0;
  for (const h of state.heroes) {
    if (h.villageId !== villageId) continue;
    if (heroIsSick(state, h.heroId)) continue;
    const spec = config.heroes.find((x) => x.id === h.heroId);
    if (!spec) continue;
    if (spec.talentKind === kind) sum += spec.talentValue;
    if (spec.extraTalent && spec.extraTalent.kind === kind) sum += spec.extraTalent.value;
  }
  return sum;
}

/** 全县人才某类增益值的总和（全局型人才，如 fiscalEfficiency；extraTalent 一并计入） */
export function heroSumAll(state: GameState, kind: HeroTalentKind): number {
  let sum = 0;
  for (const h of state.heroes) {
    if (heroIsSick(state, h.heroId)) continue;
    const spec = config.heroes.find((x) => x.id === h.heroId);
    if (!spec) continue;
    if (spec.talentKind === kind) sum += spec.talentValue;
    if (spec.extraTalent && spec.extraTalent.kind === kind) sum += spec.extraTalent.value;
  }
  return sum;
}

/** 某村人才毒点总和 */
export function flawSum(state: GameState, villageId: string, kind: HeroFlawKind): number {
  let sum = 0;
  for (const h of state.heroes) {
    if (h.villageId !== villageId) continue;
    if (heroIsSick(state, h.heroId)) continue;
    const spec = config.heroes.find((x) => x.id === h.heroId);
    if (spec && spec.flawKind === kind) sum += spec.flawValue ?? 0;
  }
  return sum;
}

/** 全县人才毒点总和（全局型，如 greedyCost） */
export function flawSumAll(state: GameState, kind: HeroFlawKind): number {
  let sum = 0;
  for (const h of state.heroes) {
    if (heroIsSick(state, h.heroId)) continue;
    const spec = config.heroes.find((x) => x.id === h.heroId);
    if (spec && spec.flawKind === kind) sum += spec.flawValue ?? 0;
  }
  return sum;
}

/** 病倒周期：sickCycle 人才每 N 回合病倒一轮（入队回合不算） */
export function heroIsSick(state: GameState, heroId: string): boolean {
  const hero = state.heroes.find((h) => h.heroId === heroId);
  if (!hero || hero.recruitRound === undefined) return false;
  const spec = config.heroes.find((x) => x.id === heroId);
  if (!spec || spec.flawKind !== 'sickCycle') return false;
  const cycle = spec.flawValue ?? config.balance.heroSickCycle;
  const rounds = state.county.round - hero.recruitRound;
  // 入队后每满一个周期病倒（周期内最后一回合生效），本回合即为病倒回合
  return rounds > 0 && rounds % cycle === 0;
}

/**
 * §18 多阶段招募链结算（reducer 6.54 步）。
 * 每步选 1 个选项：付不起成本→原地跳过；掷骰失败→failCount+1 原地重试；
 * 成功→stepIndex+1；走完最后一步→正式入队 + passiveDebuff 挂账。
 */
export function settleHeroSteps(
  state: GameState,
  steps: { heroId: string; optionId: number }[] | undefined,
  ctx: TurnCtx,
): void {
  for (const st of steps ?? []) {
    if (!state.pendingRecruits.some((p) => p.heroId === st.heroId)) continue;
    const chain = chainOf(st.heroId);
    const spec = config.heroes.find((x) => x.id === st.heroId);
    if (!chain || !spec) continue;
    const prog = state.heroChains[st.heroId];
    if (!prog) continue;
    const step = chain.recruitSteps[prog.stepIndex];
    const option = step?.options[st.optionId];
    if (!step || !option) continue;

    // 成本闸门：付不起就当作没操作（UI 已禁用，这里防御）
    const afford = optionAffordable(state, st.heroId, option);
    if (!afford.ok) continue;

    // 付成本
    const cost = option.cost ?? {};
    if (cost.funds) state.county.fiscalFund -= cost.funds;
    if (cost.politicalCapital) state.county.politicalCapital = Math.max(0, state.county.politicalCapital - cost.politicalCapital);
    if (cost.trust) state.county.trust = Math.max(0, Math.min(100, state.county.trust - cost.trust));
    if (cost.targetVillageGovernance) {
      const v = state.villages.find((x) => x.id === prog.villageId);
      if (v) v.internalGovernance = Math.max(0, Math.round((v.internalGovernance - cost.targetVillageGovernance) * 10) / 10);
    }

    if (rollRecruitOption(ctx.rng, option)) {
      prog.stepIndex += 1;
      if (prog.stepIndex >= chain.recruitSteps.length) {
        // 走完全链 → 入队
        state.heroes.push({ heroId: spec.id, villageId: prog.villageId ?? '', recruitRound: ctx.round });
        state.pendingRecruits = state.pendingRecruits.filter((p) => p.heroId !== st.heroId);
        ctx.pushEvent({ type: 'recruitAccepted', round: ctx.round, heroId: spec.id });
        ctx.pushLedger('transition', `recruit_${spec.id}`, 8, `人才入队：${spec.role} ${spec.name}`);
        ctx.addStars(12);
        ctx.pushFeedback('mf_model_cadre', 'recruit_done_text');
      }
    } else {
      prog.failCount += 1;
      ctx.pushEvent({ type: 'heroStepFail', round: ctx.round, heroId: spec.id });
      ctx.pushLedger('cost', `recruit_fail_${spec.id}`, -1, `招募受挫：${spec.name}`);
    }
  }
}

/** §18 婉拒：撤下待办，结算 declineCosts，declineCloses 则永不触发 */
export function settleHeroDeclines(
  state: GameState,
  declines: string[] | undefined,
  ctx: TurnCtx,
): void {
  for (const heroId of declines ?? []) {
    if (!state.pendingRecruits.some((p) => p.heroId === heroId)) continue;
    const chain = chainOf(heroId);
    const spec = config.heroes.find((x) => x.id === heroId);
    if (!chain || !spec) continue;
    state.declinedRecruits.push(heroId);
    if (chain.declineCosts) {
      if (chain.declineCosts.fiscal) state.county.fiscalFund -= chain.declineCosts.fiscal;
      if (chain.declineCosts.politicalCapital) state.county.politicalCapital = Math.max(0, state.county.politicalCapital - chain.declineCosts.politicalCapital);
      if (chain.declineCosts.trust) state.county.trust = Math.max(0, Math.min(100, state.county.trust - chain.declineCosts.trust));
    }
    state.pendingRecruits = state.pendingRecruits.filter((p) => p.heroId !== heroId);
    ctx.pushEvent({ type: 'recruitDeclined', round: ctx.round, heroId });
    ctx.pushLedger('cost', `recruit_decline_${heroId}`, -4, `婉拒招募：${spec.name}`);
  }
}

/** §18 体制摩擦：已入队人才的 passiveDebuff 每回合隐性扣减（transmission 段调用） */
export function applyHeroDebuffs(state: GameState, ctx: TurnCtx): void {
  const METRIC_MAX: Record<string, number> = { politicalCapital: 100, trust: 100, fiscalFund: Infinity };
  for (const h of state.heroes) {
    if (heroIsSick(state, h.heroId)) continue;
    const chain = chainOf(h.heroId);
    const debuff = chain?.passiveDebuff;
    if (!debuff) continue;
    const cap = METRIC_MAX[debuff.metric];
    if (debuff.metric === 'politicalCapital') {
      state.county.politicalCapital = Math.max(0, Math.min(cap ?? 100, Math.round((state.county.politicalCapital - debuff.value) * 10) / 10));
    } else if (debuff.metric === 'trust') {
      state.county.trust = Math.max(0, Math.min(100, Math.round((state.county.trust - debuff.value) * 10) / 10));
    } else if (debuff.metric === 'fiscalFund') {
      state.county.fiscalFund = Math.max(0, Math.round((state.county.fiscalFund - debuff.value) * 10) / 10);
    }
  }
}

/** 本回合人才派驻调整：改 villageId */
export function resolveHeroAssign(
  state: GameState,
  assigns: { heroId: string; villageId: string }[] | undefined,
  _ctx: TurnCtx,
): void {
  for (const asg of assigns ?? []) {
    const hero = state.heroes.find((h) => h.heroId === asg.heroId);
    if (!hero) continue;
    if (asg.villageId !== '' && !state.villages.some((v) => v.id === asg.villageId)) continue;
    hero.villageId = asg.villageId;
  }
}
