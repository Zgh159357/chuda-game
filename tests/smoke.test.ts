import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { config } from '../src/config';
import { summarizeLedger } from '../src/core/settlement/ledger';
import { computeFiveRatings } from '../src/core/settlement/ending';
import type { GameState, RoundActions } from '../src/core/types';

// ============================================================
// 全流程冒烟测试：贪婪型 AI 打满 50 回合与 18 回合短局，
// 验证管线不崩、终局判定与评级可算。
// ============================================================

function greedyActions(state: GameState): RoundActions {
  const c = state.county;
  const households = state.villages.flatMap((v) => v.households);

  // 施策：缺劳力未兜底的最优先，其余按标签匹配
  const noLabor = households.filter((h) => h.tag === 'noLabor' && !h.covered);
  const others = households.filter((h) => !h.measureId);
  const measures = [...noLabor, ...others].map((h) => {
    const m = config.measures.find((x) => x.matchTags.includes(h.tag));
    return {
      groupId: h.id,
      measureId: (h.tag === 'noLabor' ? 'guarantee' : m?.id ?? 'industry') as RoundActions['householdMeasures'][number]['measureId'],
    };
  });

  // 出卡：建档 → 派队 → 核查走访，阶段卡各取所需（每回合最多 4 张，省行动力）
  const cards: string[] = [];
  if (!households.every((h) => h.registered)) cards.push('a_register');
  if (state.villages.some((v) => !v.dispatchedUnitId)) cards.push('a_dispatch');
  cards.push('a_audit', 'a_visit');
  const phaseCards: Record<string, string[]> = {
    B: ['b_coop', 'b_workrelief', 'b_training'],
    C: ['c_thirdparty', 'c_consumption'],
    D: ['d_monitor', 'd_handover', 'd_collective', 'd_taper'],
    E: ['e_endogenous', 'e_reform', 'e_service', 'e_monitor2'],
  };
  for (const id of phaseCards[state.county.phase] ?? []) {
    if (state.unlocked.policies.includes(id)) cards.push(id);
  }
  const played = cards.slice(0, 4);

  const dispatch = state.villages
    .filter((v) => !v.dispatchedUnitId)
    .map((v, i) => ({ villageId: v.id, unitId: state.units[i % state.units.length].id }));

  const repair = state.projects
    .filter((p) => p.status === 'stalled' || p.status === 'broken')
    .map((p) => ({ projectId: p.id, mode: 'restructure' as const }));

  // G3 技能树：有治理经验点就按配置顺序点技能（群众工作线优先）
  const skills: string[] = [];
  let pointsLeft = c.skillPoints;
  for (const spec of config.skills) {
    if (state.unlocked.skills.includes(spec.id)) continue;
    if (pointsLeft < spec.cost) continue;
    if (spec.level > 1) {
      const prev = config.skills.find((x) => x.line === spec.line && x.level === spec.level - 1);
      if (prev && !state.unlocked.skills.includes(prev.id)) continue;
    }
    skills.push(spec.id);
    pointsLeft -= spec.cost;
  }

  return {
    cards: played,
    targetingLevel: 'village',
    fiscal: Math.min(15, c.fiscalFund),
    coop: Math.min(5, c.cooperationFund),
    commitment: 'standard',
    dispatch,
    householdMeasures: measures,
    assessment: { density: c.assessmentDensity, thirdParty: 30, directReport: 30 },
    repair,
    investigate: state.signals.filter((s) => !s.investigated).map((s) => s.id),
    acceptProposal: state.pendingProposals.map((p) => p.id),
    resettle: [],
    coopChoose: [],
    skills,
  };
}

describe('全流程冒烟：50 回合', () => {
  it('跑完全程不崩，产出结局与评级', () => {
    let s = createInitialState(42, 'returningStudent');
    for (let i = 0; i < 50; i++) {
      const o = playRound(s, greedyActions(s));
      s = o.state;
      if (o.gameStatus === 'ended') break;
    }
    expect(s.status).toBe('ended');
    expect(s.ending).toBeDefined();
    expect(s.history.length).toBeGreaterThan(10);
    expect(summarizeLedger(s).achievement).not.toBeNaN();
    const ratings = computeFiveRatings(s);
    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(ratings.achievement);
    // 存档序列化往返不丢状态
    const json = JSON.stringify(s);
    const back = JSON.parse(json) as GameState;
    expect(back.county.round).toBe(s.county.round);
    expect(back.ending).toBe(s.ending);
  });
});

describe('全流程冒烟：18 回合短局', () => {
  it('第 18 回合准时收官', () => {
    let s = createInitialState(7, 'local');
    for (let i = 0; i < 18; i++) {
      const o = playRound(s, greedyActions(s), 18);
      s = o.state;
      if (o.gameStatus === 'ended') break;
    }
    expect(s.status).toBe('ended');
    expect(s.county.round).toBe(18);
    expect(s.ending).toBeDefined();
  });
});
