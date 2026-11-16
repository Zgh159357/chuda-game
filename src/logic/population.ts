// ============================================================
// §19 人口系统 —— 纯函数引擎（src/logic/population.ts）
// 人口不再只是村庄的一个数字：群体块（技能×职业×老龄化）决定
// 劳动力供给，与产业需求做匹配；缺口折损项目效果，流动率驱动
// 空心化/回流事件。状态写入由 core/systems/population.ts 负责。
// ============================================================

import type { GameState, HouseholdGroup, JobTag, SkillLevel, VillagePopulation, VillageState, VillagerGroup } from '../core/types';
import { config } from '../config';

/** 致贫标签 → 职业标签（虚构口径：因学→有网感群体，边远/生态/因病→务农，缺技/缺劳→富余劳力） */
export function jobTagOf(h: HouseholdGroup): JobTag {
  switch (h.tag) {
    case 'education':
      return 'ecommerce_host';
    case 'remote':
    case 'ecoConstraint':
    case 'disease':
      return 'farmer';
    case 'noLabor':
    case 'noSkill':
    default:
      return 'surplus_labor';
  }
}

/** 致贫标签 → 技能等级（因学致贫的家庭算「有苗子」） */
export function skillOf(h: HouseholdGroup): SkillLevel {
  return h.tag === 'education' ? 'skilled' : 'unskilled';
}

/** 由户群清单生成村庄人口快照（群体块聚合） */
export function buildPopulation(v: VillageState): VillagePopulation {
  const groups = new Map<string, VillagerGroup>();
  const ensure = (key: string, jobTag: JobTag, skillLevel: SkillLevel, isElderly: boolean): VillagerGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { id: `${v.id}_${key}`, count: 0, skillLevel, jobTag, isElderly };
      groups.set(key, g);
    }
    return g;
  };
  for (const h of v.households) {
    const job = jobTagOf(h);
    const skill = skillOf(h);
    const elderly = h.tag === 'noLabor';
    const g = ensure(`${job}_${skill}_${elderly ? 'old' : 'young'}`, job, skill, elderly);
    g.count += h.population;
  }
  // 钉子户/闹访：退出意愿极低的户群里长出来的「troublemaker」
  const troublemakers = v.households
    .filter((h) => h.exitWillingness < 25)
    .reduce((s, h) => s + Math.max(1, Math.round(h.population * 0.05)), 0);
  if (troublemakers > 0) {
    ensure('troublemaker_unskilled_young', 'troublemaker', 'unskilled', false).count = troublemakers;
  }
  const groupsArr = [...groups.values()];
  const totalPop = groupsArr.reduce((s, g) => s + g.count, 0);
  const outflow = Math.max(0, config.balance.population.outflowBase + v.returnRisk * 0.25 - v.industryBase * 0.15);
  const inflow = Math.max(0, config.balance.population.inflowBase + v.participation * 0.08 + v.industryBase * 0.1);
  return { totalPop, groups: groupsArr, outflowRate: Math.round(outflow), inflowRate: Math.round(inflow) };
}

/** 有效劳动力供给：年轻人按技能加权，老年人半劳动力，troublemaker 不产出 */
export function laborSupply(pop: VillagePopulation): number {
  return pop.groups.reduce((s, g) => {
    if (g.jobTag === 'troublemaker') return s;
    const skillMul = g.skillLevel === 'expert' ? 1.4 : g.skillLevel === 'skilled' ? 1 : 0.6;
    const ageMul = g.isElderly ? 0.25 : 1;
    return s + g.count * skillMul * ageMul;
  }, 0);
}

/** 产业劳动力需求：在建项目 × 每项目劳动力 */
export function laborDemand(state: GameState, villageId: string): number {
  const active = state.projects.filter(
    (p) => p.villageId === villageId && (p.status === 'active' || p.status === 'recovered')
  ).length;
  return active * config.balance.population.laborPerProject;
}

/** 劳动力匹配系数：供给/需求，缺口折损但不低于 shortageMul */
export function laborMatchFactor(state: GameState, villageId: string): number {
  const demand = laborDemand(state, villageId);
  if (demand <= 0) return 1;
  const pop = state.villagePopulations[villageId];
  const supply = pop ? laborSupply(pop) : 0;
  const ratio = supply / demand;
  return Math.min(1, Math.max(config.balance.population.shortageMul, ratio));
}

/** 技能升级预估人数（培训卡 / 农技专家，期望值口径，不掷骰） */
export function skillUpCount(g: VillagerGroup, trainChance: number, upChance: number): number {
  if (g.isElderly || g.jobTag === 'troublemaker') return 0;
  if (g.skillLevel === 'unskilled') return Math.round(g.count * trainChance);
  if (g.skillLevel === 'skilled') return Math.round(g.count * upChance);
  return 0;
}
