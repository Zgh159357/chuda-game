import type { Cadre, GameState, RoundActions } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { techSum, techPenaltySum } from './techTree';
import { heroSum, flawSum } from './heroes';

// ============================================================
// 干部系统（重构）：精力=行动资源池，士气/疲劳=主体状态
// - regen：回合开始恢复精力（受疲劳、士气影响）
// - resolveCadreActions：换岗驻派 + 入户摸排（揭开迷雾）
// - settleCadres：回合末疲劳/士气漂移 + 过劳判定
// 干部精力池在回合开始时注入 county.cadrePower，
// 各系统照旧扣 cadrePower，本文件只管理 cadres[] 本体。
// ============================================================

const f = () => config.formulas.cadre;

/** 回合开始：恢复精力（受疲劳/士气压制） */
export function regenCadres(state: GameState): void {
  const c = f();
  const regenBonus = techSum(state, 'cadreRegenBonus'); // 机制树：驻村轮训
  for (const cad of state.cadres) {
    let regen = c.baseRegen + regenBonus;
    regen -= Math.floor(cad.fatigue / c.fatigueRegenPenalty);
    if (cad.morale < c.lowMoraleThreshold) regen -= 1;
    cad.energy = Math.min(c.maxEnergy, Math.max(0, cad.energy + Math.max(1, regen)));
  }
  state.county.cadrePower = state.cadres.reduce((s, k) => s + k.energy, 0);
}

/** 从县干部精力池扣点（连带在干部本体上体现） */
export function spendCadreEnergy(state: GameState, amount: number, preferVillageId?: string): boolean {
  const c = f();
  const total = state.cadres.reduce((s, k) => s + k.energy, 0);
  if (total < amount) return false;
  // 优先扣驻村对应村的干部，其次精力最足的
  const order = [...state.cadres].sort((a, b) => {
    const ap = preferVillageId && a.villageId === preferVillageId ? 1 : 0;
    const bp = preferVillageId && b.villageId === preferVillageId ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.energy - a.energy;
  });
  let left = amount;
  for (const cad of order) {
    if (left <= 0) break;
    const take = Math.min(cad.energy, left);
    cad.energy -= take;
    left -= take;
  }
  state.county.cadrePower = Math.max(0, state.county.cadrePower - amount);
  void c;
  return true;
}

/** 对某位干部直接扣精力（换岗、摸排、事件） */
function drainCadre(cad: Cadre, amount: number, state: GameState): void {
  const take = Math.min(cad.energy, amount);
  cad.energy -= take;
  state.county.cadrePower = Math.max(0, state.county.cadrePower - take);
}

/** 给某位干部累积疲劳（事件/熬夜填表） */
export function addCadreFatigue(state: GameState, amount: number, villageId?: string): void {
  const target =
    (villageId && state.cadres.find((k) => k.villageId === villageId)) ||
    [...state.cadres].sort((a, b) => a.fatigue - b.fatigue)[0];
  if (target) target.fatigue = Math.min(100, target.fatigue + amount);
}

/** 行动层：干部换岗 / 入户摸排 */
export function resolveCadreActions(state: GameState, actions: RoundActions, ctx: TurnCtx): void {
  const c = f();

  // 1) 换岗：驻村 / 召回（每人一次移动耗 1 精力）
  for (const asg of actions.cadreAssignments ?? []) {
    const cad = state.cadres.find((k) => k.id === asg.cadreId);
    if (!cad) continue;
    if (cad.villageId === asg.villageId) continue;
    if (!spendCadreEnergy(state, c.moveEnergyCost, cad.villageId ?? undefined)) continue;
    cad.villageId = asg.villageId;
  }

  // 2) 入户摸排：揭开信息迷雾（特质「铁脚板」耗能减半、少受累）
  for (const vid of actions.surveyVillages ?? []) {
    const village = state.villages.find((v) => v.id === vid);
    if (!village) continue;
    const resident = state.cadres.find((k) => k.villageId === vid);
    let cost = resident ? c.surveyEnergyCost : c.surveyEnergyCostNoCadre;
    const payer = resident ?? [...state.cadres].sort((a, b) => b.energy - a.energy)[0];
    if (!payer) continue;
    const walker = payer.traits.some((t) => traitMatch(state, t, 'survey'));
    if (walker) cost = Math.max(1, Math.floor(cost / 2)); // 特质：耗能减半
    cost = Math.max(1, cost - techSum(state, 'surveyCostCut')); // 机制树：网格化管理
    if (payer.energy < cost) continue; // 精力不够，摸排未成行
    drainCadre(payer, cost, state);
    payer.fatigue = Math.min(100, payer.fatigue + (walker ? 1 : c.surveyFatigue));
    const first = !village.surveyed;
    village.surveyed = true;
    // 人才：高级农技专家坐镇，摸排多揭 3 点雾
    const techGuide = heroSum(state, vid, 'techGuide') + heroSum(state, vid, 'surveyMaster');
    // 毒点：表格战神这类人下乡摸排效率极低
    const surveyWeak = flawSum(state, vid, 'surveyWeak');
    const gain = Math.max(1, (first ? c.surveyInfoGain : c.surveyInfoGainRepeat) + techGuide - surveyWeak);
    const before = village.infoAccuracy;
    village.infoAccuracy = Math.min(100, village.infoAccuracy + gain);
    // 揭雾信号：从"全盲"进入"半盲"或"清晰"
    if (before < c.fogRevealThreshold && village.infoAccuracy >= c.fogRevealThreshold) {
      ctx.pushEvent({ type: 'fogRevealed', round: ctx.round, villageId: vid });
      ctx.pushFeedback('mf_villager_card', 'fog_revealed_text');
      ctx.addStars(5);
      ctx.pushLedger('achievement', `survey_${vid}`, 4, `入户摸排：${village.name} 情况明了`);
    }
  }
}

