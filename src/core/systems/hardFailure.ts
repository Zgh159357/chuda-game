import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// 硬失败判定（6 类）
// 底线失守 / 规模性返贫 / 债务暴雷 / 信任崩盘 / 政治资本出局 / 接不住
// ============================================================

export function checkHardFailure(state: GameState, ctx: TurnCtx): void {
  if (ctx.ended) return;
  const c = state.county;
  const hf = config.balance.hardFail;

  // 1. 无劳动能力未兜底：已建档 + 未兜底持续 3 回合 → 底线失守
  for (const v of state.villages) {
    for (const h of v.households) {
      if (h.tag === 'noLabor' && h.registered && !h.covered && (h.uncoveredRounds ?? 0) >= 3) {
        ctx.fail('bottomLineBreach');
        ctx.pushEvent({ type: 'fuzzySignal', round: ctx.round, textId: 'tip_no_labor', riskKind: 'return', investigated: false });
        return;
      }
    }
  }

  // 2. 规模性返贫失控：错过的预警窗口 ≥ 3
  if (state.missedReturnWarnings >= hf.returnWaveMissed) {
    ctx.fail('returnWave');
    return;
  }

  // 3. 债务生态暴雷
  if (c.debtRisk >= hf.debtCeiling) {
    ctx.fail('debtCollapse');
    return;
  }

  // 4. 信任崩盘
  if (c.trust <= hf.trustFloor) {
    ctx.fail('trustCollapse');
    return;
  }

  // 5. 政治资本 <20 且宽限期未挽回
  if (state.pcLowRounds >= hf.pcGraceRounds) {
    ctx.fail('politicalLoss');
    return;
  }

  // 6. 过渡期接不住村比例 >50%
  if (c.phase === 'D' || c.phase === 'E') {
    const total = state.villages.length;
    if (total > 0) {
      const bad = state.villages.filter((v) => v.canHoldIndex < config.formulas.canHold.threshold).length;
      if (bad / total > hf.canHoldRatioCeiling) {
        ctx.fail('canHoldCollapse');
        return;
      }
    }
  }
}
