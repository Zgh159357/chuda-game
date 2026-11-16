// ============================================================
// §17 产业链博弈与结算纯函数（src/logic/economyEngine.ts）
// 要求：全部纯函数、无副作用、边界严密；随机性与状态写入一律由调用方负责。
// 设计立意：链主的钱是借来的时间，飞地的分红是收租的幻觉，
// 契约的纸面条款是分钱的规矩，物理漏损是账本之外的真实损耗。
// ============================================================

import type {
  DistributionContract,
  GameState,
  PhysicalInfrastructure,
  VillageState,
} from '../core/types';
import { derivePhase } from '../core/state/phaseMachine';

// ============================================================
// 1. 链主吸血与退坡暴雷 —— evaluateChainMasterExit
// 每回合强制扣除 requiredSubsidyPerTurn 由结算层执行；
// 本函数判定「满意度」：进入常态化/补贴退坡阶段、或县财政开不出补贴，
// 满意度逐项扣减；跌破阈值 → willExit，该县瞬间失去就业税收、返贫风险暴增。
// ============================================================

export interface ChainMasterExitVerdict {
  willExit: boolean;
  reason: string; // 撤资缘由（写进事件/台账，让玩家看见因果）
}

/** 满意度跌破该阈值即撤资 */
const SATISFACTION_EXIT_THRESHOLD = 40;

export function evaluateChainMasterExit(state: GameState, masterId: string): ChainMasterExitVerdict {
  const master = state.chainMasters.find((m) => m.id === masterId);
  if (!master || !master.isPresent) return { willExit: false, reason: '' };

  const phase = derivePhase(state.county.round);
  let satisfaction = 100;
  const reasons: string[] = [];

  // 常态化/补贴退坡阶段：政策依赖度越高，满意度掉得越快（依赖 40 以下白嫖，90 就是命门）
  if (phase === 'D' || phase === 'E') {
    if (master.policyDependency >= 60) {
      satisfaction -= (master.policyDependency - 40) * 1.2;
      reasons.push('补贴退坡后，政策依赖度难以为继');
    }
  }

  // 县财政连这一期补贴都开不出：链主对账期不满
  if (state.county.fiscalFund < master.requiredSubsidyPerTurn) {
    satisfaction -= 30;
    reasons.push('县财政无力支付本期补贴');
    // 连一半都开不出，怨气翻倍
    if (state.county.fiscalFund < master.requiredSubsidyPerTurn / 2) {
      satisfaction -= 20;
    }
  }

  const willExit = satisfaction < SATISFACTION_EXIT_THRESHOLD;
  return {
    willExit,
    reason: willExit ? (reasons.join('；') || '链主满意度跌破阈值') : '',
  };
}

// ============================================================
// 2. 飞地经济的「虚胖」陷阱 —— calculateEnclaveImpact
// 分红按目标产业健康度折算（腰斩/中断）；
// 每拿一期分红，源村 internalGovernance 永久下滑——收租度日，治理荒废。
// ============================================================

export interface EnclaveImpact {
  cashIncome: number; // 实得分红（已按目标产业健康度折算）
  governancePenalty: number; // 源村内生治理永久损失（不回补）
}

export function calculateEnclaveImpact(
  sourceVillage: VillageState,
  targetIndustryHealth: number
): EnclaveImpact {
  const holdings = sourceVillage.enclaveInvestments ?? [];
  const nominal = holdings.reduce((sum, h) => sum + h.investedCapital * h.annualDividendRate, 0);
  if (nominal === 0) return { cashIncome: 0, governancePenalty: 0 }; // 没有飞地持仓，谈不上收租与荒废

  // 目标产业健康度 0-1：≥0.5 足额，0.25~0.5 腰斩，<0.25 分红中断（破产边缘）
  let factor = 1;
  if (targetIndustryHealth < 0.5) factor = 0.5;
  if (targetIndustryHealth < 0.25) factor = 0;
  const cashIncome = Math.round(nominal * factor);

  // 虚胖陷阱：拿分红就吃懒汉药，内生治理永久下滑
  let governancePenalty = 1; // 基础：躺在分红上过日子
  if (targetIndustryHealth < 0.5) governancePenalty += 1; // 收益腰斩，更没心思搞治理
  if (targetIndustryHealth < 0.25) governancePenalty += 2; // 分红中断，讨债跑腿，班子涣散

  return { cashIncome, governancePenalty };
}

