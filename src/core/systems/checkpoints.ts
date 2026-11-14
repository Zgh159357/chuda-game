import type { CheckpointId, GameState, Round } from '../types';
import type { TurnCtx } from './context';
import { techSum } from './techTree';

// ============================================================
// 大考节点评估：责任书考核 / 中期评估 / 攻坚督查 / 摘帽验收 / 撤队评估
// 退坡三波在 subsidy 系统处理。
// §9：机制树「考核加成」直接抬大考成绩；考核连胜计数进 streaks.rank。
// ============================================================

/** 全县户群建档覆盖率 */
function coverage(state: GameState): number {
  const all = state.villages.flatMap((v) => v.households);
  if (all.length === 0) return 0;
  return all.filter((h) => h.registered).length / all.length;
}

function avgDualBind(state: GameState): number {
  if (state.villages.length === 0) return 0;
  return state.villages.reduce((s, v) => s + v.dualBindStability, 0) / state.villages.length;
}

function avgInfo(state: GameState): number {
  return state.county.infoAccuracy;
}

export function evaluateCheckpoints(state: GameState, ctx: TurnCtx): void {
  const c = state.county;
  const round = ctx.round as Round;

  const ids: CheckpointId[] = [];
  switch (round) {
    case 4:
      ids.push('r4_commitmentReview');
      break;
    case 12:
      ids.push('r12_midterm');
      break;
    case 20:
      ids.push('r20_supervision');
      break;
    case 32:
      ids.push('r32_acceptance');
      break;
    case 41:
      ids.push('r41_withdrawal');
      break;
    case 50:
      ids.push('r50_final');
      break;
    default:
      break;
  }
  if (ids.length === 0) return;

  // §9 机制树：考核成绩加成（台账美化/数字脱贫等）
  const checkpointBonus = techSum(state, 'checkpointBonus');

  for (const id of ids) {
    let passed = false;
    let pressureDelta = 0;
    let pcDelta = 0;
    let report = '';

    switch (id) {
      case 'r4_commitmentReview': {
        // 首次责任书考核：承诺档位 ↔ 实际进度
        const progress = avgInfo(state) * 0.5 + coverage(state) * 50 + checkpointBonus;
        const bar = c.commitment === 'overachieve' ? 55 : c.commitment === 'standard' ? 40 : 30;
        passed = progress >= bar;
        report = passed ? 'report_r4_pass' : 'report_r4_fail';
        if (!passed && c.commitment === 'overachieve') {
          // 争先承诺未达标 → 约谈（负成就由 rewards 判定）
          pressureDelta = 15;
          pcDelta = -8;
        } else if (!passed) {
          pressureDelta = 8;
          pcDelta = -3;
        } else {
          pcDelta = 3;
          pressureDelta = -5;
        }
        break;
      }
      case 'r12_midterm': {
        passed = coverage(state) >= 0.6;
        report = passed ? 'report_r12_pass' : 'report_r12_fail';
        if (!passed) {
          pressureDelta = 8;
          pcDelta = -6;
        } else {
          pcDelta = 3;
        }
        break;
      }
      case 'r20_supervision': {
        passed = avgDualBind(state) >= 30;
        report = passed ? 'report_r20_pass' : 'report_r20_fail';
        if (!passed) {
          pressureDelta = 10;
          pcDelta = -6;
        } else {
          pcDelta = 3;
        }
        break;
      }
      case 'r32_acceptance': {
        // 摘帽验收：精度、覆盖、双绑、做证明概率（机制树考核加成直接抬分）
        const fakeProb = c.backlash.fakeProb;
        const baseOk = avgInfo(state) + checkpointBonus >= 70 && coverage(state) >= 0.9 && avgDualBind(state) >= 40;
        passed = baseOk && fakeProb < 30;
        report = passed ? 'report_r32_pass' : 'report_r32_fail';
        if (!passed) {
          pressureDelta = 15;
          pcDelta = -10;
          // 数据对不上：做证明行为反噬
          c.formality += 10;
        } else {
          pcDelta = 10;
          pressureDelta = -8;
          // 陷阱：提前摘帽（实际为快速摘帽的债）
          if (avgInfo(state) < 80) {
            state.trapRewards.push({ rewardId: 'trap_fast_acceptance', round, cost: 0 });
          }
        }
        break;
      }
      case 'r41_withdrawal': {
        passed = c.canHoldIndex >= 45;
        report = passed ? 'report_r41_withdraw_pass' : 'report_r41_withdraw_fail';
        if (!passed) {
          pressureDelta = 10;
          pcDelta = -5;
        } else {
          pcDelta = 5;
          ctx.noteCombo('endogenous');
        }
        break;
      }
      default:
        break;
    }

    c.pressure = Math.max(0, c.pressure + pressureDelta);
    c.politicalCapital = Math.max(0, Math.min(100, c.politicalCapital + pcDelta));
    ctx.pushCheckpoint({ id, passed, pressureDelta, politicalCapitalDelta: pcDelta, report });
    ctx.pushEvent({ type: 'checkpoint', round, checkpointId: id });
    // §9 因果律：考核连胜/连败计数（国家级农业园竞标条件用）
    state.streaks.rank = passed ? state.streaks.rank + 1 : 0;
    if (passed) {
      ctx.addStars(10);
      ctx.pushLedger('achievement', `checkpoint_${id}`, 5, '大考通过');
    } else {
      ctx.addStars(-10);
      ctx.pushLedger('cost', `checkpoint_${id}`, -8, '大考未通过');
    }
  }
}
