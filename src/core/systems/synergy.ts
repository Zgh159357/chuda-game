import type { GameState, SynergyCatalyst, SynergyRecipe } from '../types';
import { detectVillageSynergies } from '../sandbox/industryEngine';
import { synergyRecipes } from '../../config/industry';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// §14/§15 涌现式融合：流派解锁 + 头衔 + 事件联动
// 头衔（synergyTitles）存 recipeId；产出倍率经 synergyMulOf 在产业结算生效
// §15 增补：持有头衔的每回合持续效果（effects）、反面配方（anti）。
// ============================================================

/** 该村所有已解锁流派的产出倍率：正面配方取最高；仅反面配方时被拖低 */
export function synergyMulOf(state: GameState, villageId: string): number {
  const v = state.villages.find((x) => x.id === villageId);
  if (!v || v.synergyTitles.length === 0) return 1;
  let best = 0;
  for (const rid of v.synergyTitles) {
    const recipe = synergyRecipes.find((r) => r.id === rid);
    if (recipe && recipe.outputMultiplier > best) best = recipe.outputMultiplier;
  }
  // 只挂着反面配方（<1）时被拖低；有正面配方时正面盖过烂点子
  return best >= 1 ? best : Math.max(0.1, best);
}

/** 该村是否已解锁某条配方 */
export function hasSynergy(state: GameState, villageId: string, recipeId: string): boolean {
  const v = state.villages.find((x) => x.id === villageId);
  return !!v && v.synergyTitles.includes(recipeId);
}

/**
 * 回合内流派结算：检测各村新命中的配方并解锁；结算所有持有头衔的持续效果。
 * 新解锁 → 写入头衔 + synergyUnlocked 事件 + 微反馈 + 星/账/连击。
 */
export function settleVillageSynergies(state: GameState, ctx: TurnCtx, catalyst: SynergyCatalyst | null): void {
  for (const v of state.villages) {
    const hits: SynergyRecipe[] = detectVillageSynergies(state, v.id, catalyst);
    for (const recipe of hits) {
      if (v.synergyTitles.includes(recipe.id)) continue;
      v.synergyTitles.push(recipe.id);
      ctx.pushEvent({ type: 'synergyUnlocked', round: ctx.round, villageId: v.id, recipeId: recipe.id });
      ctx.pushFeedback(config.text.mf_synergy, config.text.mf_synergy_text);
      ctx.addStars(recipe.anti ? -8 : 12);
      ctx.pushLedger('achievement', 'synergy', recipe.anti ? -6 : 6, `涌现式融合：${recipe.name}`);
      ctx.noteCombo('solid');
    }
    // §15 持续效果：持有头衔期间每回合结算（含反面配方的代价）
    for (const rid of v.synergyTitles) {
      const recipe = synergyRecipes.find((r) => r.id === rid);
      if (!recipe?.effects?.length) continue;
      for (const eff of recipe.effects) {
        applySynergyEffect(state, v.id, eff);
      }
    }
  }
}

function applySynergyEffect(
  state: GameState,
  villageId: string,
  eff: { kind: string; value: number }
): void {
  const c = state.county;
  const v = state.villages.find((x) => x.id === villageId);
  if (!v) return;
  switch (eff.kind) {
    case 'trust':
      c.trust = Math.max(0, Math.min(100, c.trust + eff.value));
      break;
    case 'ecology':
      c.ecology = Math.max(0, Math.min(100, c.ecology + eff.value));
      break;
    case 'returnRisk':
      v.returnRisk = Math.max(0, Math.min(100, v.returnRisk + eff.value));
      break;
    case 'subsidyDependence':
      v.subsidyDependence = Math.max(0, Math.min(100, v.subsidyDependence + eff.value));
      break;
    case 'participation':
      v.participation = Math.max(0, Math.min(100, v.participation + eff.value));
      break;
    default:
      break;
  }
}
