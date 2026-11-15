import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { serialize, deserialize } from '../src/core/save';
import {
  detectVillageSynergies,
  drawCatalyst,
} from '../src/core/sandbox/industryEngine';
import {
  synergyMulOf,
  hasSynergy,
  settleVillageSynergies,
} from '../src/core/systems/synergy';
import { createTurnCtx } from '../src/core/systems/context';
import { seedRng, roundRng } from '../src/core/rng';
import { conditionsMet } from '../src/core/sandbox/eventPool';
import { dynamicEvents } from '../src/config/dynamicEvents';
import { synergyRecipes, synergyCatalysts } from '../src/config/industry';
import { playRound } from '../src/core/reducer';
import type { GameState, SynergyCatalyst } from '../src/core/types';

function seeded(): GameState {
  return createInitialState(1, 'returningStudent');
}

describe('§14 涌现式融合（第二批）', () => {
  it('detectVillageSynergies：云溪富硒水稻田 + 冷链渠道 → 特色农业命中', () => {
    const state = seeded();
    // 把县级电商服务站挪到云溪并投产（logistics+service 标签）
    const ecom = state.projects.find((p) => p.id === 'p_county_ecom')!;
    ecom.villageId = 'v_yunxi';
    ecom.status = 'active';
    const hits = detectVillageSynergies(state, 'v_yunxi');
    expect(hits.map((h) => h.id)).toContain('recipe_se_agri');
  });

  it('detectVillageSynergies：产业标签不齐不命中', () => {
    const state = seeded();
    // 云溪只有 herb（primary_agri），缺 logistics → 特色农业不命中
    const hits = detectVillageSynergies(state, 'v_yunxi');
    expect(hits.map((h) => h.id)).not.toContain('recipe_se_agri');
  });

  it('settleVillageSynergies：新配方→头衔+事件+星+账', () => {
    const state = seeded();
    const ecom = state.projects.find((p) => p.id === 'p_county_ecom')!;
    ecom.villageId = 'v_yunxi';
    ecom.status = 'active';
    const ctx = createTurnCtx(state, seedRng(7), 3);
    settleVillageSynergies(state, ctx, null);
    const v = state.villages.find((x) => x.id === 'v_yunxi')!;
    expect(v.synergyTitles).toContain('recipe_se_agri');
    expect(ctx.events.some((e) => e.type === 'synergyUnlocked')).toBe(true);
    expect(ctx.starScore).toBe(12);
    expect(synergyMulOf(state, 'v_yunxi')).toBe(2.0);
    expect(hasSynergy(state, 'v_yunxi', 'recipe_se_agri')).toBe(true);
  });

  it('settleVillageSynergies：已解锁配方不重复记账', () => {
    const state = seeded();
    const ecom = state.projects.find((p) => p.id === 'p_county_ecom')!;
    ecom.villageId = 'v_yunxi';
    ecom.status = 'active';
    const v = state.villages.find((x) => x.id === 'v_yunxi')!;
    v.synergyTitles.push('recipe_se_agri');
    const ctx = createTurnCtx(state, seedRng(7), 3);
    settleVillageSynergies(state, ctx, null);
    expect(ctx.events.filter((e) => e.type === 'synergyUnlocked').length).toBe(0);
    expect(ctx.starScore).toBe(0);
  });

  it('conditionsMet：requiredSynergyTitle 命中（村头衔直查）', () => {
    const state = seeded();
    const ev = dynamicEvents.find((e) => e.id === 'ev_influencer_visit')!;
    expect(conditionsMet(state, ev).ok).toBe(false);
    const v = state.villages.find((x) => x.id === 'v_wuling')!;
    v.synergyTitles.push('recipe_agri_tourism');
    const res = conditionsMet(state, ev);
    expect(res.ok).toBe(true);
    expect(res.villageId).toBe('v_wuling');
  });

  it('conditionsMet：无头衔不满足', () => {
    const state = seeded();
    const ev = dynamicEvents.find((e) => e.id === 'ev_garbage_crisis')!;
    expect(conditionsMet(state, ev).ok).toBe(false);
  });

  it('存档 v12 往返：synergyTitles 存活', () => {
    const state = seeded();
    const v = state.villages.find((x) => x.id === 'v_qingshi')!;
    v.synergyTitles.push('recipe_pv_agri');
    const back = deserialize(serialize(state));
    expect(back.version).toBe(13);
    const bv = back.villages.find((x) => x.id === 'v_qingshi')!;
    expect(bv.synergyTitles).toContain('recipe_pv_agri');
  });
});

