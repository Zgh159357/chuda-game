import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { seedRng } from '../src/core/rng';
import {
  rollEventsThisTurn,
  rollEventsDetailed,
  weightedPick,
  conditionsMet,
  processEventChoice,
  dueDelayedEvents,
  type PoolState,
} from '../src/core/sandbox/eventPool';
import { calculateAllocationResult, calculateIndustrySynergy, buildingToNodeType } from '../src/core/calculations';
import { dynamicEvents, delayedEvents, villageTitles } from '../src/config/dynamicEvents';
import type { Tile } from '../src/core/types';

function makeTile(over: Partial<Tile>): Tile {
  return {
    id: '1,1',
    x: 1,
    y: 1,
    villageId: 'v_yunxi',
    environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45 },
    building: null,
    infoAccuracy: 100,
    road: true,
    logisticsCovered: false,
    zoningKind: null,
    ...over,
  };
}

describe('§13 动态事件池与自由沙盒引擎', () => {
  it('轮盘赌：权重越高命中越多；rng=0.999 命中最后一个（最高累计）', () => {
    const items = ['a', 'b', 'c'];
    const weights = [10, 30, 60];
    const hits: Record<string, number> = { a: 0, b: 0, c: 0 };
    const rng = seedRng(7);
    for (let i = 0; i < 400; i++) {
      const p = weightedPick(items, weights, () => rng());
      hits[p!] += 1;
    }
    expect(hits.c).toBeGreaterThan(hits.b);
    expect(hits.b).toBeGreaterThan(hits.a);
  });

  it('rollEventsThisTurn：条件不满足的事件不入池', () => {
    const s0 = createInitialState(1, 'local'); // 财政 120、平均疲劳 ~28、生态 60
    s0.county.ecology = 65; // 只让丰收例行事件入池
    const rng = seedRng(3);
    const rolled = rollEventsThisTurn(s0, dynamicEvents, { rng, round: 1 });
    const ids = rolled.map((e) => e.id);
    expect(ids).not.toContain('ev_fiscal_crunch'); // fiscalFund 120 > 15
    expect(ids).not.toContain('ev_burnout_wave'); // avgFatigue ~28 < 80
    expect(ids).not.toContain('ev_clan_banquet'); // 三村 clanPower 均 < 60
    expect(ids).not.toContain('ev_swan_rumor'); // fakeProb 0 < 30
    expect(ids).toContain('ev_routine_harvest'); // ecology 65 > 60
  });

  it('rollEventsThisTurn：财政枯竭后危机事件入池', () => {
    const s0 = createInitialState(1, 'local');
    s0.county.fiscalFund = 5;
    const rng = seedRng(3);
    const rolled = rollEventsThisTurn(s0, dynamicEvents, { rng, round: 1 });
    expect(rolled.map((e) => e.id)).toContain('ev_fiscal_crunch');
  });

  it('rollEventsThisTurn：干部疲劳 >80 后过劳事件入池', () => {
    const s0 = createInitialState(1, 'local');
    for (const c of s0.cadres) c.fatigue = 85;
    const rng = seedRng(3);
    const rolled = rollEventsThisTurn(s0, dynamicEvents, { rng, round: 1 });
    expect(rolled.map((e) => e.id)).toContain('ev_burnout_wave');
  });

  it('rollEventsThisTurn：宗族事件按村解析 villageId，且冷却期内不再入池', () => {
    const s0 = createInitialState(1, 'local');
    s0.villages[0].environment.clanPower = 75; // 只有云溪村满足
    const rng = seedRng(3);
    const r1 = rollEventsDetailed(s0, dynamicEvents, { rng, round: 1 });
    const clan = r1.find((r) => r.config.id === 'ev_clan_banquet');
    expect(clan).toBeTruthy();
    expect(clan!.villageId).toBe('v_yunxi');
    // 冷却：第 2 回合 cooldowns 里有记录 → 不再入池
    const rolled2 = rollEventsThisTurn(s0, dynamicEvents, {
      rng,
      round: 2,
      cooldowns: { ev_clan_banquet: 1 },
    });
    expect(rolled2.map((e) => e.id)).not.toContain('ev_clan_banquet');
  });

  it('rollEventsThisTurn：每回合 1-3 个，绝不重复，池空返回 []', () => {
    const s0 = createInitialState(1, 'local');
    s0.county.fiscalFund = 5;
    for (const c of s0.cadres) c.fatigue = 85;
    s0.villages[0].environment.clanPower = 75;
    const rng = seedRng(11);
    for (let i = 0; i < 20; i++) {
      const rolled = rollEventsThisTurn(s0, dynamicEvents, { rng, round: 1 });
      expect(rolled.length).toBeGreaterThanOrEqual(1);
      expect(rolled.length).toBeLessThanOrEqual(3);
      expect(new Set(rolled.map((e) => e.id)).size).toBe(rolled.length);
    }
    // 池空：全部条件不满足
    const s1 = createInitialState(1, 'local');
    s1.county.ecology = 0;
    const empty = rollEventsThisTurn(s1, dynamicEvents, { rng, round: 1 });
    expect(empty).toEqual([]);
  });

  it('连锁事件：拒绝瞒报 → 注入暗访事件（3 回合内到期）', () => {
    const pool: PoolState = { cooldowns: {}, delayed: [] };
    const ev = dynamicEvents.find((e) => e.id === 'ev_swan_rumor')!;
    const next = processEventChoice(pool, ev, false, 5, () => 0.5);
    expect(next.delayed.length).toBe(1);
    expect(next.delayed[0].eventId).toBe('ev_swan_audit');
    expect(next.delayed[0].dueRound).toBeGreaterThanOrEqual(6);
    expect(next.delayed[0].dueRound).toBeLessThanOrEqual(8);
    expect(dueDelayedEvents(next, next.delayed[0].dueRound)).toEqual(['ev_swan_audit']);
    expect(dueDelayedEvents(next, next.delayed[0].dueRound - 1)).toEqual([]); // 未到期不出队
    expect(dueDelayedEvents(pool, 6)).toEqual([]); // 原对象不变（纯函数）
    // 接受不注入
    expect(processEventChoice(pool, ev, true, 5, () => 0.5).delayed).toEqual([]);
  });

  it('calculateAllocationResult：全给钱 → 短期信任涨、等靠要风险高、长期零', () => {
    const r = calculateAllocationResult({ money: 100, training: 0, industry: 0 });
    expect(r.moneyPct).toBe(100);
    expect(r.shortTermTrust).toBe(15);
    expect(r.longTermOutput).toBe(0);
    expect(r.dependenceRisk).toBe(30);
    expect(r.fiscalLabel).toBe('中');
  });

  it('calculateAllocationResult：培训+产业 → 短期微负、长期暴增、财政大', () => {
    const r = calculateAllocationResult({ money: 0, training: 40, industry: 60 });
    expect(r.trainingPct).toBe(40);
    expect(r.shortTermTrust).toBe(-2);
    expect(r.longTermOutput).toBe(72); // 40×0.6 + 60×0.8
    expect(r.dependenceRisk).toBe(-6);
    expect(r.fiscalLabel).toBe('中');
    expect(r.summary).toContain('长期成效：+72');
  });

  it('calculateAllocationResult：自动归一化（任意数值和不为 100）', () => {
    const r = calculateAllocationResult({ money: 50, training: 25, industry: 25 });
    expect(r.moneyPct + r.trainingPct + r.industryPct).toBe(100);
  });

  it('calculateIndustrySynergy：深山 farm+market → 农旅融合（产出×1.5 信任+5）', () => {
    const tiles = [
      makeTile({ id: 'a', building: '大棚', environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 40 } }),
      makeTile({ id: 'b', x: 2, building: '砖瓦房', environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 40 } }),
    ];
    const r = calculateIndustrySynergy(tiles);
    expect(r.outputMul).toBe(1.5);
    expect(r.trustDelta).toBe(5);
    expect(r.synergy_agriTourism).toBe(1);
  });

  it('calculateIndustrySynergy：石漠化建大棚 → 惩罚 ×0.1', () => {
    const tiles = [
      makeTile({ building: '大棚', environment: { terrain: '石漠化', disasterRisk: 55, clanPower: 30, traditionalIdeology: 40 } }),
    ];
    const r = calculateIndustrySynergy(tiles);
    expect(r.outputMul).toBe(0.1);
    expect(r.penalty_desertGreenhouse).toBe(1);
  });

  it('buildingToNodeType 映射：大棚→farm、加工厂→factory、砖瓦房→market、茅草屋→null', () => {
    expect(buildingToNodeType('大棚')).toBe('farm');
    expect(buildingToNodeType('加工厂')).toBe('factory');
    expect(buildingToNodeType('砖瓦房')).toBe('market');
    expect(buildingToNodeType('茅草屋')).toBeNull();
  });

  it('配置表自洽：5 个示例事件条件可解析、权重为正、有接受/拒绝效果', () => {
    expect(dynamicEvents.length).toBe(9);
    for (const ev of dynamicEvents) {
      expect(ev.weight).toBeGreaterThan(0);
      expect(Object.keys(ev.effectsOnAccept).length).toBeGreaterThan(0);
      expect(Object.keys(ev.effectsOnDecline).length).toBeGreaterThan(0);
    }
    expect(delayedEvents.map((e) => e.id)).toContain('ev_swan_audit');
    expect(villageTitles.length).toBe(2);
  });

  it('conditionsMet：村庄事件任一村满足即 ok 且返回命中村', () => {
    const s0 = createInitialState(1, 'local');
    const ev = dynamicEvents.find((e) => e.id === 'ev_clan_banquet')!;
    expect(conditionsMet(s0, ev).ok).toBe(false);
    s0.villages[1].environment.clanPower = 80;
    const hit = conditionsMet(s0, ev);
    expect(hit.ok).toBe(true);
    expect(hit.villageId).toBe('v_wuling');
  });
});
