import type { CheckpointId, GameState, PhaseId, Round } from '../types';
import { config } from '../../config';

// ============================================================
// 状态机：阶段推导 / 大考节点 / 组织密度曲线
// ============================================================

/** 纯查表：回合 → 阶段 */
export function derivePhase(round: Round): PhaseId {
  for (const p of config.phases) {
    if (round >= p.rounds[0] && round <= p.rounds[1]) return p.id;
  }
  return 'E';
}

export function phaseName(phase: PhaseId): string {
  return config.phases.find((p) => p.id === phase)?.name ?? phase;
}

/** 回合 → 该回合的大考节点 */
export function checkpointAt(round: Round): CheckpointId[] {
  return config.checkpoints.filter((c) => c.round === round).map((c) => c.id);
}

/**
 * 组织密度曲线：A/B/C 向阶段目标线性逼近，D 每回合 −5（半年×每年−10），
 * E 维持 40–60 区间（<40 治理乏力，>60 形式主义风险）。
 */
export function orgDensityCurve(round: Round, phase: PhaseId, current: number): number {
  const spec = config.phases.find((p) => p.id === phase);
  if (!spec) return current;
  const [lo, hi] = spec.rounds;
  if (spec.orgDensityMode === 'band') {
    // E 阶段：自然回落向区间内，同时钳制在 [bandMin, bandMax]
    const { bandMin, bandMax } = config.balance.orgDensity;
    const drift = current > bandMax ? -2 : current < bandMin ? 2 : current > (bandMin + bandMax) / 2 ? -1 : 1;
    return Math.max(bandMin, Math.min(bandMax, current + drift));
  }
  if (phase === 'D') {
    return Math.max(40, current - config.balance.orgDensity.forcedDropPerRound);
  }
  const [from, to] = spec.orgDensityTarget;
  const total = hi - lo + 1;
  const step = (to - from) / Math.max(1, total - 1);
  const pos = round - lo;
  const target = Math.round(from + step * pos);
  // 靠近目标：缓慢修正（允许玩家行为偏离曲线，但目标引力存在）
  const pull = (target - current) * 0.35;
  return Math.max(5, Math.min(95, current + pull));
}

/** 阶段切换时是否进入新阶段 */
export function phaseChanged(oldState: GameState, newRound: Round): boolean {
  return oldState.county.phase !== derivePhase(newRound);
}