describe('§15 创造性增强（进化链/商机/人才联动/反面配方/自建设施）', () => {
  const cat = (id: string): SynergyCatalyst => synergyCatalysts.find((c) => c.id === id)!;

  it('tier2 进化链：未获前置头衔时 se_chain 不中，解锁 se_agri 后命中', () => {
    const state = seeded();
    const ecom = state.projects.find((p) => p.id === 'p_county_ecom')!;
    ecom.villageId = 'v_yunxi';
    ecom.status = 'active';
    state.builtNodes.push({ id: 'n_factory_v_yunxi', nodeId: 'node_factory', villageId: 'v_yunxi', builtRound: 3 });
    const v = state.villages.find((x) => x.id === 'v_yunxi')!;
    let hits = detectVillageSynergies(state, 'v_yunxi');
    expect(hits.map((h) => h.id)).toContain('recipe_se_agri');
    expect(hits.map((h) => h.id)).not.toContain('recipe_se_chain');
    v.synergyTitles.push('recipe_se_agri');
    hits = detectVillageSynergies(state, 'v_yunxi');
    expect(hits.map((h) => h.id)).toContain('recipe_se_chain');
  });

  it('商机催化：富硒春茶在 cat_spring 下命中、无商机不中', () => {
    const state = seeded();
    const hits0 = detectVillageSynergies(state, 'v_yunxi', null);
    expect(hits0.map((h) => h.id)).not.toContain('recipe_selenium_tea');
    const hits1 = detectVillageSynergies(state, 'v_yunxi', cat('cat_spring'));
    expect(hits1.map((h) => h.id)).toContain('recipe_selenium_tea');
  });

  it('人才联动：直播助农需 hero_returner 驻雾岭 + cat_fair', () => {
    const state = seeded();
    state.builtNodes.push(
      { id: 'n_guest_v_wuling', nodeId: 'node_guesthouse', villageId: 'v_wuling', builtRound: 2 },
      { id: 'n_cold_v_wuling', nodeId: 'node_coldchain', villageId: 'v_wuling', builtRound: 2 },
    );
    const noHero = detectVillageSynergies(state, 'v_wuling', cat('cat_fair'));
    expect(noHero.map((h) => h.id)).not.toContain('recipe_live_shop');
    state.heroes.push({ heroId: 'hero_returner', villageId: 'v_wuling', recruitRound: 2 });
    const withHero = detectVillageSynergies(state, 'v_wuling', cat('cat_fair'));
    expect(withHero.map((h) => h.id)).toContain('recipe_live_shop');
  });

  it('反面配方：石漠化大棚命中且被拖低产出', () => {
    const state = seeded();
    const chicken = state.projects.find((p) => p.id === 'p_wuling_chicken')!;
    chicken.villageId = 'v_qingshi';
    chicken.status = 'active';
    const v = state.villages.find((x) => x.id === 'v_qingshi')!;
    const ctx = createTurnCtx(state, seedRng(9), 4);
    settleVillageSynergies(state, ctx, null);
    expect(v.synergyTitles).toContain('recipe_desert_greenhouse');
    expect(synergyMulOf(state, 'v_qingshi')).toBeLessThan(1);
    expect(ctx.starScore).toBe(-8);
  });

  it('反面配方：没路的民宿被 forbiddenIndustryTags 否决', () => {
    const state = seeded();
    state.builtNodes.push({ id: 'n_guest_v_wuling', nodeId: 'node_guesthouse', villageId: 'v_wuling', builtRound: 2 });
    const hits = detectVillageSynergies(state, 'v_wuling', null);
    expect(hits.map((h) => h.id)).toContain('recipe_guesthouse_isolated');
    state.builtNodes.push({ id: 'n_cold_v_wuling', nodeId: 'node_coldchain', villageId: 'v_wuling', builtRound: 2 });
    const blocked = detectVillageSynergies(state, 'v_wuling', null);
    expect(blocked.map((h) => h.id)).not.toContain('recipe_guesthouse_isolated');
  });

  it('drawCatalyst：同 seed 同结果，与 roundRng(seed,round) 路径一致', () => {
    const a = drawCatalyst(roundRng(42, 1));
    const b = drawCatalyst(roundRng(42, 1));
    expect(a?.id).toBe(b?.id);
    expect(typeof a === 'object' || a === null).toBe(true);
  });

  it('持续效果：持有 se_chain 的村每回合补贴依赖 −3', () => {
    const state = seeded();
    const v = state.villages.find((x) => x.id === 'v_yunxi')!;
    v.synergyTitles.push('recipe_se_chain');
    v.subsidyDependence = 50;
    const ctx = createTurnCtx(state, seedRng(5), 6);
    settleVillageSynergies(state, ctx, null);
    expect(v.subsidyDependence).toBe(47);
  });

  it('buildNodes 管线：已摸排村扣财政落设施、未摸排跳过', () => {
    const s0 = seeded();
    const yunxi = s0.villages.find((x) => x.id === 'v_yunxi')!;
    yunxi.surveyed = true;
    const fiscal0 = s0.county.fiscalFund;
    const out = playRound(s0, { buildNodes: [{ nodeId: 'node_factory', villageId: 'v_yunxi' }] });
    expect(out.state.builtNodes.some((b) => b.nodeId === 'node_factory' && b.villageId === 'v_yunxi')).toBe(true);
    // 本回合收入 +25 后再扣 16 建厂成本，净额必然低于「只收不花」
    expect(out.state.county.fiscalFund).toBeLessThan(fiscal0 + 25);
    const out2 = playRound(s0, { buildNodes: [{ nodeId: 'node_pv', villageId: 'v_qingshi' }] });
    expect(out2.state.builtNodes.some((b) => b.villageId === 'v_qingshi')).toBe(false);
  });

  it('存档 v13 往返：builtNodes 存活', () => {
    const state = seeded();
    state.builtNodes.push({ id: 'n_pv_v_qingshi', nodeId: 'node_pv', villageId: 'v_qingshi', builtRound: 4 });
    const back = deserialize(serialize(state));
    expect(back.version).toBe(13);
    expect(back.builtNodes.some((b) => b.id === 'n_pv_v_qingshi')).toBe(true);
  });

  it('配置自洽：14 配方、4 商机、tier2 均有 requiredTitles', () => {
    expect(synergyRecipes.length).toBe(14);
    expect(synergyCatalysts.length).toBe(4);
    for (const r of synergyRecipes.filter((x) => (x.tier ?? 1) >= 2)) {
      expect(r.requiredTitles?.length).toBeGreaterThan(0);
    }
  });
});
