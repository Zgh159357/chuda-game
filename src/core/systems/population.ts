// ============================================================
// §19 人口系统 —— 回合结算（src/core/systems/population.ts）
// 每回合：技能演化（培训/农技专家）→ 流动率重估 → 人口漂移
// → 劳动力缺口事件 / 回流事件。纯计算在 logic/population.ts。
// ============================================================

import type { GameState } from '../types';
import { config } from '../../config';
import { buildPopulation, laborDemand, laborMatchFactor, laborSupply, skillUpCount } from '../../logic/population';
import { heroSum } from './heroes';
import type { TurnCtx } from './context';

export function settlePopulation(state: GameState, ctx: TurnCtx, cards: string[]): void {
  const p = config.balance.population;
  const training = cards.includes('b_training');
  for (const v of state.villages) {
    const pop = state.villagePopulations[v.id] ?? buildPopulation(v);
    state.villagePopulations[v.id] = pop;

    // 1) 技能演化：培训卡 → unskilled→skilled；techGuide 派驻村 → skilled→expert
    const techGuide = heroSum(state, v.id, 'techGuide') > 0;
    let ups = 0;
    for (const g of pop.groups) {
      const trainChance = training ? p.skillTrainChance : 0;
      const upChance = techGuide ? p.techUpChance : 0;
      const moved = skillUpCount(g, trainChance, upChance);
      if (moved <= 0) continue;
      const targetLevel = g.skillLevel === 'unskilled' ? 'skilled' : 'expert';
      let target = pop.groups.find(
        (x) => x.jobTag === g.jobTag && x.skillLevel === targetLevel && x.isElderly === g.isElderly
      );
      if (!target) {
        target = { id: `${g.id}_up`, count: 0, skillLevel: targetLevel, jobTag: g.jobTag, isElderly: g.isElderly };
        pop.groups.push(target);
      }
      g.count -= moved;
      target.count += moved;
      ups += moved;
    }
    if (ups > 0) {
      ctx.pushEvent({ type: 'skillUp', round: ctx.round, villageId: v.id, count: ups });
    }

    // 2) 流动率重估：产业与参与度拉回流，风险推外流
    const activeProjects = state.projects.filter(
      (pr) => pr.villageId === v.id && (pr.status === 'active' || pr.status === 'recovered')
    ).length;
    const outflow = Math.round(
      Math.max(0, p.outflowBase + v.returnRisk * 0.25 - activeProjects * 4 - v.industryBase * 0.15)
    );
    const inflow = Math.round(Math.max(0, p.inflowBase + v.participation * 0.08 + activeProjects * 3 + v.industryBase * 0.1));
    pop.outflowRate = Math.min(100, outflow);
    pop.inflowRate = Math.min(100, inflow);

    // 3) 人口漂移：净流动按千分比作用于总量（保底 80 人）
    const net = (inflow - outflow) / 1000;
    pop.totalPop = Math.max(80, Math.round(pop.totalPop * (1 + net)));

    // 4) 劳动力缺口：有产业但没人干 → 事件（需求×shortageMul 以上才算硬缺口）
    const demand = laborDemand(state, v.id);
    if (demand > 0) {
      const supply = laborSupply(pop);
      if (supply < demand * config.balance.population.shortageMul) {
        ctx.pushEvent({ type: 'laborShortage', round: ctx.round, villageId: v.id });
        ctx.pushLedger('cost', `labor_shortage_${v.id}`, -2, `劳动力缺口：${v.name}有产业没人干`);
      }
    }
  }
}

/** 供 UI 展示：某村劳动力供需摘要 */
export function populationSummary(state: GameState, villageId: string): { supply: number; demand: number; factor: number } {
  const pop = state.villagePopulations[villageId];
  const supply = pop ? Math.round(laborSupply(pop)) : 0;
  const demand = laborDemand(state, villageId);
  return { supply, demand, factor: laborMatchFactor(state, villageId) };
}
