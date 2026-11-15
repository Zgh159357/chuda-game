import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { serialize, deserialize } from '../src/core/save';
import { detectVillageSynergies } from '../src/core/sandbox/industryEngine';
import {
  synergyMulOf,
  hasSynergy,
  settleVillageSynergies,
} from '../src/core/systems/synergy';
import { createTurnCtx } from '../src/core/systems/context';
import { seedRng } from '../src/core/rng';
import { conditionsMet } from '../src/core/sandbox/eventPool';
import { dynamicEvents } from '../src/config/dynamicEvents';
import type { GameState } from '../src/core/types';

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
    settleVillageSynergies(state, ctx);
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
    settleVillageSynergies(state, ctx);
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
    expect(back.version).toBe(12);
    const bv = back.villages.find((x) => x.id === 'v_qingshi')!;
    expect(bv.synergyTitles).toContain('recipe_pv_agri');
  });
});
