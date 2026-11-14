import type { GameState, LedgerEntry, LedgerKind, LedgerSummary } from '../types';
import { config } from '../../config';

// ============================================================
// 四本账：成就 / 代价 / 组织 / 转换
// 入账与汇总。陷阱奖励单独列出（终局复盘用）。
// ============================================================

export function commitLedger(state: GameState, entries: LedgerEntry[]): void {
  state.ledger.entries.push(...entries);
}

export function summarizeLedger(state: GameState): LedgerSummary {
  const sum = (kind: LedgerKind) =>
    state.ledger.entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.value, 0);
  return {
    achievement: sum('achievement'),
    cost: sum('cost'),
    org: sum('org'),
    transition: sum('transition'),
    trapEntries: state.trapRewards.map((t) => ({ rewardId: t.rewardId, round: t.round, cost: t.cost })),
  };
}

/** 陷阱复盘：把「奖励其实是债」标出来 */
export function trapReview(state: GameState): { rewardId: string; title: string }[] {
  const seen = new Set<string>();
  const out: { rewardId: string; title: string }[] = [];
  for (const t of state.trapRewards) {
    if (seen.has(t.rewardId)) continue;
    seen.add(t.rewardId);
    const cfg = config.rewards.find((r) => r.id === t.rewardId);
    if (cfg && cfg.isTrap) {
      out.push({ rewardId: t.rewardId, title: cfg.trapCost ?? '' });
    }
  }
  return out;
}
