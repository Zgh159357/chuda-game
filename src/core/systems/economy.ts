import type { GameState, RoundActions, DistributionContract } from '../types';
import { config } from '../../config';
import { chainMasterCatalog, DEFAULT_CONTRACT } from '../../config/economy';
import {
  evaluateChainMasterExit,
  calculateEnclaveImpact,
  resolveContract,
} from '../../logic/economyEngine';
import type { TurnCtx } from './context';

// ============================================================
// §16 产业深度模拟：链主资本博弈 / 飞地腾挪 / 契约化分配 / 物理漏损
// 核心立意：外部资本是放大器，不是内生能力的替代品；
// 契约写不写进纸面、写进纸面的是谁，决定退坡时的成色。
// ============================================================

/** 某村当前有效的分红契约（未签约为默认口头约定） */
export function contractOf(state: GameState, villageId: string): DistributionContract {
  return state.distributionContracts[villageId] ?? DEFAULT_CONTRACT;
}

/** 链主在退坡期（r35 起）是否面临撤资风险 */
export function chainWithdrawRisk(state: GameState, round: number): boolean {
  return round >= 35;
}

/** 处理本回合的链主邀请（落地需要：目标村已摸排 + 县域财政垫得起首期） */
function settleChainInvites(state: GameState, actions: RoundActions | undefined, ctx: TurnCtx): void {
  for (const chainId of actions?.chainInvites ?? []) {
    const def = chainMasterCatalog.find((c) => c.id === chainId);
    if (!def) continue;
    const master = state.chainMasters.find((c) => c.id === chainId);
    if (!master || master.isPresent) continue;
    const village = state.villages.find((v) => v.id === def.targetVillageId);
    if (!village || !village.surveyed) continue; // 没摸排清楚，链主不来
    if (state.county.fiscalFund < 20) continue; // 连首期都垫不起
    master.isPresent = true;
    master.settledRound = ctx.round;
    state.county.fiscalFund -= 10; // 落地配套首付
    ctx.pushFeedback('mf_scheduler', 'chain_settled_text');
    ctx.addStars(8);
    ctx.pushLedger('achievement', 'chain_settled', 5, `${def.name} 落地 ${village.name}`);
    ctx.noteCombo('solid');
  }
}

/** 链主每回合结算：就业/税收/补贴需求 + 满意度撤资（§17 纯函数判定） */
function settleChainMasters(state: GameState, ctx: TurnCtx): void {
  const b = config.balance.economy;
  for (const master of state.chainMasters) {
    if (!master.isPresent) continue;
    const village = state.villages.find((v) => v.id === master.targetVillageId);
    if (!village) continue;
    // 就业与税收：扎扎实实的回报
    village.returnRisk = Math.max(0, village.returnRisk - 1);
    village.industryBase = Math.min(100, village.industryBase + 0.5);
    state.county.fiscalFund += master.taxRevenue;
    // 政策补贴需求：每回合明码索价（§17：强制扣除 requiredSubsidyPerTurn）
    const subsidy = Math.min(master.requiredSubsidyPerTurn, state.county.fiscalFund);
    state.county.fiscalFund -= subsidy;
    master.subsidyPaid += subsidy;
    village.subsidyDependence = Math.min(100, village.subsidyDependence + 0.5);
    // §17 撤资判定：满意度跌破阈值 → 直接撤资（不再掷骰子，因果全在满意度上）
    const verdict = evaluateChainMasterExit(state, master.id);
    if (verdict.willExit) {
      master.isPresent = false;
      village.industryBase = Math.max(0, village.industryBase - 6);
      village.returnRisk = Math.min(100, village.returnRisk + 5);
      state.county.trust = Math.max(0, state.county.trust - b.chainWithdrawTrustHit);
      ctx.pushEvent({
        type: 'chainWithdraw',
        round: ctx.round,
        chainId: master.id,
        villageId: village.id,
      });
      ctx.pushLedger('cost', 'chain_withdraw', -6, `${master.name} 撤资离场（${verdict.reason}）`);
      ctx.addStars(-10);
    }
  }
}

/** 飞地抱团：新签入股（源村集体出本金）+ 定期分红（钱到账，内生产业不长，还倒扣内生） */
function settleEnclaves(state: GameState, actions: RoundActions | undefined, ctx: TurnCtx): void {
  const b = config.balance.economy;
  for (const draft of actions?.enclaveInvest ?? []) {
    const source = state.villages.find((v) => v.id === draft.sourceVillageId);
    const target = state.villages.find((v) => v.id === draft.targetVillageId);
    if (!source || !target) continue;
    if (source.id === target.id) continue;
    if (source.collectiveEconomy < draft.investedCapital) continue; // 出不起钱
    if (!target.surveyed) continue; // 强村底数都没摸清，不敢投
    source.collectiveEconomy -= draft.investedCapital; // 本金锁定
    state.enclaves.push({
      ...draft,
      id: `enc_${source.id}_${target.id}_${ctx.round}`,
      investedRound: ctx.round,
      dividendsPaid: 0,
    });
    // §17：源村持有持仓快照（纯函数 calculateEnclaveImpact 的数据源）
    source.enclaveInvestments.push({
      investedCapital: draft.investedCapital,
      annualDividendRate: draft.annualDividendRate,
      targetVillageId: draft.targetVillageId,
    });
    ctx.pushLedger('transition', 'enclave_signed', 2, `${source.name} 入股 ${target.name}`);
    ctx.noteCombo('solid');
  }
  // 分红：按源村分组，用纯函数算「现金 + 内生治理惩罚」
  const penaltyApplied = new Map<string, boolean>();
  for (const enc of state.enclaves) {
    const roundsHeld = ctx.round - enc.investedRound;
    if (roundsHeld <= 0 || roundsHeld % b.enclaveDividendInterval !== 0) continue;
    const source = state.villages.find((v) => v.id === enc.sourceVillageId);
    const target = state.villages.find((v) => v.id === enc.targetVillageId);
    if (!source) continue;
    const targetHealth = target ? target.industryBase / 100 : 0;
    const impact = calculateEnclaveImpact(source, targetHealth);
    source.collectiveEconomy += impact.cashIncome;
    enc.dividendsPaid += impact.cashIncome;
    if (!penaltyApplied.has(source.id)) {
      penaltyApplied.set(source.id, true);
      source.internalGovernance = Math.max(0, source.internalGovernance - impact.governancePenalty);
      if (impact.governancePenalty > 0) {
        ctx.pushLedger(
          'org',
          'enclave_governance',
          -impact.governancePenalty,
          `${source.name} 躺在分红上，内生治理下滑 ${impact.governancePenalty}`
        );
      }
    }
    ctx.pushEvent({ type: 'enclaveDividend', round: ctx.round, enclaveId: enc.id, amount: impact.cashIncome });
    ctx.pushLedger('transition', 'enclave_dividend', 1, `${source.name} 收到飞地分红 ${impact.cashIncome}`);
    // 刻意不提升源村 industryBase/internalGovernance——飞地不养内生（县域经济痛点）
  }
}

