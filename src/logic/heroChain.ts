// ============================================================
// §18 多阶段奇遇与高门槛招募 —— 纯函数引擎（src/logic/heroChain.ts）
// 全部纯函数：条件判定 / 阶段推导 / 选项可行性 / 骰子判定。
// 状态写入（扣成本、推进进度、入队）一律由 systems/heroes.ts 负责。
// ============================================================

import type {
  GameState,
  HeroRecruitChain,
  HeroSpec,
  RecruitOption,
  RecruitStep,
} from '../core/types';
import { config } from '../config';
import { chainOf } from '../config/heroChains';
import { deriveRoadSet } from '../core/sandbox/logistics';

/** 触发条件中文缺失清单（UI tooltip 用） */
export function chainTriggerMissing(state: GameState, chain: HeroRecruitChain): string[] {
  const missing: string[] = [];
  const t = chain.triggerConditions;
  if (t.minRound !== undefined && state.county.round < t.minRound) {
    missing.push(`进入第 ${t.minRound} 回合后`);
  }
  if (t.minInfoAccuracy !== undefined && state.county.infoAccuracy < t.minInfoAccuracy) {
    missing.push(`全县信息精度达到 ${t.minInfoAccuracy}`);
  }
  if (t.minFatigue !== undefined) {
    const avg = Math.round(
      state.cadres.reduce((s, c) => s + c.fatigue, 0) / Math.max(1, state.cadres.length)
    );
    if (avg < t.minFatigue) missing.push(`全县干部平均疲劳达到 ${t.minFatigue}（当前 ${avg}）`);
  }
  if (t.minVillageStall !== undefined) {
    const maxStall = Math.max(0, ...Object.values(state.streaks.villageStall ?? {}));
    if (maxStall < t.minVillageStall) missing.push(`某村内生治理连续停滞 ${t.minVillageStall} 回合`);
  }
  if (t.minTraffic !== undefined) {
    const roaded = deriveRoadSet(state).size;
    if (roaded < t.minTraffic) missing.push(`全县已通公路网格达到 ${t.minTraffic}（当前 ${roaded}）`);
  }
  if (t.requiredVillageTrait) {
    const has = state.villages.some((v) => v.trait === t.requiredVillageTrait);
    if (!has) missing.push(`存在「${traitName(t.requiredVillageTrait)}」特质的村庄`);
  }
  if (t.requiredEventFlags && t.requiredEventFlags.length > 0) {
    const seen = new Set(state.eventHistory);
    for (const f of t.requiredEventFlags) {
      if (!seen.has(f)) missing.push(`发生过前置事件：${flagName(f)}`);
    }
  }
  return missing;
}

/** 综合触发判定：触发池条件 + 附加治理状态条件（minRound 等） */
export function chainTriggerMet(state: GameState, chain: HeroRecruitChain): boolean {
  return chainTriggerMissing(state, chain).length === 0;
}

/** 特质中文名 */
export function traitName(t: string): string {
  const map: Record<string, string> = { hollow: '空心村', clan: '宗族村' };
  return map[t] ?? t;
}

/** 事件旗标中文名 */
export function flagName(f: string): string {
  const map: Record<string, string> = {
    villagerInitiative: '村民自主提议',
    fogRevealed: '信息迷雾揭开',
    cohesionRiot: '安置点聚众闹事',
    cadreBurnout: '干部过劳倒下',
    eventFileResolved: '公文批复',
    storyStage: '故事线推进',
    canHoldEvent: '接不住预警',
    projectFailure: '项目烂尾',
  };
  return map[f] ?? f;
}

/** 触发锚点村：优先特质匹配村，否则返贫风险最高的村（说情要挑地方） */
export function anchorVillageId(state: GameState, chain: HeroRecruitChain): string | null {
  const t = chain.triggerConditions;
  const byTrait = state.villages.find((v) => t.requiredVillageTrait && v.trait === t.requiredVillageTrait);
  if (byTrait) return byTrait.id;
  const any = [...state.villages].sort((a, b) => b.returnRisk - a.returnRisk)[0];
  return any ? any.id : null;
}

/** 当前待推进的阶段（仅对 pending 人才有意义；未入池返回 null） */
export function currentStepOf(state: GameState, heroId: string): RecruitStep | null {
  const chain = chainOf(heroId);
  if (!chain) return null;
  const prog = state.heroChains[heroId];
  if (!prog) return null;
  return chain.recruitSteps[prog.stepIndex] ?? null;
}

export function progressOf(state: GameState, heroId: string) {
  return state.heroChains[heroId];
}

/** 选项可行性（成本是否付得起） */
export function optionAffordable(
  state: GameState,
  heroId: string,
  option: RecruitOption
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const cost = option.cost;
  if (!cost) return { ok: true, missing };
  if (cost.funds !== undefined && state.county.fiscalFund < cost.funds) {
    missing.push(`县财政 ${cost.funds}`);
  }
  if (cost.politicalCapital !== undefined && state.county.politicalCapital < cost.politicalCapital) {
    missing.push(`政治资本 ${cost.politicalCapital}`);
  }
  if (cost.targetVillageGovernance !== undefined) {
    const prog = state.heroChains[heroId];
    const v = state.villages.find((x) => x.id === prog?.villageId);
    if (!v || v.internalGovernance < cost.targetVillageGovernance) {
      missing.push(`锚点村内生治理 ${cost.targetVillageGovernance}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** 骰子判定：rng() ∈ [0,1)；>= failChance 视为成功 */
export function rollRecruitOption(rng: () => number, option: RecruitOption): boolean {
  return rng() >= Math.min(1, Math.max(0, option.failChance));
}

/** 入队后的体制摩擦（每回合隐性扣减汇总，由 transmission 结算） */
export interface HeroDebuffLine {
  heroId: string;
  metric: string;
  value: number;
  desc: string;
}
export function activeHeroDebuffs(state: GameState): HeroDebuffLine[] {
  const out: HeroDebuffLine[] = [];
  for (const hs of state.heroes) {
    const chain = chainOf(hs.heroId);
    if (!chain?.passiveDebuff) continue;
    out.push({
      heroId: hs.heroId,
      metric: chain.passiveDebuff.metric,
      value: chain.passiveDebuff.value,
      desc: chain.passiveDebuff.desc,
    });
  }
  return out;
}

/** 婉拒与搁置都算：本人才是否还能被触发（declinedRecruits 且 declineCloses 则永久关闭） */
export function heroRecruitable(state: GameState, heroId: string): boolean {
  const chain = chainOf(heroId);
  if (!chain) return false;
  if (state.declinedRecruits.includes(heroId)) {
    return !(chain.declineCloses ?? false);
  }
  return true;
}

// ---- 内部辅助 ----
function stateHeroSpec(_state: GameState, heroId: string): HeroSpec | null {
  return config.heroes.find((h) => h.id === heroId) ?? null;
}
