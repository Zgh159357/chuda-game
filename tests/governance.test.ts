import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { serialize, deserialize } from '../src/core/save';
import {
  calculateGovernanceDecay,
  shieldDamage,
  regenerateShield,
} from '../src/core/systems/governance';
import { settleOrganization } from '../src/core/systems/organization';
import { createTurnCtx } from '../src/core/systems/context';
import { seedRng } from '../src/core/rng';
import type { RoundActions } from '../src/core/types';

function idle(): RoundActions {
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

describe('§11 组织度公式重构', () => {
  it('calculateGovernanceDecay：无驻村队自然增长 0.8、无挤出', () => {
    const s0 = createInitialState(1, 'local');
    const v = s0.villages[0];
    v.dispatchedUnitId = null;
    const r = calculateGovernanceDecay(s0, v, false);
    expect(r.growth).toBe(0.8);
    expect(r.extrusion).toBe(0);
  });

  it('calculateGovernanceDecay：有队未传帮带 → 增长 0、每回合仅挤出 1 点', () => {
    const s0 = createInitialState(1, 'local');
    const v = s0.villages[0];
    v.dispatchedUnitId = 'u_agri';
    const r = calculateGovernanceDecay(s0, v, false);
    expect(r.growth).toBe(0);
    expect(r.extrusion).toBe(1);
  });

  it('calculateGovernanceDecay：传帮带恢复增长 +1、无挤出', () => {
    const s0 = createInitialState(1, 'local');
    const v = s0.villages[0];
    v.dispatchedUnitId = 'u_agri';
    const r = calculateGovernanceDecay(s0, v, true);
    expect(r.growth).toBe(1);
    expect(r.extrusion).toBe(0);
  });

  it('calculateGovernanceDecay：老支书（orgSlow 0.5）挤出减半为 0.5', () => {
    const s0 = createInitialState(1, 'local');
    s0.heroes.push({ heroId: 'hero_oldsecretary', villageId: 'v_yunxi', recruitRound: 0 });
    const v = s0.villages[0];
    v.dispatchedUnitId = 'u_agri';
    const r = calculateGovernanceDecay(s0, v, false);
    expect(r.extrusion).toBe(0.5);
  });

  it('shieldDamage：护盾充足时全额吸收，真实伤害为 0', () => {
    const s0 = createInitialState(1, 'local');
    s0.villages[0].governanceShield = 6;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const actual = shieldDamage(s0, 'v_yunxi', 2, ctx);
    expect(actual).toBe(0);
    expect(s0.villages[0].governanceShield).toBe(4);
    expect(
      ctx.events.some((e) => e.type === 'governanceShieldAbsorbed' && e.amount === 2)
    ).toBe(true);
  });

  it('shieldDamage：护盾不足时穿透部分伤害', () => {
    const s0 = createInitialState(1, 'local');
    s0.villages[0].governanceShield = 1;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const actual = shieldDamage(s0, 'v_yunxi', 2, ctx);
    expect(actual).toBe(1);
    expect(s0.villages[0].governanceShield).toBe(0);
  });

  it('regenerateShield：按驻村干部数每回合生成并封顶', () => {
    const s0 = createInitialState(1, 'local');
    const v = s0.villages[0]; // cad_chen 驻村 v_yunxi（1 名）
    v.governanceShield = 0;
    regenerateShield(s0, v);
    expect(v.governanceShield).toBe(2);
    v.governanceShield = 7;
    regenerateShield(s0, v);
    expect(v.governanceShield).toBe(8); // 封顶
  });

  it('成本比率平滑：零产出时比率 <1，不触发组织成本惩罚', () => {
    const s0 = createInitialState(1, 'local');
    s0.projects.forEach((p) => {
      p.status = 'broken';
    });
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const pcBefore = s0.county.politicalCapital;
    const trustBefore = s0.county.trust;
    settleOrganization(s0, idle(), ctx);
    expect(s0.county.orgCostRatio).toBeLessThan(1);
    expect(s0.county.politicalCapital).toBe(pcBefore);
    expect(s0.county.trust).toBe(trustBefore);
  });

  it('惩罚上限：比率极高时政资/信任单回合各扣至多 20 点', () => {
    const s0 = createInitialState(1, 'local');
    s0.projects.forEach((p) => {
      p.status = 'broken';
    });
    s0.county.adminBurden = 1000;
    const ctx = createTurnCtx(s0, seedRng(1), 1);
    const pcBefore = s0.county.politicalCapital;
    const trustBefore = s0.county.trust;
    settleOrganization(s0, idle(), ctx);
    expect(s0.county.orgCostRatio).toBeGreaterThan(15);
    expect(pcBefore - s0.county.politicalCapital).toBe(20);
    expect(trustBefore - s0.county.trust).toBe(20);
  });

  it('项目烂尾冲击优先扣护盾：内生治理不受伤', () => {
    const s0 = createInitialState(1, 'local');
    const v = s0.villages.find((x) => x.id === 'v_wuling')!;
    const p = s0.projects.find((x) => x.id === 'p_wuling_chicken')!;
    p.status = 'active';
    p.subsidyDependence = 80;
    p.invested = 20;
    v.governanceShield = 2; // cad_liu 驻村 v_wuling → 每回合再 +2
    const govBefore = v.internalGovernance;
    const out = playRound(s0, idle());
    const v2 = out.state.villages.find((x) => x.id === 'v_wuling')!;
    expect(
      out.events.some((e) => e.type === 'projectFailure' && e.projectId === 'p_wuling_chicken')
    ).toBe(true);
    expect(
      out.events.some((e) => e.type === 'governanceShieldAbsorbed' && e.villageId === 'v_wuling')
    ).toBe(true);
    // 冲击被护盾吸收：内生治理只走了自然增长（+0.8），没有额外扣减
    expect(v2.internalGovernance).toBeGreaterThanOrEqual(govBefore);
    expect(v2.governanceShield).toBeLessThan(4);
  });

  it('存档 v9 往返：治理护盾完整保留', () => {
    const s0 = createInitialState(1, 'local');
    s0.villages[0].governanceShield = 5;
    const back = deserialize(serialize(s0));
    expect(back.version).toBe(12);
    expect(back.villages[0].governanceShield).toBe(5);
  });
});
