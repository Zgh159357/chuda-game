import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { createTurnCtx } from '../src/core/systems/context';
import { settleEconomy } from '../src/core/systems/economy';
import { seedRng } from '../src/core/rng';
import { chainMasterCatalog } from '../src/config/economy';
import { playRound } from '../src/core/reducer';
import { serialize, deserialize } from '../src/core/save';
import type { GameState, RoundActions } from '../src/core/types';

/** 链主目录条数=3，落地门=目标村摸排+财政≥20 */
function fresh(): GameState {
  return createInitialState(7, 'local');
}

function ctxOf(state: GameState, round = 3, rng = seedRng(42)) {
  return createTurnCtx(state, rng, round);
}

describe('§16 产业深度模拟 · 链主', () => {
  it('落地需要目标村已摸排，否则邀请无效', () => {
    const s = fresh();
    const ctx = ctxOf(s);
    const milk = chainMasterCatalog[0]; // → v_wuling
    s.villages.find((v) => v.id === milk.targetVillageId)!.surveyed = false;
    settleEconomy(s, { chainInvites: [milk.id] }, ctx);
    expect(s.chainMasters.find((m) => m.id === milk.id)!.isPresent).toBe(false);
    expect(s.county.fiscalFund).toBe(120);
  });

  it('摸排 + 财政足够 → 落地：首付 10 财政、isPresent、入成就账', () => {
    const s = fresh();
    const milk = chainMasterCatalog[0];
    s.villages.find((v) => v.id === milk.targetVillageId)!.surveyed = true;
    const ctx = ctxOf(s);
    const before = s.county.fiscalFund;
    settleEconomy(s, { chainInvites: [milk.id] }, ctx);
    const m = s.chainMasters.find((x) => x.id === milk.id)!;
    expect(m.isPresent).toBe(true);
    expect(s.county.fiscalFund).toBe(before - 10 - milk.requiredSubsidyPerTurn + milk.taxRevenue);
    expect(ctx.ledgerDelta.some((l) => l.kind === 'achievement')).toBe(true);
  });

  it('每回合结算：税收到账、补贴被索走、就业压返贫风险', () => {
    const s = fresh();
    const milk = chainMasterCatalog[0];
    const v = s.villages.find((x) => x.id === milk.targetVillageId)!;
    v.surveyed = true;
    const s1 = playRound(s, { chainInvites: [milk.id] }).state;
    const fiscalAfterSettle = s1.county.fiscalFund;
    const riskAfterSettle = s1.villages.find((x) => x.id === milk.targetVillageId)!.returnRisk;
    const s2 = playRound(s1, {}).state;
    const m = s2.chainMasters.find((x) => x.id === milk.id)!;
    expect(m.isPresent).toBe(true);
    expect(m.subsidyPaid).toBeGreaterThan(0);
    // 税收 +25 每回合收入，补贴 ≤12，净效应介于两者之间；就业把风险压下去了
    expect(s2.villages.find((x) => x.id === milk.targetVillageId)!.returnRisk).toBeLessThan(riskAfterSettle);
    expect(fiscalAfterSettle).toBeLessThan(120 + 25); // 首付+补贴拖低过财政
  });

  it('退坡期（r35+）依赖度高且财政开不出补贴 → 满意度崩盘撤资：产业-6、信任-6、事件+负账', () => {
    const s = fresh();
    const milk = chainMasterCatalog[0];
    const v = s.villages.find((x) => x.id === milk.targetVillageId)!;
    v.surveyed = true;
    s.county.fiscalFund = 500;
    const s1 = playRound(s, { chainInvites: [milk.id] }).state;
    s1.chainMasters.find((m) => m.id === milk.id)!.isPresent = true;
    s1.county.fiscalFund = 5; // 连一期补贴（12）都开不出 → 满意度 −30 −20
    s1.county.round = 35; // 退坡期（纯函数按 county.round 判阶段）
    const rng = () => 0.99; // 纯函数判定与 rng 无关
    const ctx = createTurnCtx(s1, rng, 35);
    const industryBefore = s1.villages.find((x) => x.id === milk.targetVillageId)!.industryBase;
    settleEconomy(s1, {}, ctx);
    const m = s1.chainMasters.find((x) => x.id === milk.id)!;
    expect(m.isPresent).toBe(false);
    expect(s1.villages.find((x) => x.id === milk.targetVillageId)!.industryBase).toBeLessThan(industryBefore);
    expect(ctx.events.some((e) => e.type === 'chainWithdraw')).toBe(true);
    expect(ctx.ledgerDelta.some((l) => l.kind === 'cost')).toBe(true);
  });

  it('退坡期依赖 55 的链主（通海蔬菜）财政充足 → 不撤资', () => {
    const s = fresh();
    const veg = chainMasterCatalog[1]; // dep 55
    const v = s.villages.find((x) => x.id === veg.targetVillageId)!;
    v.surveyed = true;
    s.county.fiscalFund = 500;
    const s1 = playRound(s, { chainInvites: [veg.id] }).state;
    s1.county.fiscalFund = 300;
    const ctx = createTurnCtx(s1, () => 0.01, 36);
    settleEconomy(s1, {}, ctx);
    expect(s1.chainMasters.find((x) => x.id === veg.id)!.isPresent).toBe(true);
  });
});

