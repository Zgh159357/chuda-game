import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// 系统：东西协作闭环
// 东部意愿为隐藏值：随机漂移 + 形式主义拖累 + 协作资金投入绑定。
// ============================================================

export function settleCollaboration(state: GameState, ctx: TurnCtx): void {
  const c = state.county;

  // 隐藏值漂移：向 50 回归 + 噪声
  const noise = (ctx.rng() - 0.5) * 8;
  const regression = (50 - c.eastWillingness) * 0.1;
  c.eastWillingness = Math.max(0, Math.min(100, c.eastWillingness + noise + regression));

  // 形式主义拖累意愿（东部看实效）
  c.eastWillingness = Math.max(0, c.eastWillingness - c.formality / 30);

  // 协作资金入账：受意愿与第三方透明度影响
  const transparency = c.thirdPartyCoverage / 100;
  const income = config.balance.coopPerRound * (0.3 + 0.7 * (c.eastWillingness / 100)) * (0.6 + 0.4 * transparency);
  c.cooperationFund += Math.round(income);

  if (c.eastWillingness < 25) {
    ctx.pushLedger('transition', 'eastCool', -3, '东部意愿低迷');
  }
}
