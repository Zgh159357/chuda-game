import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import type { RoundActions } from '../src/core/types';

// ============================================================
// 《触达》核心回路测试
// 1. 正常回合 2. 底线失守（缺劳力户建档未兜底） 3. 接不住事件
// ============================================================

const SEED = 20261109;

function baseActions(overrides: Partial<RoundActions> = {}): RoundActions {
  return {
    cards: [],
    targetingLevel: 'village',
    fiscal: 0,
    coop: 0,
    dispatch: [],
    householdMeasures: [],
    ...overrides,
  };
}

describe('正常回合', () => {
  it('回合推进、入账、事件与历史快照齐全', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const outcome = playRound(
      s0,
      baseActions({
        cards: ['a_register', 'a_visit'],
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    );

    // 回合推进：结算的是第 1 回合，结束后进入第 2 回合
    expect(outcome.round).toBe(1);
    expect(outcome.state.county.round).toBe(2);
    // 没有硬失败
    expect(outcome.failures).toHaveLength(0);
    expect(outcome.gameStatus).toBe('running');
    // 星级合法
    expect(outcome.stars).toBeGreaterThanOrEqual(1);
    expect(outcome.stars).toBeLessThanOrEqual(5);
    // 事件与反馈被记录
    expect(outcome.events.length).toBeGreaterThan(0);
    // 历史快照入档
    expect(outcome.state.history).toHaveLength(1);
    expect(outcome.state.history[0].round).toBe(1);
    // 财政入账（拨付 + 建档消耗）
    expect(outcome.state.county.fiscalFund).toBeGreaterThan(0);
    // 兜底生效：两户缺劳力户已覆盖，不触发底线计时
    const zhou = outcome.state.villages.flatMap((v) => v.households).find((h) => h.id === 'hh_yunxi_zhou')!;
    const lao = outcome.state.villages.flatMap((v) => v.households).find((h) => h.id === 'hh_wuling_lao')!;
    expect(zhou.covered).toBe(true);
    expect(lao.covered).toBe(true);
    expect(zhou.uncoveredRounds ?? 0).toBe(0);
  });
});

describe('开局牌组（软锁回归）', () => {
  it('初始解锁至少 5 张 A 阶段政策卡，第一回合能凑齐门槛', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    // 回归：此前开局只解锁 4 张，凑不齐 MIN_CARDS=5，玩家无法开始下一轮
    expect(s0.unlocked.policies.length).toBeGreaterThanOrEqual(5);
    expect(s0.unlocked.policies).toEqual(
      expect.arrayContaining(['a_register', 'a_dispatch', 'a_audit', 'a_visit', 'a_public', 'a_recheck', 'a_meeting', 'a_link'])
    );

    // 用 5 张新解锁卡开局，能正常结算进入第 2 回合
    const outcome = playRound(
      s0,
      baseActions({ cards: ['a_visit', 'a_public', 'a_meeting', 'a_link', 'a_recheck'] })
    );
    expect(outcome.failures).toHaveLength(0);
    expect(outcome.gameStatus).toBe('running');
    expect(outcome.state.county.round).toBe(2);
  });
});

describe('底线失守：缺劳力户建档后不兜底', () => {
  it('建档 3 回合未兜底 → bottomLineBreach 硬失败', () => {
    let s = createInitialState(SEED, 'local');

    // 回合 1：建档（a_register 指向精度最低的雾岭村，劳家被建档）
    const r1 = playRound(s, baseActions({ cards: ['a_register'] }));
    s = r1.state;
    expect(r1.failures).toHaveLength(0);

    const lao = s.villages.flatMap((v) => v.households).find((h) => h.id === 'hh_wuling_lao')!;
    expect(lao.registered).toBe(true);
    expect(lao.covered).toBe(false);

    // 回合 2、3：坐视不管
    const r2 = playRound(s, baseActions());
    expect(r2.failures).toHaveLength(0);
    const r3 = playRound(r2.state, baseActions());

    // 第 3 个未兜底回合 → 底线失守
    expect(r3.failures).toContain('bottomLineBreach');
    expect(r3.gameStatus).toBe('ended');
    expect(r3.state.status).toBe('ended');
    expect(r3.state.ending).toBe('bottomLine');
  });
});

describe('接不住事件', () => {
  it('组织密度与内生治理不足 → 回合 5 触发 canHoldEvent', () => {
    let s = createInitialState(SEED, 'returningStudent');

    // 前 5 回合几乎不投入组织建设
    for (let i = 0; i < 5; i++) {
      const o = playRound(s, baseActions());
      s = o.state;
      expect(o.failures).toHaveLength(0); // 这阶段不该触发硬失败
    }

    // 接得住指数：雾岭村开局即可算 <40（内生治理 20、产业 10、补贴依赖 25）
    const wuling = s.villages.find((v) => v.id === 'v_wuling')!;
    expect(wuling.canHoldIndex).toBeLessThan(40);

    // 第 5 回合的事件流里应出现接不住预警
    const round5 = s.history.find((h) => h.round === 5)!;
    expect(round5.outcome.events.some((e) => e.type === 'canHoldEvent')).toBe(true);
  });
});

describe('干部技能树（G3）', () => {
  it('里程碑发点、前置校验与解锁生效', () => {
    let s = createInitialState(SEED, 'local');

    // 回合 1：建档 + 兜底两户缺劳力，避免底线失守
    s = playRound(
      s,
      baseActions({
        cards: ['a_register'],
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    ).state;

    // 回合 2-4 空转：r4 里程碑结算后应发放 1 个治理经验点
    for (let i = 2; i <= 4; i++) {
      const o = playRound(s, baseActions());
      s = o.state;
      expect(o.failures).toHaveLength(0);
    }
    expect(s.county.round).toBe(5);
    expect(s.county.skillPoints).toBe(1);

    // 跳过前置直接买 mass2 → 拒绝，点数保留
    s = playRound(s, baseActions({ skills: ['mass2'] })).state;
    expect(s.unlocked.skills).not.toContain('mass2');
    expect(s.county.skillPoints).toBe(1);

    // 买 mass1 → 成功，点数扣光
    s = playRound(s, baseActions({ skills: ['mass1'] })).state;
    expect(s.unlocked.skills).toContain('mass1');
    expect(s.county.skillPoints).toBe(0);
  });
});