describe('§16 产业深度模拟 · 飞地抱团', () => {
  it('签约锁定本金；分红进集体账，源村产业不涨、内生治理倒扣', () => {
    const s = fresh();
    const src = s.villages.find((v) => v.id === 'v_yunxi')!;
    const dst = s.villages.find((v) => v.id === 'v_qingshi')!;
    dst.surveyed = true;
    src.collectiveEconomy = 100;
    const cap = 60;
    const ctx = ctxOf(s, 4);
    settleEconomy(s, { enclaveInvest: [{ sourceVillageId: 'v_yunxi', targetVillageId: 'v_qingshi', investedCapital: cap, annualDividendRate: 0.1 }] }, ctx);
    expect(s.enclaves).toHaveLength(1);
    expect(src.collectiveEconomy).toBe(100 - cap);
    expect(src.enclaveInvestments).toHaveLength(1);
    // 第 8 回合持有期满 4 → 分红；目标村产业 40/100 → 健康度 0.4 → 分红腰斩 + 内生治理 −2
    const s2 = JSON.parse(JSON.stringify(s)) as GameState;
    const ctx2 = createTurnCtx(s2, () => 0.5, 8);
    const collectiveBefore = s2.villages.find((v) => v.id === 'v_yunxi')!.collectiveEconomy;
    const industryBefore = s2.villages.find((v) => v.id === 'v_yunxi')!.industryBase;
    const govBefore = s2.villages.find((v) => v.id === 'v_yunxi')!.internalGovernance;
    settleEconomy(s2, {}, ctx2);
    expect(s2.villages.find((v) => v.id === 'v_yunxi')!.collectiveEconomy).toBe(collectiveBefore + 3); // round(60×0.1×0.5)
    expect(s2.villages.find((v) => v.id === 'v_yunxi')!.industryBase).toBe(industryBefore);
    expect(s2.villages.find((v) => v.id === 'v_yunxi')!.internalGovernance).toBe(govBefore - 2);
    expect(ctx2.events.some((e) => e.type === 'enclaveDividend')).toBe(true);
  });

  it('源村集体钱不够或目标村未摸排 → 不签', () => {
    const s = fresh();
    const dst = s.villages.find((v) => v.id === 'v_qingshi')!;
    dst.surveyed = false;
    const ctx = ctxOf(s);
    settleEconomy(s, { enclaveInvest: [{ sourceVillageId: 'v_yunxi', targetVillageId: 'v_qingshi', investedCapital: 5, annualDividendRate: 0.1 }] }, ctx);
    expect(s.enclaves).toHaveLength(0);
  });
});

