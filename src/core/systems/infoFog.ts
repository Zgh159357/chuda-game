import type { GameState } from '../types';
import type { TurnCtx } from './context';
import { heroSum } from './heroes';

// ============================================================
// 系统：信息迷雾与建档立卡
// 县精度 = 各村精度的加权平均；未建档户群拖累精度。
// §8：人才「高级农技专家」坐镇村，精度每回合细水长流。
// ============================================================

export function settleInfoFog(state: GameState, ctx: TurnCtx): void {
  // 未建档户群 → 村精度修正（迷雾仍在）
  for (const v of state.villages) {
    const unregistered = v.households.filter((h) => !h.registered).length;
    if (unregistered > 0) {
      v.infoAccuracy = Math.max(0, v.infoAccuracy - unregistered * 0.5);
    }
    // 人才坐镇：精度每回合 +0.5；否则自然漂移缓慢衰减
    const techGuide = heroSum(state, v.id, 'techGuide');
    v.infoAccuracy = Math.max(0, Math.min(100, v.infoAccuracy + (techGuide > 0 ? 0.5 : -0.5)));
  }

  const total = state.villages.length;
  state.county.infoAccuracy = total === 0 ? 0 : Math.round(state.villages.reduce((s, v) => s + v.infoAccuracy, 0) / total);

  // 建档进度入账
  const registered = state.villages.flatMap((v) => v.households).filter((h) => h.registered).length;
  const all = state.villages.flatMap((v) => v.households).length;
  if (registered > 0) {
    ctx.pushLedger('achievement', 'registered', Math.round((registered / Math.max(1, all)) * 10), '建档进度');
  }
  // 未建档的缺劳力户群：底线风险计时（供 hardFailure 判定）
  for (const v of state.villages) {
    for (const h of v.households) {
      if (h.tag === 'noLabor' && h.registered && !h.covered) {
        h.uncoveredRounds = (h.uncoveredRounds ?? 0) + 1;
      } else {
        h.uncoveredRounds = 0;
      }
    }
  }
}
