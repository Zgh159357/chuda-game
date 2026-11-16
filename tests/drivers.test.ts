// ============================================================
// 第八/九节驱动系统测试：机制树（32节点）/ 超级工程（15奇观）/
// 人才招募（26人）/ 存档 v7
// ============================================================
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { createTurnCtx } from '../src/core/systems/context';
import { heroSum, resolveHeroAssign, settleHeroSteps, heroIsSick } from '../src/core/systems/heroes';
import { settleTechUnlocks, techSum, canUnlockTech, settleImplicitTech } from '../src/core/systems/techTree';
import { evaluateHeroRecruits, checkUnlockConditions, wonderRevealed } from '../src/core/systems/unlockEngine';
import { wonderSum } from '../src/core/systems/wonders';
import { deriveRoadSet } from '../src/core/sandbox/logistics';
import { serialize, deserialize } from '../src/core/save';
import { config } from '../src/config';
import type { Rng } from '../src/core/types';

const rngFake = (v: number) => (() => v) as Rng;

describe('第九节 · 机制树（Tech Tree 32 节点）', () => {
  it('解锁耗政治资本；条件不满足拒绝；同批顺序解锁', () => {
    const s = createInitialState(123, 'local');
    const pc0 = s.county.politicalCapital; // 55
    const ctx = createTurnCtx(s, rngFake(0.5), 1);
    // tech_grid 无条件；tech_rotation 需 minRound 8（第1回合不满足）
    settleTechUnlocks(s, ['tech_grid', 'tech_rotation'], ctx);
    expect(s.techUnlocked).toContain('tech_grid');
    expect(s.techUnlocked).not.toContain('tech_rotation');
    expect(s.county.politicalCapital).toBe(pc0 - 25);
    expect(techSum(s, 'surveyCostCut')).toBe(1);
    expect(ctx.events.some((e) => e.type === 'techUnlock')).toBe(true);
  });

  it('前置未解锁时直接拒绝，不分批自动解锁', () => {
    const s = createInitialState(124, 'local');
    const ctx = createTurnCtx(s, rngFake(0.5), 1);
    settleTechUnlocks(s, ['tech_rotation'], ctx);
    expect(s.techUnlocked).toEqual([]);
    expect(s.county.politicalCapital).toBe(55);
    expect(canUnlockTech(s, 'tech_rotation')).toBe(false);
    expect(canUnlockTech(s, 'tech_grid')).toBe(true);
  });

  it('surveyCostCut 生效：摸排耗干部精力 −1（回合管线内）', () => {
    const a0 = createInitialState(125, 'local');
    const a1 = playRound(a0, { techUnlocks: ['tech_grid'] }).state;
    const a2 = playRound(a1, { surveyVillages: ['v_qingshi'] }).state;
    const b0 = createInitialState(125, 'local');
    const b1 = playRound(b0, {}).state;
    const b2 = playRound(b1, { surveyVillages: ['v_qingshi'] }).state;
    const cadA = a2.cadres.find((x) => x.id === 'cad_zhou')!;
    const cadB = b2.cadres.find((x) => x.id === 'cad_zhou')!;
    expect(cadA.energy).toBe(cadB.energy + 1);
    expect(a2.villages.find((v) => v.id === 'v_qingshi')!.surveyed).toBe(true);
  });

  it('隐式解锁：连续敷衍 3 回合 → 「台账美化」自动落锁（免费）', () => {
    const s = createInitialState(126, 'local');
    s.streaks.cutCorners = 3;
    const ctx = createTurnCtx(s, rngFake(0.5), 4);
    settleImplicitTech(s, ctx);
    expect(s.techUnlocked).toContain('tech_beautify_org');
    expect(s.county.politicalCapital).toBe(55); // 免费，代价自担
  });
});

