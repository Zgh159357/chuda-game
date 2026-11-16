import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import {
  evaluateChainMasterExit,
  calculateEnclaveImpact,
  resolveContract,
  applyPhysicalLoss,
} from '../src/logic/economyEngine';
import { chainMasterCatalog } from '../src/config/economy';
import type { DistributionContract, PhysicalInfrastructure, VillageState } from '../src/core/types';

function fresh() {
  return createInitialState(7, 'local');
}

describe('§17 纯函数 · evaluateChainMasterExit（链主吸血与退坡暴雷）', () => {
  it('A 阶段财政充足 → 永不撤资', () => {
    const s = fresh();
    s.county.round = 10; // B 阶段
    s.chainMasters[0].isPresent = true;
    s.county.fiscalFund = 500;
    expect(evaluateChainMasterExit(s, s.chainMasters[0].id).willExit).toBe(false);
  });

  it('退坡期依赖 75 + 财政开不出补贴 → 撤资（reason 非空）', () => {
    const s = fresh();
    s.county.round = 36; // D 阶段
    const milk = s.chainMasters[0]; // dep 75
    milk.isPresent = true;
    s.county.fiscalFund = 5; // < 12
    const v = evaluateChainMasterExit(s, milk.id);
    expect(v.willExit).toBe(true);
    expect(v.reason.length).toBeGreaterThan(0);
  });

  it('退坡期依赖 75 + 财政充足 → 不撤资', () => {
    const s = fresh();
    s.county.round = 40;
    const milk = s.chainMasters[0];
    milk.isPresent = true;
    s.county.fiscalFund = 300;
    expect(evaluateChainMasterExit(s, milk.id).willExit).toBe(false);
  });

  it('退坡期依赖 90 极端值 + 财政充足 → 满意度 100−(90−40)×1.2=40，达标不撤', () => {
    const s = fresh();
    s.county.round = 38;
    const milk = s.chainMasters[0];
    milk.isPresent = true;
    milk.policyDependency = 90;
    s.county.fiscalFund = 300;
    expect(evaluateChainMasterExit(s, milk.id).willExit).toBe(false);
  });

  it('链主未落地 → 直接不撤', () => {
    const s = fresh();
    s.county.round = 40;
    s.chainMasters[0].isPresent = false;
    expect(evaluateChainMasterExit(s, s.chainMasters[0].id).willExit).toBe(false);
  });
});

describe('§17 纯函数 · calculateEnclaveImpact（飞地虚胖陷阱）', () => {
  function villageWithHoldings(capital: number, rate: number): VillageState {
    const s = fresh();
    const v = s.villages[0];
    v.enclaveInvestments = [{ investedCapital: capital, annualDividendRate: rate, targetVillageId: 'v_qingshi' }];
    return v;
  }

  it('目标产业健康 → 足额分红，内生治理 −1', () => {
    const v = villageWithHoldings(100, 0.1);
    const r = calculateEnclaveImpact(v, 0.8);
    expect(r.cashIncome).toBe(10);
    expect(r.governancePenalty).toBe(1);
  });

  it('目标产业下行（0.3）→ 分红腰斩，内生治理 −2', () => {
    const v = villageWithHoldings(100, 0.1);
    const r = calculateEnclaveImpact(v, 0.3);
    expect(r.cashIncome).toBe(5);
    expect(r.governancePenalty).toBe(2);
  });

  it('目标产业崩盘（0.1）→ 分红中断（0），内生治理 −4（1+1+2）', () => {
    const v = villageWithHoldings(100, 0.1);
    const r = calculateEnclaveImpact(v, 0.1);
    expect(r.cashIncome).toBe(0);
    expect(r.governancePenalty).toBe(4);
  });

  it('无持仓 → 全零', () => {
    const s = fresh();
    const r = calculateEnclaveImpact(s.villages[0], 0.9);
    expect(r.cashIncome).toBe(0);
    expect(r.governancePenalty).toBe(0);
  });
});

