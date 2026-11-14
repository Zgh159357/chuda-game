import type { GameState } from '../types';
import { config } from '../../config';
import { techSum, techPenaltySum } from './techTree';
import { wonderSum } from './wonders';
import { heroSumAll, flawSumAll } from './heroes';
import type { TurnCtx } from './context';

// ============================================================
// 系统：传导与状态更新
// 信任变化 = 实际改善×透明度 − 形式主义×0.5 − 强制退出惩罚
// 压力传导：下层压力×1.1；信息精度×0.95
// §9：机制树/奇观/人才的回合性漂移在这里结算
// ============================================================

export function settleTransmission(state: GameState, ctx: TurnCtx): void {
  const c = state.county;
  const f = config.formulas;
  const radarCut = techSum(state, 'radarThreshold'); // 机制树：防返贫雷达（提前预警）
  const trustTrickle = techSum(state, 'trustTrickle'); // 机制树：结对帮扶/常态入户/爱心食堂
  const trustAll = wonderSum(state, 'trustAll'); // 奇观：县医院新院区
  const pcPerRound = wonderSum(state, 'pcPerRound'); // 奇观：形象工程（争议类）
  const ecoPerRound = techSum(state, 'ecoPerRound') + wonderSum(state, 'ecoPerRound');
  const returnRiskCutAll = techSum(state, 'returnRiskCutAll') + wonderSum(state, 'returnRiskCutAll');
  // §9 极值/禁忌的永久代价
  const debtDrift = techPenaltySum(state, 'debtDrift');
  const returnRiskDrift = techPenaltySum(state, 'returnRiskDrift');
  const ecologyDrift = techPenaltySum(state, 'ecologyDrift');
  const fiscalDrain = techPenaltySum(state, 'fiscalDrain') + flawSumAll(state, 'greedyCost');

  // ----- 实际改善（本回合产出） -----
  const improvement = ctx.ledgerDelta
    .filter((e) => e.kind === 'achievement')
    .reduce((s, e) => s + Math.max(0, e.value), 0);

  // ----- 透明度 -----
  const transparency = 0.5 + c.thirdPartyCoverage / 200 + c.directReport / 300;

  // ----- 信任变化（边际递减：越接近 100 增长越慢） -----
  const trustDelta = improvement * 0.05 * transparency - c.formality * f.trust.formalismPenalty;
  const approach = 1 - Math.pow(c.trust / 100, 2); // 100 → 0，0 → 1
  const effectiveDelta = trustDelta * Math.max(f.trust.saturationFloor, approach);
  c.trust = Math.max(0, Math.min(100, c.trust + effectiveDelta));
  if (trustDelta > 3) {
    ctx.pushFeedback('mf_thanks_letter', 'mf_thanks_letter_text');
  }

  // ----- 债务风险漂移 -----
  c.debtRisk = Math.max(0, Math.min(100, c.debtRisk - 0.5 + state.projectFailures.length * 1.5 + debtDrift));
  if (c.debtRisk > 70) {
    ctx.pushLedger('cost', 'debtRising', -4, '债务风险高企');
  }

  // ----- 生态漂移：产业扩张伤生态，生态岗位/机制/奇观修复 -----
  const ecoJobUsed = ctx.ledgerDelta.some((e) => e.key === 'measure_ecoJob');
  const industryPush = ctx.ledgerDelta
    .filter((e) => e.key.startsWith('project_'))
    .reduce((s, e) => s + e.value, 0);
  c.ecology = Math.max(0, Math.min(100, c.ecology - industryPush * 0.02 + (ecoJobUsed ? 1.5 : 0) + ecoPerRound - ecologyDrift));

  // ----- 压力传导（逐层放大 + 自然消解：只放大冲击，不成死亡螺旋） -----
  c.pressure = Math.round(c.pressure * f.pressure.perLayer);
  if (c.pressure > f.pressure.baseline) {
    c.pressure = Math.round(c.pressure - (c.pressure - f.pressure.baseline) * f.pressure.reliefRate);
  }

  // ----- 政治资本：压力过大时消耗 -----
  if (c.pressure > 50) {
    c.politicalCapital = Math.max(0, c.politicalCapital - 1);
  } else if (c.pressure < 20) {
    c.politicalCapital = Math.min(100, c.politicalCapital + 0.5);
  }

  // ----- 政治资本宽限期计时 -----
  if (c.politicalCapital < config.balance.hardFail.pcFloor) {
    state.pcLowRounds += 1;
  } else {
    state.pcLowRounds = 0;
  }

  // ----- 机制树：结对帮扶（信任细水长流）+ 奇观（医院） + 人才（socialGlue 全县） -----
  if (trustTrickle > 0 || trustAll > 0) {
    c.trust = Math.min(100, c.trust + trustTrickle + trustAll);
  }

  // ----- §9 极值/禁忌漂移：财政吸血（fiscalDrain）、政治资本（形象奇观） -----
  if (fiscalDrain > 0) {
    c.fiscalFund = Math.max(0, c.fiscalFund - fiscalDrain);
    ctx.pushLedger('cost', 'tech_drain', -Math.round(fiscalDrain), '机制/人才维护成本');
  }
  if (pcPerRound > 0) {
    c.politicalCapital = Math.min(100, c.politicalCapital + pcPerRound);
  }

  // ----- §9 全县返贫风险漂移：机制（兜底/监测）+ 奇观（安置区）− 禁忌（数字脱贫） -----
  if (returnRiskCutAll > 0 || returnRiskDrift > 0) {
    for (const v of state.villages) {
      v.returnRisk = Math.max(0, Math.min(100, v.returnRisk - returnRiskCutAll + returnRiskDrift));
    }
  }

  // ----- 返贫预警（窗口 2 回合；防返贫雷达把阈值提前） -----
  const warningFloor = Math.max(50, config.balance.hardFail.returnRiskFloor - radarCut);
  for (const v of state.villages) {
    if (v.returnRisk >= warningFloor) {
      ctx.pushEvent({ type: 'returnRiskWarning', round: ctx.round, villageId: v.id, window: 2 });
      state.missedReturnWarnings += 1;
      // 给玩家留反应空间：预警窗口内不重复计数
      v.returnRisk = warningFloor - 5;
      if (state.missedReturnWarnings >= config.balance.hardFail.returnWaveMissed) {
        ctx.fail('returnWave');
      }
    }
  }

  // ----- 形式主义负担自然累积 -----
  if (c.assessmentDensity > 60) {
    c.formality = Math.max(0, c.formality + (c.assessmentDensity - 60) * 0.1);
    c.tableBurden = Math.max(0, c.tableBurden + (c.assessmentDensity - 60) * 0.05);
  } else {
    c.formality = Math.max(0, c.formality - 2);
    c.tableBurden = Math.max(0, c.tableBurden - 1);
  }
}