/** 干部是否带某类特质 */
function traitMatch(state: GameState, traitId: string, match: string): boolean {
  const spec = config.traits.find((t) => t.id === traitId);
  return !!spec && spec.match === match;
}

/** 干部是否带负面特质（过劳常驻debuff） */
function hasNegativeTrait(state: GameState, cad: Cadre): boolean {
  return cad.traits.some((t) => {
    const spec = config.traits.find((s) => s.id === t);
    return !!spec && !spec.positive;
  });
}

/** 回合末：疲劳积累、士气漂移、过劳判定、特质被动效果 */
export function settleCadres(state: GameState, ctx: TurnCtx): void {
  const c = f();
  const county = state.county;
  // 极值节点「铁腕问责」：干部疲劳翻倍
  const fatigueDouble = techPenaltySum(state, 'fatigueDouble') > 0 ? 2 : 1;
  for (const cad of state.cadres) {
    // 负面特质「水土不服」：身体没顺过来，比别人更累
    const endurer = cad.traits.some((t) => traitMatch(state, t, 'endure'));
    // 毒点：驻村干部被「快烧完」的人才拖累
    const burnoutFast = cad.villageId ? flawSum(state, cad.villageId, 'burnoutFast') : 0;
    cad.fatigue = Math.min(100, cad.fatigue + (c.baseFatiguePerRound + (endurer ? 1 : 0)) * fatigueDouble + burnoutFast);
    // 特质「擅长调解」：驻在村里，群众信任一点一点攒
    if (cad.villageId && cad.traits.some((t) => traitMatch(state, t, 'mediate'))) {
      county.trust = Math.min(100, county.trust + 0.5);
    }
    // 士气漂移：所在村参与度高则振奋；全县形式主义重则消沉（「填表大师」豁免）
    const village = cad.villageId ? state.villages.find((v) => v.id === cad.villageId) : null;
    if (village && village.participation >= 50) cad.morale = Math.min(100, cad.morale + 2);
    // 人才：吴山歌/白团长/秦班长驻在村里，整队干部劲头足
    if (cad.villageId) cad.morale = Math.min(100, cad.morale + heroSum(state, cad.villageId, 'moraleAura'));
    const clerk = cad.traits.some((t) => traitMatch(state, t, 'paperwork'));
    if (county.formality > 40 && !clerk) cad.morale = Math.max(0, cad.morale - 2);
    cad.morale = Math.max(0, Math.min(100, cad.morale));
    // 过劳判定
    if (cad.fatigue >= c.burnoutThreshold) {
      cad.fatigue = Math.max(0, cad.fatigue - c.burnoutFatigueRelief);
      cad.morale = Math.max(0, cad.morale - c.burnoutMoralePenalty);
      cad.energy = 0;
      county.fatigueEvents += 1;
      county.trust = Math.max(0, county.trust - c.burnoutTrustHit);
      ctx.pushEvent({ type: 'cadreBurnout', round: ctx.round, cadreId: cad.id, textId: 'cadre_burnout_text' });
      ctx.pushLedger('cost', `burnout_${cad.id}`, -5, `${cad.name}过劳倒下，全县干部士气受挫`);
      ctx.addStars(-8);
      // 过劳留下病根：首次获得负面特质（常驻）
      if (!hasNegativeTrait(state, cad)) {
        cad.traits.push('trait_acclimatize');
        ctx.pushEvent({ type: 'negTrait', round: ctx.round, cadreId: cad.id, textId: 'neg_trait_gained' });
      }
    }
  }
  // 干部怠工（因果律事件链）：士气过低时小概率冒出「干部怠工」传闻
  if (averageMorale(state) < 40 && ctx.rng() < 0.3) {
    ctx.pushEvent({ type: 'cadreSlack', round: ctx.round, textId: 'cadre_slack_text' });
    ctx.pushLedger('cost', 'cadre_slack', -2, '干部怠工传闻流传');
  }
}

/** 士气均值（UI 用） */
export function averageMorale(state: GameState): number {
  if (state.cadres.length === 0) return 0;
  return state.cadres.reduce((s, k) => s + k.morale, 0) / state.cadres.length;
}