// ============================================================
// 3. 契约分红的利益拉扯 —— resolveContract
// 三方博弈：农户（分成/保底）、企业（利润）、政治（联农带农考核）。
// 偏农户 → 政治分高、企业利润锐减；偏企业 → 利润好看、政治分垫底。
// ============================================================

export interface ContractOutcome {
  farmerIncome: number; // 农户实得（结算层据此加信任/参与）
  enterpriseProfit: number; // 企业留存利润（过低 → 渠道流失）
  politicalScore: number; // 联农带农政治分 0-100
}

export function resolveContract(contract: DistributionContract, baseProfit: number): ContractOutcome {
  let farmerIncome = 0;
  let enterpriseProfit = baseProfit;
  let politicalScore = 40; // 无联农带农条款：政治分垫底

  if (contract.guaranteedPrice) {
    farmerIncome += baseProfit * 0.3;
    enterpriseProfit -= baseProfit * 0.25;
    politicalScore += 15;
  }

  if (contract.premiumSharingToFarmer > 0) {
    const cut = (baseProfit * contract.premiumSharingToFarmer) / 100;
    farmerIncome += cut;
    enterpriseProfit -= cut;
    politicalScore += Math.min(25, contract.premiumSharingToFarmer * 0.3);
  }

  if (contract.collectiveServiceFee > 0) {
    enterpriseProfit -= (baseProfit * contract.collectiveServiceFee) / 100;
  }

  if (contract.propertyRightsToVillage) {
    enterpriseProfit -= baseProfit * 0.05; // 确权让渡的长期产权收益
    politicalScore += 25; // 联农带农标杆
  }

  return {
    farmerIncome: Math.round(farmerIncome * 10) / 10,
    enterpriseProfit: Math.max(0, Math.round(enterpriseProfit * 10) / 10),
    politicalScore: Math.min(100, Math.round(politicalScore)),
  };
}

// ============================================================
// 4. 物理漏损与数字化惩罚 —— applyPhysicalLoss
// 实际产出 = 基础产出 × (1 − 漏损率)，漏损率封顶 30%。
// 冷库空置率高 → 漏损；APP 上线但使用率 <20% → 无效投资反噬效率；
// APP 真正用起来（≥60%）才有数字化红利。
// ============================================================

const LOSS_CAP = 0.3; // 最高扣除 30%
const COLD_CHAIN_IDLE_THRESHOLD = 0.35;
const APP_IDLE_THRESHOLD = 0.2;
const APP_DIGITAL_DIVIDEND_THRESHOLD = 0.6;

export function applyPhysicalLoss(baseOutput: number, infra: PhysicalInfrastructure): number {
  let lossRate = 0;

  if (infra.coldChainCapacity > 0 && infra.coldChainIdleRate > COLD_CHAIN_IDLE_THRESHOLD) {
    lossRate += infra.coldChainIdleRate * 0.5; // 空置越狠，冷链变「暖链」，烂在路上
  }

  if (infra.hasSmartAgriApp) {
    if (infra.appAdoptionRate < APP_IDLE_THRESHOLD) {
      lossRate += 0.15; // 智慧农业 APP 没人用：投资打水漂，还搅乱生产节奏
    } else if (infra.appAdoptionRate >= APP_DIGITAL_DIVIDEND_THRESHOLD) {
      lossRate -= 0.05; // 数字化真正落地才有红利（负漏损=效率增益）
    }
  }

  lossRate = Math.min(LOSS_CAP, lossRate);
  return Math.round(baseOutput * (1 - lossRate) * 10) / 10;
}
