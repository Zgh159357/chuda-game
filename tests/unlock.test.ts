// ============================================================
// 第九节 · 因果律条件引擎测试
// 解锁判定靠治理状态+事件链，而非单一资源购买。
// ============================================================
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { createTurnCtx } from '../src/core/systems/context';
import {
  checkUnlockConditions,
  techRevealed,
  canInvestWonder,
  heroOfferDue,
  evaluateHeroRecruits,
  hasEvents,
} from '../src/core/systems/unlockEngine';
import { settleImplicitTech } from '../src/core/systems/techTree';
import { heroIsSick, settleRecruitChoices } from '../src/core/systems/heroes';
import { settleAssessment } from '../src/core/systems/assessment';
import { serialize, deserialize } from '../src/core/save';
import { config } from '../src/config';
import type { Rng } from '../src/core/types';

const rngFake = (v: number) => (() => v) as Rng;

describe('checkUnlockConditions 字段覆盖', () => {
  it('minInfoAccuracy / minFraudCleanStreak（大数据穿透）', () => {
    const s = createInitialState(201, 'local');
    const node = config.techTree.find((t) => t.id === 'tech_digitize')!;
    let r = checkUnlockConditions(s, node.conditions);
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
    s.county.infoAccuracy = 90;
    s.streaks.fraudClean = 3;
    r = checkUnlockConditions(s, node.conditions);
    expect(r.ok).toBe(true);
    expect(techRevealed(s, node)).toBe(true);
  });

  it('minFatigue + requiredEvents（铁腕问责需触发过干部怠工）', () => {
    const s = createInitialState(202, 'local');
    const node = config.techTree.find((t) => t.id === 'tech_iron_org')!;
    s.county.infoAccuracy = 0;
    const all = s.cadres;
    for (const c of all) c.fatigue = 80; // 平均 80 ≥ 70
    let r = checkUnlockConditions(s, node.conditions);
    expect(r.ok).toBe(false); // 缺事件链
    s.eventHistory.push('cadreSlack');
    r = checkUnlockConditions(s, node.conditions);
    expect(r.ok).toBe(true);
    expect(hasEvents(s, ['cadreSlack'])).toBe(true);
  });

  it('maxPoliticalCapital（脱贫广场仅失势时显现）', () => {
    const s = createInitialState(203, 'local');
    const w = config.wonders.find((x) => x.id === 'w_plaza')!;
    expect(w.hidden).toBe(true);
    expect(canInvestWonder(s, w)).toBe(false);
    s.county.politicalCapital = 18;
    expect(canInvestWonder(s, w)).toBe(true);
  });

  it('minRankStreak + noStalledProjects（国家级农业园竞标）', () => {
    const s = createInitialState(204, 'local');
    const w = config.wonders.find((x) => x.id === 'w_agripark')!;
    let r = checkUnlockConditions(s, w.conditions);
    expect(r.ok).toBe(false);
    s.streaks.rank = 5;
    s.county.fiscalFund = 90;
    // 项目全部 active（无烂尾）
    for (const p of s.projects) p.status = 'active';
    r = checkUnlockConditions(s, w.conditions);
    expect(r.ok).toBe(true);
  });
});

describe('禁忌节点与暗访', () => {
  it('隐式解锁：cutCorners≥3 自动获得台账美化', () => {
    const s = createInitialState(205, 'local');
    s.streaks.cutCorners = 3;
    settleImplicitTech(s, createTurnCtx(s, rngFake(0.5), 6));
    expect(s.techUnlocked).toContain('tech_beautify_org');
    expect(s.county.politicalCapital).toBe(55);
  });

  it('暗访：auditRisk>0 且 rng 低于 5% → 底线失守', () => {
    const s = createInitialState(206, 'local');
    s.techUnlocked.push('tech_beautify_org');
    const out = playRound(s, {}); // 默认 seed 派生 rng，跑一轮看是否可能触发（不强制）
    expect(out.state.techUnlocked).toContain('tech_beautify_org');
    // 确定性验证：直接以低 rng 调 settleAssessment
    const s2 = createInitialState(207, 'local');
    s2.techUnlocked.push('tech_beautify_org');
    const ctx2 = createTurnCtx(s2, rngFake(0.01), 10);
    settleAssessment(s2, ctx2);
    expect(ctx2.failures).toContain('bottomLineBreach');
  });
});

describe('人才招募两难', () => {
  it('offer 判定：事件链+条件+未拒绝未待决', () => {
    const s = createInitialState(208, 'local');
    s.eventHistory.push('villagerInitiative');
    s.county.round = 4;
    const h = config.heroes.find((x) => x.id === 'hero_returner')!;
    expect(heroOfferDue(s, h)).toBe(true);
    s.declinedRecruits.push('hero_returner');
    expect(heroOfferDue(s, h)).toBe(false);
  });

  it('接受→扣成本入队；拒绝→永拒+代价', () => {
    const s = createInitialState(209, 'local');
    s.pendingRecruits.push({ heroId: 'hero_returner', question: 'q' });
    const ctx = createTurnCtx(s, rngFake(0.5), 5);
    settleRecruitChoices(s, [{ heroId: 'hero_returner', accepted: true }], ctx);
    expect(s.heroes.length).toBe(1);
    expect(s.county.fiscalFund).toBe(105);
    // 拒绝流
    const s2 = createInitialState(210, 'local');
    s2.pendingRecruits.push({ heroId: 'hero_returner', question: 'q' });
    const ctx2 = createTurnCtx(s2, rngFake(0.5), 5);
    settleRecruitChoices(s2, [{ heroId: 'hero_returner', accepted: false }], ctx2);
    expect(s2.heroes.length).toBe(0);
    expect(s2.declinedRecruits).toContain('hero_returner');
    expect(ctx2.events.some((e) => e.type === 'recruitDeclined')).toBe(true);
  });

  it('病倒周期：sickCycle 每 N 回合病休，增益失效', () => {
    const s = createInitialState(211, 'local');
    s.heroes.push({ heroId: 'hero_shen', villageId: 'v_yunxi', recruitRound: 5 });
    s.county.round = 5;
    expect(heroIsSick(s, 'hero_shen')).toBe(false);
    s.county.round = 8;
    expect(heroIsSick(s, 'hero_shen')).toBe(true);
    s.county.round = 11;
    expect(heroIsSick(s, 'hero_shen')).toBe(true);
  });
});

describe('存档 v7 往返', () => {
  it('因果律字段全保留', () => {
    const s0 = createInitialState(212, 'returningStudent');
    const s = playRound(s0, { techUnlocks: ['tech_grid'] }).state;
    s.streaks.cutCorners = 1;
    s.eventHistory.push('cadreSlack');
    const back = deserialize(serialize(s));
    expect(back.version).toBe(8);
    expect(back.techUnlocked).toContain('tech_grid');
    expect(back.eventHistory).toContain('cadreSlack');
    expect(back.streaks.cutCorners).toBe(1);
    expect(back.streaks.villageStall.v_yunxi).toBe(0);
  });
});
