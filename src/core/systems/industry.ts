import type { GameState } from '../types';
import { config } from '../../config';
import { skillSum } from '../skills';
import { techSum, techPenaltySum } from './techTree';
import { wonderSum } from './wonders';
import { heroSum, flawSum } from './heroes';
import { shieldDamage } from './governance';
import type { TurnCtx } from './context';

// ============================================================
// 系统：产业（合作社四载体 / 双绑稳定度 / 项目效果 / 烂尾循环）
// 项目效果 = 基础 × 信息精度系数 × 群众参与 × 边际递减 × 标签匹配 − 风险惩罚
// ============================================================

const coopQuality: Record<string, number> = {
  ablePerson: 60, // 能人领办：个人能力强，稳定性看个人
  partyBranch: 55, // 支部领办：组织稳，市场弱
  enterprise: 55, // 企业领办：市场强，农户粘性弱
  retail: 45, // 散户抱团：门槛低，易散伙
};

export function settleIndustry(state: GameState, ctx: TurnCtx): void {
  const f = config.formulas;
  // G3 项目运营线技能 + §8 机制树（冷链物流）/ 奇观（现代农科园）
  const projectMul = (1 + skillSum(state, 'projectMul')) * (1 + techSum(state, 'projectEffectBonus'));
  const stallThreshold = 75 + skillSum(state, 'stallThreshold');
  const channelGrowth = skillSum(state, 'channelGrowth') + techSum(state, 'channelGrowthBonus');
  const wonderIndustry = wonderSum(state, 'industryPerRound');

  // 极值节点「全产业链闭环」的天灾判定：一旦触发，全县项目全盘停滞
  if (techPenaltySum(state, 'industryFragile') > 0 && ctx.rng() < config.balance.industryDisasterChance) {
    for (const p of state.projects) {
      if (p.status === 'active') {
        p.status = 'stalled';
        p.failureRound = ctx.round;
      }
    }
    state.projectFailures.push({ projectId: 'industryDisaster', round: ctx.round });
    ctx.pushEvent({ type: 'industryDisaster', round: ctx.round, textId: 'industry_disaster_text' });
    ctx.pushLedger('cost', 'industry_disaster', -12, '全产业链遇灾，项目全盘停滞');
    ctx.addStars(-15);
    // §11 灾情冲击优先扣村治理护盾，穿透部分才扣内生治理
    for (const v of state.villages) {
      if (v.projects.some((pid) => state.projects.find((p) => p.id === pid)?.status === 'stalled')) {
        const real = shieldDamage(state, v.id, 2, ctx);
        v.internalGovernance = Math.max(0, v.internalGovernance - real);
      }
    }
  }

  for (const v of state.villages) {
    // 奇观「现代农科园」：每村产业基础每回合稳步增强
    if (wonderIndustry > 0) v.industryBase = Math.min(100, v.industryBase + wonderIndustry);
    // 毒点「noTech」：该村科技型项目加成减半
    const noTech = flawSum(state, v.id, 'noTech') > 0 ? 0.5 : 1;
    // 奇观「现代农科园」：每村产业基础每回合稳步增强
    if (wonderIndustry > 0) v.industryBase = Math.min(100, v.industryBase + wonderIndustry);
    // ----- 双绑稳定度 -----
    const enterpriseComponent = Math.min(100, v.industryChannel) * (v.coopType === 'enterprise' ? 1 : 0.6);
    const coopComponent = v.coopType ? coopQuality[v.coopType] : 20;
    const farmerComponent = v.participation;
    const partyComponent = v.coopType === 'partyBranch' ? 70 : v.internalGovernance * 0.5;
    v.dualBindStability = Math.max(
      0,
      Math.min(
        100,
        enterpriseComponent * f.dualBind.enterprise +
          coopComponent * f.dualBind.coop +
          farmerComponent * f.dualBind.farmer +
          partyComponent * f.dualBind.party -
          v.subsidyDependence * f.dualBind.subsidy
      )
    );

    // ----- 项目效果 -----
    let roundOutput = 0;
    for (const pid of v.projects) {
      const p = state.projects.find((x) => x.id === pid);
      if (!p) continue;
      if (p.status === 'broken') continue;
      if (p.status === 'stalled') {
        // 停摆的项目：风险累积
        v.returnRisk = Math.min(100, v.returnRisk + 1);
        continue;
      }
      p.roundsActive += 1;
      const infoFactor = 1 + ((v.infoAccuracy - 50) / 10) * f.projectEffect.infoFactorPer10; // 0.6~1.4
      const participationFactor = 0.5 + v.participation / 200; // 0.5~1.0
      const diminishing = 1 / (1 + f.projectEffect.diminishing * (p.roundsActive / 10));
      const matchFactor = 1; // 项目已匹配载体；错配在行动层折算
      const riskPenalty = (v.returnRisk / 10) * f.projectEffect.riskPenaltyPer10;
      let effect =
        p.effectBase * infoFactor * participationFactor * diminishing * matchFactor - riskPenalty;
      effect *= projectMul; // 项目运营技能 + 机制树：项目效果加成
      effect *= (1 + heroSum(state, v.id, 'agriYield')) * noTech; // 人才 + 毒点（拒现代农业）
      effect *= v.industryOutputMul ?? 1; // §10 传帮带当回合：产业产出 ×0.7
      if (p.status === 'recovered') effect *= 0.8; // 修复后打折起步
      effect = Math.max(0, effect);

      // 项目效果反哺：产业基础 + 渠道 + 链条
      v.industryBase = Math.min(100, v.industryBase + effect * 0.8);
      v.industryChannel = Math.min(100, v.industryChannel + effect * 0.2);
      v.industryChain = Math.min(100, v.industryChain + effect * 0.3);
      // 补贴型项目：依赖度随投资继续上升
      if (p.subsidyDependence > 30) {
        p.subsidyDependence = Math.min(100, p.subsidyDependence + 1);
        v.subsidyDependence = Math.min(100, v.subsidyDependence + 0.5);
      }
      // 项目效果降低返贫风险
      v.returnRisk = Math.max(0, v.returnRisk - effect * 1.5);

      roundOutput += effect;
      ctx.pushLedger('achievement', `project_${p.id}`, Math.round(effect), `${p.name} 产出`);
    }

    // 项目运营技能：运营中的项目渠道稳步增强
    if (channelGrowth > 0 && v.projects.some((pid) => {
      const p = state.projects.find((x) => x.id === pid);
      return p && (p.status === 'active' || p.status === 'recovered');
    })) {
      v.industryChannel = Math.min(100, v.industryChannel + channelGrowth);
    }

    // 烂尾触发：高补贴依赖 + 高返贫风险 → 项目停摆
    for (const pid of v.projects) {
      const p = state.projects.find((x) => x.id === pid);
      if (!p) continue;
      if (p.status === 'active' && p.subsidyDependence > stallThreshold && p.invested > 10) {
        p.status = 'stalled';
        p.failureRound = ctx.round;
        state.projectFailures.push({ projectId: p.id, round: ctx.round });
        ctx.pushEvent({ type: 'projectFailure', round: ctx.round, projectId: p.id });
        ctx.pushLedger('cost', `projectStall_${p.id}`, -10, `${p.name} 烂尾`);
        ctx.addStars(-15);
        // §11 项目烂尾冲击优先扣村治理护盾
        const real = shieldDamage(state, v.id, 1, ctx);
        v.internalGovernance = Math.max(0, v.internalGovernance - real);
      }
    }

    if (roundOutput > 0) {
      ctx.noteCombo('solid');
    }
  }
}
