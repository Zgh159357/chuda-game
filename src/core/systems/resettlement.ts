import type { GameState } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { heroSum } from './heroes';

// ============================================================
// 系统：搬迁治理重建（搬 + 建）
// 治理密度 vs 生计自立度；大安置点组织成本指数上升。
// ============================================================

export function settleResettlement(state: GameState, ctx: TurnCtx): void {
  for (const site of state.sites) {
    if (site.population === 0) continue;

    // 生计自立度：由迁入人口与周边产业决定
    const workshop = state.projects.find((p) => p.id === 'p_xinping_workshop');
    const hasWorkshop = workshop && (workshop.status === 'active' || workshop.status === 'recovered');
    const baseline = Math.min(60, site.population / 40);
    const drift = hasWorkshop ? 2 : -2; // 没有生计载体 → 空心化
    site.livelihoodSelfReliance = Math.max(0, Math.min(100, site.livelihoodSelfReliance + drift + (baseline - site.livelihoodSelfReliance) * 0.2));

    // 治理密度：随县级组织密度传导，但搬迁本身重建成本高
    const govDrift = (state.county.orgDensity * 0.3 - site.governanceDensity) * 0.3;
    site.governanceDensity = Math.max(0, Math.min(100, site.governanceDensity + govDrift));

    // 组织层数与服务成本（>2000 人指数上升）
    if (site.population > 2000) {
      site.orgLayers = Math.min(5, site.orgLayers + 0.1);
      site.serviceCost += site.population / 500;
      ctx.pushLedger('org', 'bigSiteCost', -Math.round(site.serviceCost), `${site.name} 治理重建成本`);
    } else if (site.population > 500) {
      site.serviceCost += 1;
    }

    // 空心化：生计立不住 → 迁出户返贫风险上升
    if (site.livelihoodSelfReliance < 25 && site.population > 0) {
      ctx.pushEvent({ type: 'fuzzySignal', round: ctx.round, textId: 'signal_return_2', riskKind: 'return', investigated: false });
      // 影响原村（迁出户回流风险）
      for (const v of state.villages) {
        v.returnRisk = Math.min(100, v.returnRisk + 1.5);
      }
    }

    // 社区融入（主控提示词第七节）：凝聚力自然流失，配套设施托底
    // §9 人才：周瓦匠/唐木匠带大家搭棚架屋，凝聚力回升
    const coh = config.balance.cohesion;
    const cohesionBoost = state.heroes
      .filter((h) => h.villageId === site.id)
      .reduce((s, h) => {
        const spec = config.heroes.find((x) => x.id === h.heroId);
        return s + (spec?.talentKind === 'cohesionBoost' ? spec.talentValue : 0);
      }, 0);
    site.communityCohesion = Math.max(
      0,
      Math.min(100, site.communityCohesion - coh.drift + site.facilities.length * coh.perFacility + cohesionBoost),
    );
    if (site.communityCohesion < coh.crisisThreshold) {
      ctx.pushEvent({ type: 'cohesionCrisis', round: ctx.round, textId: 'cohesion_crisis' });
      state.county.trust = Math.max(0, state.county.trust - 5);
      for (const v of state.villages) v.returnRisk = Math.min(100, v.returnRisk + 8);
      ctx.pushLedger('cost', 'cohesion_crisis', -6, `${site.name} 返贫危机`);
    } else if (site.communityCohesion < coh.riotThreshold) {
      ctx.pushEvent({ type: 'cohesionRiot', round: ctx.round, textId: 'cohesion_riot' });
      state.county.trust = Math.max(0, state.county.trust - 3);
      for (const v of state.villages) v.returnRisk = Math.min(100, v.returnRisk + 5);
      ctx.pushLedger('cost', 'cohesion_riot', -4, `${site.name} 聚众闹事`);
    }

    // 小杨故事线：安置点站稳 → 自立
    if (site.households.includes('hh_wuling_yang')) {
      if (site.livelihoodSelfReliance >= 40) {
        ctx.pushLedger('transition', 'site_livelihood', 4, `${site.name} 生计起步`);
      }
    }
  }
}
