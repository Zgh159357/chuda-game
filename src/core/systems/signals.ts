import type { GameState, RiskKind } from '../types';
import { config } from '../../config';
import { pick, randInt } from '../rng';
import type { TurnCtx } from './context';

// ============================================================
// 系统：定性模糊信号（P5）
// 每回合 1—2 条，只给描述不给数字；追查耗行动力，忽略则风险积累。
// ============================================================

const signalTexts: Record<RiskKind, string[]> = {
  trust: ['signal_trust_1', 'signal_trust_2'],
  debt: ['signal_debt_1', 'signal_debt_2'],
  return: ['signal_return_1', 'signal_return_2'],
  org: ['signal_org_1', 'signal_org_2'],
};

export function settleSignals(state: GameState, ctx: TurnCtx): void {
  const [lo, hi] = config.balance.signalsPerRound;
  const n = randInt(ctx.rng, lo, hi);

  // 按实际风险加权选择信号类型
  const weighted: RiskKind[] = [];
  if (state.county.debtRisk > 40) weighted.push('debt', 'debt');
  if (state.county.trust < 55) weighted.push('trust');
  const riskVillages = state.villages.some((v) => v.returnRisk > 55);
  if (riskVillages) weighted.push('return', 'return');
  const embedHigh = state.villages.some((v) => v.externalEmbed > 60);
  if (embedHigh) weighted.push('org');
  if (weighted.length === 0) weighted.push('trust', 'org');

  for (let i = 0; i < n; i++) {
    const kind = pick(ctx.rng, weighted);
    const textId = pick(ctx.rng, signalTexts[kind]);
    const id = `sig_${ctx.round}_${i}_${kind}`;
    state.signals.push({ id, round: ctx.round, textId, riskKind: kind, investigated: false });
    ctx.pushEvent({ type: 'fuzzySignal', round: ctx.round, textId, riskKind: kind, investigated: false });
  }

  // 被忽略的信号：3 回合后风险悄悄落地（定性 → 定量）
  for (const sig of state.signals) {
    if (sig.investigated) continue;
    const age = ctx.round - sig.round;
    if (age < 3) continue;
    sig.investigated = true; // 已落地，不再重复
    switch (sig.riskKind) {
      case 'trust':
        state.county.trust = Math.max(0, state.county.trust - 3);
        ctx.pushLedger('cost', 'ignoredSignal', -3, '被忽略的信号：人心疏离');
        break;
      case 'debt':
        state.county.debtRisk = Math.min(100, state.county.debtRisk + 5);
        ctx.pushLedger('cost', 'ignoredSignal', -5, '被忽略的信号：债务暗涨');
        break;
      case 'return':
        for (const v of state.villages) v.returnRisk = Math.min(100, v.returnRisk + 6);
        ctx.pushLedger('cost', 'ignoredSignal', -6, '被忽略的信号：返贫风险');
        break;
      case 'org':
        for (const v of state.villages) v.internalGovernance = Math.max(0, v.internalGovernance - 3);
        ctx.pushLedger('cost', 'ignoredSignal', -3, '被忽略的信号：治理空心');
        break;
    }
  }
}
