import type { GameState, SynergyRecipe } from '../types';
import { detectVillageSynergies } from '../sandbox/industryEngine';
import { synergyRecipes } from '../../config/industry';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// §14 涌现式融合（第二批）：流派解锁 + 头衔 + 事件联动
// 头衔（synergyTitles）存 recipeId；效果经 synergyMulOf 在产业结算生效
// ============================================================

/** 该村所有已解锁流派的最高产出倍率（多条不叠加，取最强） */
export function synergyMulOf(state: GameState, villageId: string): number {
  const v = state.villages.find((x) => x.id === villageId);
  if (!v || v.synergyTitles.length === 0) return 1;
  let best = 1;
  for (const rid of v.synergyTitles) {
    const recipe = synergyRecipes.find((r) => r.id === rid);
    if (recipe && recipe.outputMultiplier > best) best = recipe.outputMultiplier;
  }
  return best;
}

/** 该村是否已解锁某条配方 */
export function hasSynergy(state: GameState, villageId: string, recipeId: string): boolean {
  const v = state.villages.find((x) => x.id === villageId);
  return !!v && v.synergyTitles.includes(recipeId);
}

/**
 * 回合内流派结算：检测各村新命中的配方并解锁。
 * 新解锁 → 写入头衔 + synergyUnlocked 事件 + 微反馈 + 星/账/连击。
 */
export function settleVillageSynergies(state: GameState, ctx: TurnCtx): void {
  for (const v of state.villages) {
    const hits: SynergyRecipe[] = detectVillageSynergies(state, v.id);
    for (const recipe of hits) {
      if (v.synergyTitles.includes(recipe.id)) continue;
      v.synergyTitles.push(recipe.id);
      ctx.pushEvent({ type: 'synergyUnlocked', round: ctx.round, villageId: v.id, recipeId: recipe.id });
      ctx.pushFeedback(config.text.mf_synergy, config.text.mf_synergy_text);
      ctx.addStars(12);
      ctx.pushLedger('achievement', 'synergy', 6, `涌现式融合：${recipe.name}`);
      ctx.noteCombo('solid');
    }
  }
}