describe('§17 纯函数 · resolveContract（契约三方拉扯）', () => {
  const base = 100;

  it('全偏向农户（保底+高分成+确权）→ 政治分高、企业利润锐减', () => {
    const c: DistributionContract = {
      guaranteedPrice: true,
      premiumSharingToFarmer: 60,
      collectiveServiceFee: 0,
      propertyRightsToVillage: true,
    };
    const r = resolveContract(c, base);
    expect(r.farmerIncome).toBeCloseTo(30 + 60, 1);
    expect(r.enterpriseProfit).toBeLessThan(40);
    expect(r.politicalScore).toBeGreaterThanOrEqual(80);
  });

  it('全偏向企业（无条款）→ 利润无损、政治分垫底', () => {
    const c: DistributionContract = {
      guaranteedPrice: false,
      premiumSharingToFarmer: 0,
      collectiveServiceFee: 0,
      propertyRightsToVillage: false,
    };
    const r = resolveContract(c, base);
    expect(r.enterpriseProfit).toBe(base);
    expect(r.farmerIncome).toBe(0);
    expect(r.politicalScore).toBe(40);
  });

  it('只有服务费 → 只吃企业，农户政治分不动', () => {
    const c: DistributionContract = {
      guaranteedPrice: false,
      premiumSharingToFarmer: 0,
      collectiveServiceFee: 5,
      propertyRightsToVillage: false,
    };
    const r = resolveContract(c, base);
    expect(r.enterpriseProfit).toBeCloseTo(95, 1);
    expect(r.politicalScore).toBe(40);
  });

  it('企业利润不为负（保底+满分成+满服务费+确权 极端组合）', () => {
    const c: DistributionContract = {
      guaranteedPrice: true,
      premiumSharingToFarmer: 100,
      collectiveServiceFee: 10,
      propertyRightsToVillage: true,
    };
    const r = resolveContract(c, base);
    expect(r.enterpriseProfit).toBeGreaterThanOrEqual(0);
  });
});

describe('§17 纯函数 · applyPhysicalLoss（物理漏损与数字化惩罚）', () => {
  const base = 100;
  const infra = (patch: Partial<PhysicalInfrastructure>): PhysicalInfrastructure => ({
    coldChainCapacity: 2,
    coldChainIdleRate: 0.2,
    hasSmartAgriApp: false,
    appAdoptionRate: 0,
    ...patch,
  });

  it('设施健康（空置低/无APP）→ 无漏损', () => {
    expect(applyPhysicalLoss(base, infra({}))).toBe(100);
  });

  it('冷库空置 50% → 漏损 25%（0.5×0.5）', () => {
    const r = applyPhysicalLoss(base, infra({ coldChainIdleRate: 0.5 }));
    expect(r).toBeCloseTo(75, 1);
  });

  it('APP 上线没人用 → 额外 15% 漏损', () => {
    const r = applyPhysicalLoss(base, infra({ hasSmartAgriApp: true, appAdoptionRate: 0.1 }));
    expect(r).toBeCloseTo(85, 1);
  });

  it('APP 真正用起来（70%）→ 数字化红利 −5% 漏损', () => {
    const r = applyPhysicalLoss(base, infra({ hasSmartAgriApp: true, appAdoptionRate: 0.7 }));
    expect(r).toBeCloseTo(105, 1);
  });

  it('空置 100% + APP 没人用 → 漏损封顶 30%', () => {
    const r = applyPhysicalLoss(base, infra({ coldChainIdleRate: 1, hasSmartAgriApp: true, appAdoptionRate: 0 }));
    expect(r).toBe(70);
  });

  it('冷库没建（capacity 0）→ 空置率不参与漏损', () => {
    const r = applyPhysicalLoss(base, infra({ coldChainCapacity: 0, coldChainIdleRate: 0.9 }));
    expect(r).toBe(100);
  });
});

describe('§17 管线接线（结算层消费纯函数）', () => {
  it('目录链主与纯函数口径一致（milk dep 75）', () => {
    const milk = chainMasterCatalog[0];
    expect(milk.policyDependency).toBe(75);
    expect(milk.requiredSubsidyPerTurn).toBe(12);
  });
});
