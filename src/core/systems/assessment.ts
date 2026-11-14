import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { techPenaltySum } from './techTree';
import { heroSumAll } from './heroes';

// ============================================================
// 系统：考核纠偏与反噬（一拍延迟：本回合写入 backlash，下回合生效）
// 密度>60：迎检负担 +=(密度−60)×0.8；做证明概率 +=(密度−60)×1.5；产出×0.95
// §9：禁忌节点「台账美化」→ 每回合暗访概率直接失败；人才「迎检专员」→ 迎检免疫
// ============================================================

export function settleAssessment(state: GameState, ctx: TurnCtx): void {
  const c = state.county;
  const f = config.formulas.assessment;

  // ----- 上回合写入的反噬：本回合落地 -----
  c.inspectionBurden = Math.max(0, c.backlash.inspectionBurden);

  // ----- 本回合旋钮 → 下回合反噬 -----
  const d = c.assessmentDensity;
  if (d > f.backlashThreshold) {
    const over = d - f.backlashThreshold;
    c.backlash.inspectionBurden += over * f.burdenPerPoint;
    c.backlash.fakeProb = Math.min(100, c.backlash.fakeProb + over * f.fakeProbPerPoint);
    c.backlash.outputMul = f.outputMul; // 产出打折
  } else {
    // 密度回落 → 反噬消退
    c.backlash.inspectionBurden = Math.max(0, c.backlash.inspectionBurden - 3);
    c.backlash.fakeProb = Math.max(0, c.backlash.fakeProb - 2);
    c.backlash.outputMul = 1;
  }

  // 人才「表格战神」坐镇：迎检惩罚全免（但摸排变差的毒点在 cadres.ts）
  if (heroSumAll(state, 'inspectionImmune') > 0) {
    c.inspectionBurden = 0;
    c.backlash.inspectionBurden = 0;
  }

  // ----- 第三方与群众直报：纠偏力量 -----
  if (c.thirdPartyCoverage > 0) {
    c.backlash.fakeProb = Math.max(0, c.backlash.fakeProb - c.thirdPartyCoverage / 20);
  }
  if (c.directReport > 0) {
    c.trust = Math.min(100, c.trust + c.directReport / 50);
  }

  // 产出打折：记入组织账
  if (c.backlash.outputMul < 1) {
    ctx.pushLedger('org', 'backlashOutput', -5, '考核反噬：产出打折');
  }

  // 考核拉满陷阱
  if (d >= 90) {
    state.trapRewards.push({ rewardId: 'trap_full_assessment', round: ctx.round, cost: 0 });
  }

  // ----- 禁忌节点暗访：台账美化每回合概率直接失败 -----
  if (techPenaltySum(state, 'auditRisk') > 0) {
    if (ctx.rng() < config.balance.tabooAuditChance) {
      const nodeId = config.techTree.find((t) => t.penalty?.kind === 'auditRisk' && state.techUnlocked.includes(t.id))?.id ?? 'tech_beautify_org';
      ctx.fail('bottomLineBreach');
      ctx.pushEvent({ type: 'tabooAudit', round: ctx.round, nodeId });
      ctx.pushLedger('cost', 'taboo_audit', -40, '暗访组翻出被美化的台账，底线失守');
      return;
    }
  }

  // ----- 第三方抽查：瞒报暴雷（重构） -----
  // 触发条件：第三方覆盖≥40，或 32 回合后进入常态化抽查期
  const n = state.fraudRecords.length;
  if (n > 0 && (c.thirdPartyCoverage >= 40 || ctx.round >= 32)) {
    const p = n >= 4 ? 1 : n >= 2 ? 0.6 : 0.2;
    if (ctx.rng() < p) {
      ctx.fail('bottomLineBreach');
      ctx.pushEvent({ type: 'fraudCaught', round: ctx.round, textId: 'fraud_caught_text' });
      ctx.pushLedger('cost', 'fraud_audit', -40, '第三方抽查翻出瞒报旧账，底线失守');
    }
  }
}
