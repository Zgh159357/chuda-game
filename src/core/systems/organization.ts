import type { GameState, RoundActions } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { orgDensityCurve } from '../state/phaseMachine';
import { skillSum } from '../skills';
import { wonderSum } from './wonders';
import { settleEmbedding, applyOrgDamage } from './resilience';

// ============================================================
// 系统：组织（政治责任链 / 驻村四捆绑 / 组织密度 / 接得住指数 / 组织成本）
// §10：驻村挤出改为「传帮带二选一」；成本超支先扣组织韧性。
// ============================================================

export function settleOrganization(state: GameState, actions: RoundActions, ctx: TurnCtx): void {
  const c = state.county;

  // ----- 组织密度曲线 -----
  const prevDensity = c.orgDensity;
  c.orgDensity = orgDensityCurve(ctx.round, c.phase, prevDensity);
  // 组织密度变化也牵动会议负担：密度越高，协调会议越多
  c.meetingBurden = Math.max(0, Math.round(c.orgDensity * 0.08));

  // ----- 驻村四捆绑：外部嵌入与内生治理（§10 传帮带新公式） -----
  const mentorship = actions.mentorship ?? [];
  for (const v of state.villages) {
    const govBefore = v.internalGovernance;
    v.industryOutputMul = 1; // 每回合复位（传帮带村由 settleEmbedding 置 0.7）
    if (v.dispatchedUnitId) {
      const u = state.units.find((x) => x.id === v.dispatchedUnitId);
      if (u) {
        v.externalEmbed = Math.min(100, v.externalEmbed + 2);
        u.politicalCredit = Math.min(100, u.politicalCredit + 1);
        // 挤出效应：未指派传帮带 −2（先扣韧性）；指派 +1 且产业产出 ×0.7
        settleEmbedding(state, v.id, mentorship, ctx);
      }
    } else {
      v.externalEmbed = Math.max(0, v.externalEmbed - 1);
      v.internalGovernance = Math.min(100, v.internalGovernance + 0.8);
    }
    // §9 因果律：内生治理停滞计数（沈书记招募条件：某村停滞 3 回合）
    const growth = v.internalGovernance - govBefore;
    if (growth < 0.5) {
      state.streaks.villageStall[v.id] = (state.streaks.villageStall[v.id] ?? 0) + 1;
    } else {
      state.streaks.villageStall[v.id] = 0;
    }
  }

  // ----- 接得住指数（每村） -----
  const ch = config.formulas.canHold;
  for (const v of state.villages) {
    v.canHoldIndex = Math.max(
      0,
      Math.min(
        100,
        v.internalGovernance * ch.governance +
          v.industryBase * ch.industry +
          v.collectiveEconomy * ch.collective +
          v.participation * ch.participation -
          v.subsidyDependence * ch.subsidy
      )
    );
  }
  const n = state.villages.length;
  c.canHoldIndex = n === 0 ? 0 : Math.round(state.villages.reduce((s, v) => s + v.canHoldIndex, 0) / n);

  // ----- 接不住事件（<40 触发） -----
  for (const v of state.villages) {
    if (v.canHoldIndex < ch.threshold && ctx.round >= 5) {
      ctx.pushEvent({ type: 'canHoldEvent', round: ctx.round, villageId: v.id });
      ctx.pushLedger('transition', 'canHoldLow', -4, `${v.name} 接不住预警`);
      // 接不住 → 返贫风险上升
      v.returnRisk = Math.min(100, v.returnRisk + 2);
    }
  }

  // ----- 组织成本比率 -----
  const output = Math.max(
    1,
    ctx.ledgerDelta.filter((e) => e.kind === 'achievement').reduce((s, e) => s + Math.max(0, e.value), 0)
  );
  const tableCut = Math.min(1, skillSum(state, 'tableCut')); // 组织建设线：台账减负
  const orgCostCut = Math.min(1, skillSum(state, 'orgCostCut')); // 组织建设线：比率降低
  const burden =
    c.adminBurden + c.inspectionBurden + c.meetingBurden + c.tableBurden * (1 - tableCut) + ctx.ledgerDelta
      .filter((e) => e.kind === 'org')
      .reduce((s, e) => s + Math.max(0, -e.value), 0);
  c.orgCostRatio = Math.round(((burden / output) * (1 - orgCostCut)) * 100) / 100;
  // 奇观「跨山大桥」：全县路网贯通，组织成本比率 −0.1
  if (wonderSum(state, 'bridgeAllRoads') > 0) {
    c.orgCostRatio = Math.max(0, Math.round((c.orgCostRatio - 0.1) * 100) / 100);
  }
  if (c.orgCostRatio > 2) {
    ctx.pushLedger('org', 'orgCostHeavy', -Math.round(c.orgCostRatio * 2), '组织成本比率过高');
    // §10 成本超支：组织度伤害先扣组织韧性，韧性归零才真扣组织密度
    const { real } = applyOrgDamage(state, 2, ctx);
    c.orgDensity = Math.max(0, c.orgDensity - real);
  }
  if (c.formality > c.formalityPeak) c.formalityPeak = c.formality;
}
