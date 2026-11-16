// ============================================================
// §18 多阶段奇遇招募 —— 纯函数引擎 + 系统接线
// ============================================================
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { createTurnCtx } from '../src/core/systems/context';
import { playRound } from '../src/core/reducer';
import { chainTriggerMet, chainTriggerMissing, currentStepOf, optionAffordable, activeHeroDebuffs, heroRecruitable } from '../src/logic/heroChain';
import { chainOf } from '../src/config/heroChains';
import { settleHeroSteps, settleHeroDeclines, applyHeroDebuffs, heroIsSick } from '../src/core/systems/heroes';
import { heroOfferDue } from '../src/core/systems/unlockEngine';
import { deriveRoadSet } from '../src/core/sandbox/logistics';
import { serialize, deserialize } from '../src/core/save';
import type { Rng } from '../src/core/types';

function rngFake(v: number): Rng {
  return () => v;
}

describe('§18 触发条件（chainTriggerMet）', () => {
  it('沈书记：宗族村+停滞3回合+事件旗标', () => {
    const s = createInitialState(301, 'local');
    const chain = chainOf('hero_shen')!;
    expect(chainTriggerMet(s, chain)).toBe(false);
    s.eventHistory.push('villagerInitiative');
    s.streaks.villageStall.v_yunxi = 3;
    expect(chainTriggerMet(s, chain)).toBe(true);
    expect(chainTriggerMissing(s, chain).length).toBe(0);
  });
  it('赵长耕：路网格数不足 → 缺失清单有交通项', () => {
    const s = createInitialState(302, 'local');
    const chain = chainOf('hero_agronomist')!;
    s.eventHistory.push('fogRevealed');
    s.county.round = 8;
    const roaded = deriveRoadSet(s).size;
    if (roaded < 6) {
      expect(chainTriggerMet(s, chain)).toBe(false);
      expect(chainTriggerMissing(s, chain).some((m) => m.includes('公路'))).toBe(true);
    }
  });
});

describe('§18 多阶段推进（settleHeroSteps）', () => {
  it('两次推进入队：成本在第二阶段扣', () => {
    const s = createInitialState(303, 'local');
    s.pendingRecruits.push({ heroId: 'hero_returner' });
    s.heroChains['hero_returner'] = { stepIndex: 0, failCount: 0, offeredRound: 5, villageId: 'v_wuling' };
    const ctx = createTurnCtx(s, rngFake(0.9), 5);
    settleHeroSteps(s, [{ heroId: 'hero_returner', optionId: 0 }], ctx); // 免费
    expect(s.heroChains['hero_returner'].stepIndex).toBe(1);
    expect(s.county.fiscalFund).toBe(120);
    settleHeroSteps(s, [{ heroId: 'hero_returner', optionId: 0 }], ctx); // 15 万
    expect(s.heroes.some((h) => h.heroId === 'hero_returner')).toBe(true);
    expect(s.county.fiscalFund).toBe(105);
    expect(ctx.events.some((e) => e.type === 'recruitAccepted')).toBe(true);
  });
  it('失败原地重试：failCount+1，stepIndex 不动', () => {
    const s = createInitialState(304, 'local');
    s.pendingRecruits.push({ heroId: 'hero_returner' });
    s.heroChains['hero_returner'] = { stepIndex: 0, failCount: 0, offeredRound: 5, villageId: 'v_wuling' };
    const ctx = createTurnCtx(s, rngFake(0.01), 5); // 0.01 < 0.2 失败
    settleHeroSteps(s, [{ heroId: 'hero_returner', optionId: 0 }], ctx);
    expect(s.heroChains['hero_returner'].stepIndex).toBe(0);
    expect(s.heroChains['hero_returner'].failCount).toBe(1);
    expect(ctx.events.some((e) => e.type === 'heroStepFail')).toBe(true);
  });
  it('付不起则整项跳过（pc 不足）', () => {
    const s = createInitialState(305, 'local');
    s.pendingRecruits.push({ heroId: 'hero_oldsecretary' });
    s.heroChains['hero_oldsecretary'] = { stepIndex: 0, failCount: 0, offeredRound: 13, villageId: 'v_yunxi' };
    s.county.politicalCapital = 0; // 选项 1 要 3 pc、选项 0 要 1 财政（够）→ 用 pc 闸项测试
    s.heroChains['hero_oldsecretary'].stepIndex = 1;
    const ctx = createTurnCtx(s, rngFake(0.9), 13);
    const step = currentStepOf(s, 'hero_oldsecretary')!;
    expect(optionAffordable(s, 'hero_oldsecretary', step.options[0]).ok).toBe(false);
    settleHeroSteps(s, [{ heroId: 'hero_oldsecretary', optionId: 0 }], ctx);
    expect(s.heroChains['hero_oldsecretary'].stepIndex).toBe(1); // 未推进
  });
});

