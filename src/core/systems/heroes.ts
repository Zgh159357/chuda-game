// ============================================================
// 人才（Hero Talent）—— 主控提示词第九节：图鉴式触发招募
// 不再随机抽卡：每个人才都有事件链触发条件 + 两难抉择。
// 红线：不做英雄叙事——人才是村里本来就有的能人，不是天降救星。
// ============================================================
import type { GameState, HeroFlawKind, HeroTalentKind } from '../types';
import { config } from '../../config';
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
 * 人才两难抉择结算（reducer 6.54 步）：接受/拒绝。
 * 接受：扣 acceptCosts + 入队（heroes.push{heroId, villageId:'', recruitRound}）+ 事件 + 账。
 * 拒绝：declinePenalty 由调用方文本呈现，这里只记 declinedRecruits + 事件 + 账。
 */
export function settleRecruitChoices(
  state: GameState,
  choices: { heroId: string; accepted: boolean }[] | undefined,
  ctx: TurnCtx,
): void {
  for (const ch of choices ?? []) {
    // 只在待抉择队列里的才有效
    if (!state.pendingRecruits.some((p) => p.heroId === ch.heroId)) continue;
    const spec = config.heroes.find((x) => x.id === ch.heroId);
    if (!spec || !spec.recruit) continue;
    const rec = spec.recruit;
    if (ch.accepted) {
      const costs = rec.acceptCosts ?? {};
      state.county.fiscalFund -= costs.fiscal ?? 0;
      if (costs.politicalCapital !== undefined) state.county.politicalCapital += costs.politicalCapital;
      if (costs.trust !== undefined) state.county.trust = Math.max(0, Math.min(100, state.county.trust + costs.trust));
      state.heroes.push({ heroId: spec.id, villageId: '', recruitRound: ctx.round });
      ctx.pushEvent({ type: 'recruitAccepted', round: ctx.round, heroId: spec.id });
      ctx.pushLedger('transition', `recruit_${spec.id}`, 8, `人才入队：${spec.role} ${spec.name}`);
      ctx.addStars(12);
    } else {
      state.declinedRecruits.push(spec.id);
      ctx.pushEvent({ type: 'recruitDeclined', round: ctx.round, heroId: spec.id });
      ctx.pushLedger('cost', `recruit_decline_${spec.id}`, -4, `两难抉择拒绝：${spec.name}`);
    }
    // 从待抉择队列移除（无论接受与否）
    state.pendingRecruits = state.pendingRecruits.filter((p) => p.heroId !== ch.heroId);
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