/** 契约化分红：签约门（产权确权需双绑稳定）+ 每回合条款结算 */
function settleContracts(state: GameState, actions: RoundActions | undefined, ctx: TurnCtx): void {
  const b = config.balance.economy;
  for (const [villageId, contract] of Object.entries(actions?.contractUpdates ?? {})) {
    const village = state.villages.find((v) => v.id === villageId);
    if (!village) continue;
    if (contract.propertyRightsToVillage && village.dualBindStability < 45) {
      contract.propertyRightsToVillage = false; // 确权极难：双绑不稳，村集体拿不到产权
      ctx.pushFeedback('mf_scheduler', 'mf_scheduler_text');
    }
    state.distributionContracts[villageId] = contract;
  }
  for (const village of state.villages) {
    const c = contractOf(state, village.id);
    if (c.guaranteedPrice) {
      village.subsidyDependence = Math.min(100, village.subsidyDependence + b.guaranteedPriceSubsidy);
      for (const h of village.households) {
        h.exitWillingness = Math.min(100, h.exitWillingness + 2); // 保底价让农户敢退、敢干
      }
    }
    if (c.collectiveServiceFee > 0) {
      village.collectiveEconomy += c.collectiveServiceFee * b.serviceFeeCollectivePerPoint;
    }
    if (c.propertyRightsToVillage) {
      village.dualBindStability = Math.min(100, village.dualBindStability + b.propertyRightsDualBind);
    }
    // §17 三方博弈：农户/企业/政治分由纯函数算，只把「结果」落回状态
    const baseProfit = 20 + village.industryBase * 0.5; // 该村代表性利润盘子
    const outcome = resolveContract(c, baseProfit);
    if (outcome.farmerIncome > 0) {
      // 农户实得 → 参与与信任（联农带农考核口径）
      village.participation = Math.min(100, village.participation + Math.round(outcome.farmerIncome / 10));
      state.county.trust = Math.min(
        100,
        state.county.trust + Math.round((outcome.farmerIncome / 20) * b.premiumTrustPer10)
      );
    }
    // 企业利润被榨干 → 渠道逐渐流失（企业用脚投票）
    if (outcome.enterpriseProfit < baseProfit * 0.4) {
      village.industryChannel = Math.max(0, village.industryChannel - 0.5);
    }
  }
}

/** 物理漏损与数字化错位：冷库空转、APP 没人用 = 无效投资 */
function settleInfrastructure(state: GameState, ctx: TurnCtx): void {
  const b = config.balance.economy;
  const infra = state.physicalInfra;
  const activeProjects = state.projects.filter((p) => p.status === 'active' || p.status === 'recovered').length;
  if (infra.coldChainCapacity > 0) {
    const usage = Math.min(infra.coldChainCapacity, activeProjects * b.coldChainUsagePerProject);
    infra.coldChainIdleRate = Math.max(0, 1 - usage / infra.coldChainCapacity);
    if (infra.coldChainIdleRate > b.idleRatePenaltyThreshold) {
      ctx.pushEvent({ type: 'infraWaste', round: ctx.round, textId: 'infra_waste_text' });
      ctx.pushLedger('cost', 'coldchain_idle', -3, '冷库空转，财政打了水漂');
    }
  }
  if (infra.hasSmartAgriApp) {
    const avgParticipation = state.villages.reduce((s, v) => s + v.participation, 0) / state.villages.length;
    if (avgParticipation >= 60) {
      infra.appAdoptionRate = Math.min(1, infra.appAdoptionRate + b.appAdoptionGrowth);
    }
    if (infra.appAdoptionRate < b.appAdoptionThreshold) {
      ctx.pushLedger('cost', 'app_idle', -2, '智慧农业 APP 没人用');
    }
  }
}

/** §16 总入口：链主 → 飞地 → 契约 → 基础设施（reducer 在产业结算后调用） */
export function settleEconomy(state: GameState, actions: RoundActions | undefined, ctx: TurnCtx): void {
  settleChainInvites(state, actions, ctx);
  settleChainMasters(state, ctx);
  settleEnclaves(state, actions, ctx);
  settleContracts(state, actions, ctx);
  settleInfrastructure(state, ctx);
}
