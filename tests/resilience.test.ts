import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { serialize, deserialize } from '../src/core/save';
import { settleEmbedding, settleFloorDefense, applyOrgDamage, resilienceRatio } from '../src/core/systems/resilience';
import { createTurnCtx } from '../src/core/systems/context';
import { seedRng } from '../src/core/rng';
import type { RoundActions } from '../src/core/types';

function idleActions(): RoundActions {
  return {
    cards: [],
    targetingLevel: 'village',
    fiscal: 0,
    coop: 0,
    commitment: 'standard',
    dispatch: [],
    householdMeasures: [],
    assessment: { density: 30, thirdParty: 10, directReport: 10 },
    investigate: [],
    repair: [],
    acceptProposal: [],
    resettle: [],
    coopChoose: [],
    skills: [],
    cadreAssignments: [],
    surveyVillages: [],
    eventDecisions: [],
    nodeActions: [],
    paperStacksCleared: 0,
    zoning: [],
    negotiations: [],
    techUnlocks: [],
    wonderInvest: [],
    heroAssign: [],
    recruitChoices: [],
    mentorship: [],
  };
}

describe('§10 组织韧性系统', () => {
  it('韧性缓冲：伤害先扣韧性，韧性充足时内生治理不受伤', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const before = s0.villages[0].internalGovernance;
    const res = applyOrgDamage(s0, 5, ctx);
    expect(res.absorbed).toBe(5);
    expect(res.real).toBe(0);
    expect(s0.county.organizationalResilience).toBe(45);
    expect(s0.villages[0].internalGovernance).toBe(before);
    expect(ctx.events.some((e) => e.type === 'resilienceAbsorbed')).toBe(true);
    // 韧性比例（UI 韧性条数据源）
    expect(resilienceRatio(s0)).toBeCloseTo(0.9, 5);
  });

  it('韧性耗尽后伤害全额穿透', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    s0.county.organizationalResilience = 0;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const res = applyOrgDamage(s0, 5, ctx);
    expect(res.absorbed).toBe(0);
    expect(res.real).toBe(5);
    expect(resilienceRatio(s0)).toBe(0);
  });

  it('传帮带两分支：未指派每回合仅扣 1 点（§11 削弱），指派 +1 且产业产出 ×0.7', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    const v = s0.villages[0];
    v.dispatchedUnitId = 'u_agri';
    v.internalGovernance = 30;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    // 未指派传帮带：挤出效应每回合仅 −1
    settleEmbedding(s0, v.id, [], ctx);
    expect(v.internalGovernance).toBe(29); // §11：−1（原 −2）
    expect(v.industryOutputMul).toBe(1);
    // 指派传帮带
    const ctx2 = createTurnCtx(s0, seedRng(1), 1);
    v.internalGovernance = 30;
    v.industryOutputMul = 1;
    settleEmbedding(s0, v.id, ['v_yunxi'], ctx2);
    expect(v.internalGovernance).toBe(31); // +1
    expect(v.industryOutputMul).toBe(0.7); // 当回合产业产出 −30%
    expect(ctx2.microFeedbacks.length).toBeGreaterThan(0);
  });

  it('底线防御：财政充足时自动拨 200 锁住内生治理 20', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    s0.techUnlocked = ['tech_floor_defense'];
    s0.county.fiscalFund = 300;
    s0.villages[0].internalGovernance = 19;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    settleFloorDefense(s0, ctx);
    expect(s0.villages[0].internalGovernance).toBe(20);
    expect(s0.county.fiscalFund).toBe(100);
    expect(ctx.events.some((e) => e.type === 'floorDefense' && e.textId === 'floor_defense_text')).toBe(true);
    expect(ctx.ledgerDelta.some((l) => l.note.includes('底线防御'))).toBe(true);
  });

  it('底线防御：财政不足只拉警报不锁底', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    s0.techUnlocked = ['tech_floor_defense'];
    s0.county.fiscalFund = 50;
    s0.villages[0].internalGovernance = 15;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    settleFloorDefense(s0, ctx);
    expect(s0.villages[0].internalGovernance).toBe(15);
    expect(s0.county.fiscalFund).toBe(50);
    expect(ctx.events.some((e) => e.type === 'floorDefense' && e.textId === 'floor_defense_fail_text')).toBe(true);
  });

  it('老支书双效果：韧性上限 +30，个人精力上限 −1', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    s0.heroes.push({ heroId: 'hero_oldsecretary', villageId: 'v_yunxi', recruitRound: 0 });
    s0.county.organizationalResilience = 20;
    const out = playRound(s0, idleActions());
    // 韧性上限 50+30=80；恢复 +5；新公式分母 50 下开局比率 <1，不再触发成本超支伤害
    expect(out.state.county.maxResilience).toBe(80);
    expect(out.state.county.organizationalResilience).toBe(25);
    // 老支书毒点：个人精力上限 6−1=5
    expect(out.state.county.playerStamina).toBe(5);
  });

  it('传帮带在整回合管线中生效：驻村+传帮带村产业产出折减', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    const actions = idleActions();
    actions.dispatch = [{ villageId: 'v_yunxi', unitId: 'u_agri' }];
    actions.mentorship = ['v_yunxi'];
    const out = playRound(s0, actions);
    const v = out.state.villages.find((x) => x.id === 'v_yunxi')!;
    expect(v.dispatchedUnitId).toBe('u_agri');
    // 传帮带当回合生效：结算后该值保持 0.7（下一回合 organization 复位后重算，产业读取时机在复位之后）
    expect(v.industryOutputMul).toBe(0.7);
    // 传帮带本身不产生韧性伤害（resilienceAbsorbed 若出现来自成本超支路径）
    expect(out.events.filter((e) => e.type === 'resilienceAbsorbed').length).toBeLessThanOrEqual(1);
  });

  it('存档 v9 往返：韧性字段与治理护盾完整保留', () => {
    const s0 = createInitialState(20261114, 'returningStudent');
    s0.county.organizationalResilience = 33;
    s0.villages[0].governanceShield = 6;
    const out = playRound(s0, idleActions());
    const round2 = out.state;
    const restored = deserialize(serialize(round2));
    expect(restored.version).toBe(13);
    expect(restored.county.organizationalResilience).toBe(round2.county.organizationalResilience);
    expect(restored.county.maxResilience).toBe(round2.county.maxResilience);
    expect(restored.villages.every((v) => typeof v.industryOutputMul === 'number')).toBe(true);
    expect(restored.villages.every((v) => typeof v.governanceShield === 'number')).toBe(true);
  });
});
