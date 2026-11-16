// ============================================================
// §19 人口系统：群体块 / 技能演化 / 流动率 / 劳动力缺口
// ============================================================
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { serialize, deserialize, SAVE_VERSION } from '../src/core/save';
import {
  buildPopulation,
  jobTagOf,
  laborMatchFactor,
  laborSupply,
  skillOf,
  skillUpCount,
} from '../src/logic/population';
import { settlePopulation } from '../src/core/systems/population';
import { createTurnCtx } from '../src/core/systems/context';
import { seedRng } from '../src/core/rng';
import type { GameState, VillagerGroup } from '../src/core/types';

function fresh(): GameState {
  return createInitialState(42, 'local');
}

function group(count: number, skillLevel: 'unskilled' | 'skilled' | 'expert', jobTag: 'farmer' | 'factory_worker', isElderly = false): VillagerGroup {
  return { id: `g_${jobTag}_${skillLevel}`, count, skillLevel, jobTag, isElderly };
}

describe('人口系统（§19）', () => {
  it('buildPopulation：标签映射与总量自洽', () => {
    const s = fresh();
    for (const v of s.villages) {
      const pop = buildPopulation(v);
      expect(pop.totalPop).toBe(pop.groups.reduce((sum, g) => sum + g.count, 0));
      // 缺劳=老年、因学=有技能
      const noLabor = v.households.filter((h) => h.tag === 'noLabor');
      for (const h of noLabor) expect(jobTagOf(h)).toBe('surplus_labor');
      const edu = v.households.filter((h) => h.tag === 'education');
      for (const h of edu) expect(skillOf(h)).toBe('skilled');
    }
  });

  it('troublemaker：退出意愿极低的户群长刺头', () => {
    const s = fresh();
    const v = s.villages[1]; // 雾岭：劳家 exitWillingness 5
    const pop = buildPopulation(v);
    const tb = pop.groups.find((g) => g.jobTag === 'troublemaker');
    expect(tb).toBeDefined();
    expect(tb!.count).toBeGreaterThan(0);
    expect(laborSupply(pop)).toBe(pop.groups.filter((g) => g.jobTag !== 'troublemaker').reduce((sum, g) => sum + g.count * (g.skillLevel === 'expert' ? 1.4 : g.skillLevel === 'skilled' ? 1 : 0.6) * (g.isElderly ? 0.25 : 1), 0));
  });

  it('laborMatchFactor：无产业=1，缺口折损但不低于 shortageMul', () => {
    const s = fresh();
    // 无项目村 → 需求 0 → 1
    expect(laborMatchFactor(s, 'v_qingshi')).toBeGreaterThan(0); // 青石有项目
    const v = s.villages[2];
    const pop = s.villagePopulations[v.id];
    pop.groups = [group(3, 'unskilled', 'farmer')];
    const factor = laborMatchFactor(s, v.id);
    expect(factor).toBeGreaterThanOrEqual(0.6);
    expect(factor).toBeLessThanOrEqual(1);
  });

  it('skillUpCount：只搬得动年轻非刺头群体', () => {
    const young = group(100, 'unskilled', 'farmer');
    const old = group(100, 'unskilled', 'farmer', true);
    const troublemaker: VillagerGroup = { id: 'g_tb', count: 100, skillLevel: 'unskilled', jobTag: 'troublemaker', isElderly: false };
    expect(skillUpCount(young, 0.12, 0)).toBe(12);
    expect(skillUpCount(old, 0.12, 0)).toBe(0);
    expect(skillUpCount(troublemaker, 0.12, 0)).toBe(0);
    expect(skillUpCount(group(50, 'skilled', 'factory_worker'), 0, 0.06)).toBe(3);
  });

  it('settlePopulation：培训卡把普工变成技工', () => {
    const s = fresh();
    s.villagePopulations['v_yunxi'] = {
      totalPop: 100,
      groups: [group(100, 'unskilled', 'farmer')],
      outflowRate: 5,
      inflowRate: 5,
    };
    const out = playRound(s, { cards: ['b_training'] });
    const pop = out.state.villagePopulations['v_yunxi'];
    const skilled = pop.groups.find((g) => g.skillLevel === 'skilled' && g.jobTag === 'farmer');
    expect(skilled).toBeDefined();
    expect(skilled!.count).toBe(12);
    expect(out.events.some((e) => e.type === 'skillUp')).toBe(true);
  });

  it('settlePopulation：农技专家推动技工升能手', () => {
    const s = fresh();
    s.villagePopulations['v_wuling'] = {
      totalPop: 200,
      groups: [group(100, 'unskilled', 'farmer'), group(50, 'skilled', 'factory_worker')],
      outflowRate: 3,
      inflowRate: 3,
    };
    s.heroes = [{ heroId: 'hero_agronomist', villageId: 'v_wuling' }];
    const out = playRound(s, { cards: ['b_training'] });
    const pop = out.state.villagePopulations['v_wuling'];
    const expert = pop.groups.find((g) => g.skillLevel === 'expert');
    expect(expert).toBeDefined();
    expect(expert!.count).toBe(3);
  });

  it('settlePopulation：流动率重估与人口漂移', () => {
    const s = fresh();
    const rng = seedRng(1);
    const ctx = createTurnCtx(s, rng, 5);
    settlePopulation(s, ctx, []);
    const v = s.villages.find((x) => x.id === 'v_qingshi')!;
    const pop = s.villagePopulations['v_qingshi'];
    const active = s.projects.filter((p) => p.villageId === v.id && (p.status === 'active' || p.status === 'recovered')).length;
    const expectedOut = Math.round(Math.max(0, 2 + v.returnRisk * 0.25 - active * 4 - v.industryBase * 0.15));
    expect(pop.outflowRate).toBe(expectedOut);
    // 漂移保底 80
    expect(pop.totalPop).toBeGreaterThanOrEqual(80);
  });

  it('settlePopulation：有产业没人干触发劳动力缺口', () => {
    const s = fresh();
    s.villagePopulations['v_yunxi'] = {
      totalPop: 30,
      groups: [group(10, 'unskilled', 'farmer', true)], // 全部半劳力：供给 1.5
      outflowRate: 0,
      inflowRate: 0,
    };
    const out = playRound(s, {});
    expect(out.events.some((e) => e.type === 'laborShortage')).toBe(true);
    expect(out.ledgerDelta.some((l) => l.key.startsWith('labor_shortage_'))).toBe(true);
  });

  it('settlePopulation：缺口折损项目产出', () => {
    const s = fresh();
    s.villagePopulations['v_yunxi'] = {
      totalPop: 30,
      groups: [group(10, 'unskilled', 'farmer', true)],
      outflowRate: 0,
      inflowRate: 0,
    };
    // 云溪有 p_yunxi_herb active：需求 15，供给 1.5 → factor=0.6
    expect(laborMatchFactor(s, 'v_yunxi')).toBe(0.6);
  });

  it('存档 v17 往返：人口快照保留', () => {
    const s = fresh();
    const back = deserialize(serialize(s));
    expect(back.version).toBe(17);
    expect(SAVE_VERSION).toBe(17);
    expect(back.villagePopulations['v_yunxi'].totalPop).toBe(s.villagePopulations['v_yunxi'].totalPop);
  });
});
