import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import type { RoundActions } from '../src/core/types';
import { deriveRoadSet, logisticsCoveredAt, chainStatus } from '../src/core/sandbox/logistics';
import { stubbornnessOf, resolveNegotiation } from '../src/core/sandbox/negotiation';
import { serialize, deserialize } from '../src/core/save';

// ============================================================
// 《触达》四大进阶系统测试（主控提示词第七节）
// Logistics 道路/产业链 · Cadre Traits 特质 · Integration 凝聚力 · Negotiation 谈判
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
    investigate: [],
    ...overrides,
  };
}

describe('Logistics：道路连通与物流覆盖', () => {
  it('村/县/安置点天然通路；无物流站时不覆盖', () => {
    const s = createInitialState(SEED, 'returningStudent');
    const road = deriveRoadSet(s);
    // 三村 + 县治 + 安置点 + 各自项目所在格
    expect(road.has('1,2')).toBe(true); // v_yunxi
    expect(road.has('4,2')).toBe(true); // v_wuling
    expect(road.has('2,4')).toBe(true); // v_qingshi
    expect(road.has('3,3')).toBe(true); // 县治
    expect(road.has('4,4')).toBe(true); // 安置点
    // 荒地不通路
    expect(road.has('0,0')).toBe(false);
    // 没建物流站 → 有路也不覆盖
    expect(logisticsCoveredAt(s, 1, 2)).toBe(false);
  });

  it('修路行动推进路网；建物流站后覆盖生效', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const o1 = playRound(
      s0,
      baseActions({ nodeActions: ['road_build'], householdMeasures: [] })
    );
    const s1 = o1.state;
    expect(s1.extraRoads.length).toBe(1);
    const road = deriveRoadSet(s1);
    expect(road.has(`${s1.extraRoads[0].x},${s1.extraRoads[0].y}`)).toBe(true);
    const o2 = playRound(
      s1,
      baseActions({ nodeActions: ['logistics_station'], householdMeasures: [] })
    );
    const s2 = o2.state;
    expect(s2.county.logisticsStation).toBe(true);
    expect(logisticsCoveredAt(s2, 1, 2)).toBe(true);
  });

  it('产业链缺环节 → 工厂项目烂尾并扣财政', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    // 连续 4 回合空转（防返贫预警 + 无劳力兜底保命）
    let s = s0;
    for (let r = 1; r <= 4; r++) {
      const out = playRound(
        s,
        baseActions({
          householdMeasures: [
            { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
            { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
          ],
        })
      );
      s = out.state;
      if (out.gameStatus === 'ended') break;
    }
    const before = s.projects.find((p) => p.id === 'p_qingshi_fruit');
    expect(before?.status).toBe('active');
    const out5 = playRound(
      s,
      baseActions({
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    );
    // 第 5 回合起链断判定生效：无农业规划区/物流站 → 断链烂尾
    const after = out5.state.projects.find((p) => p.id === 'p_qingshi_fruit');
    expect(after?.status).toBe('stalled');
    // 扣财政记代价账（入账里应有 −5 的「产业链断链」）
    expect(out5.ledgerDelta.some((l) => l.note.includes('产业链') && l.value < 0)).toBe(true);
    expect(out5.events.some((e) => e.type === 'chainStall')).toBe(true);
    // 链状态纯函数：missing 含 supply 与 logistics
    const ch = chainStatus(out5.state, 'p_qingshi_fruit');
    expect(ch?.ok).toBe(false);
  });
});

describe('Cadre Traits：干部特质', () => {
  it('铁脚板特质：摸排耗能减半', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const chen = s0.cadres.find((c) => c.id === 'cad_chen');
    expect(chen?.traits).toContain('trait_walker');
    const out = playRound(
      s0,
      baseActions({ surveyVillages: ['v_yunxi'] })
    );
    const after = out.state.cadres.find((c) => c.id === 'cad_chen')!;
    // 回合开始回复 3 点（8→10），驻村摸排原耗 2，铁脚板减半 → 1，最终 9
    expect(after.energy).toBe(9);
    // 铁脚板摸排疲劳只 +1（普通 +3）
    expect(after.fatigue).toBe(chen!.fatigue + 2 + 1);
  });

  it('疲劳爆表 → 获得负面特质（水土不服）', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const wu = s0.cadres.find((c) => c.id === 'cad_wu')!;
    wu.fatigue = 85;
    const out = playRound(
      s0,
      baseActions({
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    );
    const after = out.state.cadres.find((c) => c.id === 'cad_wu')!;
    expect(after.traits).toContain('trait_acclimatize');
    expect(out.events.some((e) => e.type === 'negTrait')).toBe(true);
  });
});

describe('Integration：安置点凝聚力', () => {
  it('凝聚力跌破阈值 → 聚众闹事', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const site = s0.sites[0];
    site.population = 500;
    site.communityCohesion = 28;
    const out = playRound(
      s0,
      baseActions({
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    );
    expect(out.events.some((e) => e.type === 'cohesionRiot')).toBe(true);
    expect(out.state.county.trust).toBeLessThan(s0.county.trust);
  });
});

describe('Negotiation：谈判博弈', () => {
  it('牌面足 + 平运 → 谈成（退出意愿上升）', () => {
    const s = createInitialState(SEED, 'returningStudent');
    const h = s.villages.flatMap((v) => v.households).find((g) => g.id === 'hh_wuling_ma')!;
    expect(h.exitWillingness).toBe(35);
    const stubborn = stubbornnessOf(h.id, s);
    // 利益交换 35 + 法律威慑 30 = 65；roll=0 → 65 ≥ 49 → 赢
    const result = resolveNegotiation(s, h.id, ['hand_interest', 'hand_law'], () => 0.5);
    expect(result.won).toBe(true);
    expect(result.total).toBe(65);
    expect(result.stubbornness).toBe(stubborn);
  });

  it('牌面弱 + 霉运 → 谈崩', () => {
    const s = createInitialState(SEED, 'returningStudent');
    const h = s.villages.flatMap((v) => v.households).find((g) => g.id === 'hh_wuling_ma')!;
    // 耐心劝说 20；roll=−10 → 10 < 顽固值 → 输
    const result = resolveNegotiation(s, h.id, ['hand_patience'], () => 0);
    expect(result.won).toBe(false);
  });

  it('回合内谈判结算：胜者退出意愿 +20，败者扣政治资本', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    const out = playRound(
      s0,
      baseActions({
        negotiations: [{ groupId: 'hh_wuling_ma', hands: ['hand_interest', 'hand_law'] }],
        householdMeasures: [
          { groupId: 'hh_yunxi_zhou', measureId: 'guarantee' },
          { groupId: 'hh_wuling_lao', measureId: 'guarantee' },
        ],
      })
    );
    const h = out.state.villages.flatMap((v) => v.households).find((g) => g.id === 'hh_wuling_ma')!;
    const negEvent = out.events.find((e) => e.type === 'negotiation');
    expect(negEvent).toBeTruthy();
    if (negEvent?.type === 'negotiation') {
      if (negEvent.won) expect(h.exitWillingness).toBeGreaterThan(35);
      else expect(out.state.county.politicalCapital).toBeLessThan(s0.county.politicalCapital);
    }
  });
});

describe('存档 v5 往返', () => {
  it('extraRoads / logisticsStation / traits / cohesion 全部保真', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    s0.county.logisticsStation = true;
    s0.extraRoads.push({ x: 0, y: 0 });
    s0.sites[0].communityCohesion = 66;
    s0.sites[0].facilities.push('plaza');
    s0.cadres[3].traits.push('trait_acclimatize');
    const json = serialize(s0);
    const back = deserialize(json);
    expect(back.county.logisticsStation).toBe(true);
    expect(back.extraRoads).toEqual([{ x: 0, y: 0 }]);
    expect(back.sites[0].communityCohesion).toBe(66);
    expect(back.sites[0].facilities).toContain('plaza');
    expect(back.cadres[3].traits).toContain('trait_acclimatize');
  });
});