describe('第九节 · 超级工程（Wonder 15 奇观）', () => {
  it('一次砸满：扣财政→建成→事件+全局 Buff（全县路网）', () => {
    const s0 = createInitialState(127, 'local');
    const out = playRound(s0, { wonderInvest: [{ wonderId: 'w_bridge', amount: 120 }] });
    const s = out.state;
    expect(out.events.some((e) => e.type === 'wonderCompleted')).toBe(true);
    const prog = s.wonders.find((w) => w.id === 'w_bridge')!;
    expect(prog.invested).toBe(120);
    expect(prog.built).toBe(true);
    expect(s.county.fiscalFund).toBe(25);
    expect(wonderSum(s, 'bridgeAllRoads')).toBe(1);
    expect(deriveRoadSet(s).size).toBe(36);
  });

  it('分期投入：不透支、未建成无 Buff', () => {
    const s0 = createInitialState(128, 'local');
    const s = playRound(s0, { wonderInvest: [{ wonderId: 'w_bridge', amount: 40 }] }).state;
    const prog = s.wonders.find((w) => w.id === 'w_bridge')!;
    expect(prog.invested).toBe(40);
    expect(prog.built).toBe(false);
    expect(wonderSum(s, 'bridgeAllRoads')).toBe(0);
    expect(deriveRoadSet(s).size).toBeLessThan(36);
  });

  it('争议奇观「脱贫广场」只在政治资本 <20 时显现', () => {
    const s = createInitialState(129, 'local');
    const w = config.wonders.find((x) => x.id === 'w_plaza')!;
    // 55 pc → 隐藏
    expect(wonderRevealed(s, w)).toBe(false);
    s.county.politicalCapital = 15;
    expect(wonderRevealed(s, w)).toBe(true);
    expect(checkUnlockConditions(s, w.conditions).ok).toBe(true);
  });
});

describe('第九节 · 人才招募（Hero 26 人，事件链触发）', () => {
  it('事件链触发：r4 后（villagerInitiative 事件史 + minRound）弹出两难', () => {
    const s0 = createInitialState(130, 'local');
    // 前 3 回合空转；r4 触发 evaluateHeroRecruits
    let s = s0;
    let offered = false;
    for (let r = 1; r <= 4; r++) {
      const out = playRound(s, {});
      s = out.state;
      if (out.events.some((e) => e.type === 'recruitOffered')) offered = true;
    }
    expect(offered).toBe(true);
    expect(s.pendingRecruits.length).toBeGreaterThan(0);
  });

  it('接受：扣成本入队 + 事件入账（§18 多阶段：两阶段链两次推进）', () => {
    const s = createInitialState(131, 'local');
    s.pendingRecruits.push({ heroId: 'hero_returner' });
    s.heroChains['hero_returner'] = { stepIndex: 0, failCount: 0, offeredRound: 5, villageId: 'v_wuling' };
    const ctx = createTurnCtx(s, rngFake(0.5), 5);
    settleHeroSteps(s, [{ heroId: 'hero_returner', optionId: 0 }], ctx); // 第 1 步：免费进门
    expect(s.heroChains['hero_returner'].stepIndex).toBe(1);
    settleHeroSteps(s, [{ heroId: 'hero_returner', optionId: 0 }], ctx); // 第 2 步：15 万对赌
    expect(s.heroes.some((h) => h.heroId === 'hero_returner')).toBe(true);
    expect(s.county.fiscalFund).toBe(105); // 120−15
    expect(ctx.events.some((e) => e.type === 'recruitAccepted')).toBe(true);
    // 再派去青石村：增益转移
    resolveHeroAssign(s, [{ heroId: 'hero_returner', villageId: 'v_qingshi' }], ctx);
    expect(heroSum(s, 'v_qingshi', 'agriYield')).toBe(0.2);
    expect(heroSum(s, 'v_yunxi', 'agriYield')).toBe(0);
  });

  it('病倒周期：沈书记入队后每 3 回合病倒一轮', () => {
    const s = createInitialState(132, 'local');
    s.heroes.push({ heroId: 'hero_shen', villageId: 'v_yunxi', recruitRound: 5 });
    s.county.round = 6;
    expect(heroIsSick(s, 'hero_shen')).toBe(false);
    s.county.round = 8; // (8−5)%3===0
    expect(heroIsSick(s, 'hero_shen')).toBe(true);
    expect(heroSum(s, 'v_yunxi', 'socialGlue')).toBe(0); // 病倒增益暂停
  });
});

describe('第九节 · 存档 v7', () => {
  it('序列化往返保留 tech/wonder/hero/因果律字段', () => {
    const s0 = createInitialState(133, 'entrusted');
    const s = playRound(s0, {
      techUnlocks: ['tech_grid'],
      wonderInvest: [{ wonderId: 'w_agri', amount: 30 }],
    }).state;
    const back = deserialize(serialize(s));
    expect(back.version).toBe(17);
    expect(back.techUnlocked).toContain('tech_grid');
    expect(back.wonders.find((w) => w.id === 'w_agri')!.invested).toBe(30);
    expect(back.heroes).toEqual([]);
    expect(Array.isArray(back.eventHistory)).toBe(true);
    expect(back.streaks).toBeDefined();
    expect(back.pendingRecruits).toBeDefined();
    expect(config.techTree.length).toBe(33);
    expect(config.wonders.length).toBe(15);
    expect(config.heroes.length).toBe(27);
  });
});