describe('§16 产业深度模拟 · 契约化分红', () => {
  it('保底价：补贴依赖+2、农户退出意愿+2', () => {
    const s = fresh();
    const beforeDep = s.villages.find((x) => x.id === 'v_yunxi')!.subsidyDependence;
    const beforeExit = s.villages.find((x) => x.id === 'v_yunxi')!.households.map((h) => h.exitWillingness);
    const ctx = ctxOf(s);
    settleEconomy(s, { contractUpdates: { v_yunxi: { guaranteedPrice: true, premiumSharingToFarmer: 0, collectiveServiceFee: 0, propertyRightsToVillage: false } } }, ctx);
    const v = s.villages.find((x) => x.id === 'v_yunxi')!;
    expect(v.subsidyDependence).toBe(beforeDep + 2);
    expect(v.households.every((h, i) => h.exitWillingness === beforeExit[i] + 2)).toBe(true);
  });

  it('产权确权：双绑 ≥45 才生效，否则条款被撤回', () => {
    const s = fresh();
    const v = s.villages.find((x) => x.id === 'v_yunxi')!;
    v.dualBindStability = 30;
    const ctx = ctxOf(s);
    settleEconomy(s, { contractUpdates: { v_yunxi: { guaranteedPrice: false, premiumSharingToFarmer: 0, collectiveServiceFee: 0, propertyRightsToVillage: true } } }, ctx);
    expect(s.distributionContracts['v_yunxi'].propertyRightsToVillage).toBe(false);
  });

  it('确权成功：双绑每回合 +8；溢价与服务费进账', () => {
    const s = fresh();
    const v = s.villages.find((x) => x.id === 'v_yunxi')!;
    v.dualBindStability = 60;
    const ctx = ctxOf(s);
    settleEconomy(s, { contractUpdates: { v_yunxi: { guaranteedPrice: false, premiumSharingToFarmer: 40, collectiveServiceFee: 5, propertyRightsToVillage: true } } }, ctx);
    expect(s.distributionContracts['v_yunxi'].propertyRightsToVillage).toBe(true);
    const vb = s.villages.find((x) => x.id === 'v_yunxi')!;
    expect(vb.dualBindStability).toBe(68);
    expect(vb.collectiveEconomy).toBeGreaterThanOrEqual(1);
  });
});

describe('§16 产业深度模拟 · 物理漏损', () => {
  it('冷库空置率超阈值 → infraWaste 事件+负账', () => {
    const s = fresh();
    s.physicalInfra.coldChainCapacity = 4;
    s.projects.forEach((p) => (p.status = 'stalled' as never));
    const ctx = ctxOf(s);
    settleEconomy(s, {}, ctx);
    expect(s.physicalInfra.coldChainIdleRate).toBeGreaterThan(0.35);
    expect(ctx.events.some((e) => e.type === 'infraWaste')).toBe(true);
  });

  it('APP 没人用（使用率<20%）→ 无效投资负账；参与高则使用率爬升', () => {
    const s = fresh();
    s.physicalInfra.hasSmartAgriApp = true;
    s.physicalInfra.appAdoptionRate = 0.1;
    const ctx = ctxOf(s);
    settleEconomy(s, {}, ctx);
    expect(ctx.ledgerDelta.some((l) => l.kind === 'cost' && l.key === 'app_idle')).toBe(true);
  });

  it('节点行动：扩建冷链库容与上线 APP 走核心层', () => {
    const s = fresh();
    s.county.playerStamina = 6;
    const out = playRound(s, { nodeActions: ['coldchain_expand', 'smart_app_launch'] }).state;
    expect(out.physicalInfra.coldChainCapacity).toBe(4); // 2+2
    expect(out.physicalInfra.hasSmartAgriApp).toBe(true);
    expect(out.physicalInfra.appAdoptionRate).toBeGreaterThan(0);
  });
});

describe('§16 存档 v14 往返', () => {
  it('链主/飞地/契约/基础设施全量存活', () => {
    const s = fresh();
    s.villages.find((v) => v.id === 'v_yunxi')!.surveyed = true;
    s.villages.find((v) => v.id === 'v_wuling')!.surveyed = true;
    s.villages.find((v) => v.id === 'v_wuling')!.collectiveEconomy = 50;
    const out = playRound(s, {
      chainInvites: ['chain_veg'],
      enclaveInvest: [{ sourceVillageId: 'v_wuling', targetVillageId: 'v_yunxi', investedCapital: 10, annualDividendRate: 0.1 }],
      contractUpdates: { v_yunxi: { guaranteedPrice: true, premiumSharingToFarmer: 20, collectiveServiceFee: 2, propertyRightsToVillage: false } },
      nodeActions: ['coldchain_expand'],
    }).state;
    const back = deserialize(serialize(out));
    expect(back.version).toBe(15);
    expect(back.chainMasters.find((m) => m.id === 'chain_veg')!.isPresent).toBe(true);
    expect(back.enclaves).toHaveLength(1);
    expect(back.villages.find((v) => v.id === 'v_wuling')!.enclaveInvestments).toHaveLength(1);
    expect(back.distributionContracts['v_yunxi'].guaranteedPrice).toBe(true);
    expect(back.physicalInfra.coldChainCapacity).toBe(4);
  });
});
