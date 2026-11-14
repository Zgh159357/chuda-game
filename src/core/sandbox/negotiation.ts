// ============================================================
// 谈判博弈（Negotiation）纯函数 —— 主控提示词第七节
// 钉子户 / 低退出意愿户：打手牌对「顽固值」，赢了才推进。
// ============================================================
import type { GameState } from '../types';
import { config } from '../../config';

/** 户群的顽固值：越不愿退出越难谈（隐藏值，只在谈判界面揭晓）。
 *  曲线：退出意愿 0 → 70 顽固；50 → 40；70 → 28（封底 15）。
 *  最强两手牌（利益交换+法律威慑=65）对 70 顽固需靠点运气。 */
export function stubbornnessOf(groupId: string, state: GameState): number {
  const h = state.villages.flatMap((v) => v.households).find((g) => g.id === groupId);
  if (!h) return 100;
  return Math.max(15, Math.min(70, Math.round(70 - h.exitWillingness * 0.6)));
}

export interface NegotiationResult {
  won: boolean;
  total: number;
  stubbornness: number;
  roll: number;
}

/** 结算一场谈判：Σ手牌说服力 + 运气(−10..10) ≥ 顽固值 → 赢 */
export function resolveNegotiation(
  state: GameState,
  groupId: string,
  handIds: string[],
  rng: () => number,
): NegotiationResult {
  const stubbornness = stubbornnessOf(groupId, state);
  let total = 0;
  for (const id of handIds) {
    const spec = config.negotiationHands.find((h) => h.id === id);
    if (spec) total += spec.value;
  }
  const roll = Math.round((rng() * 2 - 1) * 10);
  const won = total + roll >= stubbornness;
  return { won, total, stubbornness, roll };
}