describe('§18 婉拒与隐性代价', () => {
  it('婉拒永闭（declineCloses）+ 代价结算', () => {
    const s = createInitialState(306, 'local');
    s.pendingRecruits.push({ heroId: 'hero_shen' });
    s.heroChains['hero_shen'] = { stepIndex: 0, failCount: 0, offeredRound: 6, villageId: 'v_yunxi' };
    const ctx = createTurnCtx(s, rngFake(0.9), 6);
    settleHeroDeclines(s, ['hero_shen'], ctx);
    expect(s.declinedRecruits).toContain('hero_shen');
    expect(heroRecruitable(s, 'hero_shen')).toBe(false);
    expect(heroOfferDue(s, 'hero_shen')).toBe(false);
  });
  it('passiveDebuff 每回合扣（入队者）', () => {
    const s = createInitialState(307, 'local');
    s.heroes.push({ heroId: 'hero_liu', villageId: 'v_yunxi', recruitRound: 6 });
    s.county.round = 7;
    const fiscalBefore = s.county.fiscalFund;
    const ctx = createTurnCtx(s, rngFake(0.9), 7);
    applyHeroDebuffs(s, ctx);
    expect(s.county.fiscalFund).toBeCloseTo(fiscalBefore - 0.5, 1);
    const lines = activeHeroDebuffs(s);
    expect(lines.some((l) => l.heroId === 'hero_liu' && l.metric === 'fiscalFund')).toBe(true);
    // 病倒暂停（沈书记 sickCycle3 + pc 摩擦）
    s.heroes.push({ heroId: 'hero_shen', villageId: 'v_yunxi', recruitRound: 6 });
    s.county.round = 9; // (9−6)%3===0
    expect(heroIsSick(s, 'hero_shen')).toBe(true);
    const pcBefore = s.county.politicalCapital;
    applyHeroDebuffs(s, ctx);
    expect(s.county.politicalCapital).toBe(pcBefore);
  });
});

describe('§18 整回合管线', () => {
  it('r4 奇遇入池：heroChains 进度 + pendingRecruits + recruitOffered 事件', () => {
    const s0 = createInitialState(308, 'local');
    let s = s0;
    let offered = false;
    for (let r = 1; r <= 4; r++) {
      const out = playRound(s, {});
      s = out.state;
      if (out.events.some((e) => e.type === 'recruitOffered')) offered = true;
    }
    expect(offered).toBe(true);
    expect(Object.keys(s.heroChains).length).toBeGreaterThan(0);
  });
});

describe('§18 存档 v16', () => {
  it('heroChains/村特质/婉拒记录往返', () => {
    const s0 = createInitialState(309, 'returningStudent');
    const s = playRound(s0, {}).state;
    s.heroChains['hero_shen'] = { stepIndex: 1, failCount: 2, offeredRound: 7, villageId: 'v_yunxi' };
    s.declinedRecruits.push('hero_zhao');
    const back = deserialize(serialize(s));
    expect(back.version).toBe(18);
    expect(back.heroChains['hero_shen'].failCount).toBe(2);
    expect(back.declinedRecruits).toContain('hero_zhao');
    expect(back.villages.find((v) => v.id === 'v_wuling')!.trait).toBe('hollow');
  });
});
