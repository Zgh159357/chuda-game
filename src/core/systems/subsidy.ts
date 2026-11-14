import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';

// ============================================================
// 系统：补贴退坡三波（r35 / r38 / r41，每波 −20）
// 造血成色：退坡后高依赖项目衰减、断崖。
// ============================================================

export function settleSubsidy(state: GameState, ctx: TurnCtx): void {
  const wave = config.balance.subsidyWaves.find((w) => w.round === ctx.round);
  if (!wave) return;

  ctx.pushCheckpoint({
    id: (`r${ctx.round}_subsidy` as never),
    passed: true,
    pressureDelta: 0,
    politicalCapitalDelta: 0,
    report: `report_r${ctx.round}`,
  });

  for (const v of state.villages) {
    v.subsidyDependence = Math.max(0, v.subsidyDependence - wave.cut);
  }
  for (const p of state.projects) {
    p.subsidyDependence = Math.max(0, p.subsidyDependence - wave.cut);
  }

  // 断崖：退坡后仍高依赖的项目 → 直接烂尾
  for (const p of state.projects) {
    if (p.status === 'active' && p.subsidyDependence > 60) {
      p.status = 'broken';
      p.failureRound = ctx.round;
      state.projectFailures.push({ projectId: p.id, round: ctx.round });
      ctx.pushEvent({ type: 'projectFailure', round: ctx.round, projectId: p.id });
      ctx.pushLedger('cost', `taperBreak_${p.id}`, -12, `${p.name} 退坡断崖`);
    }
  }

  // 平稳退坡成就条件：全县平均依赖 < 30
  const avgDep = state.villages.length === 0
    ? 0
    : state.villages.reduce((s, v) => s + v.subsidyDependence, 0) / state.villages.length;
  if (avgDep < 30) {
    ctx.noteCombo('decay');
    ctx.addStars(10);
  } else {
    ctx.pushLedger('cost', 'taperRough', -8, '退坡阵痛');
  }
}
