import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import type { RoundActions } from '../src/core/types';

// ============================================================
// 重构回归测试：干部精力/迷雾摸排、公文批复、过劳、瞒报抽查
// ============================================================

const SEED = 20261110;

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

describe('干部精力与迷雾摸排', () => {
  it('开局全县信息精度为 0；驻村干部入户摸排揭开迷雾', () => {
    const s0 = createInitialState(SEED, 'returningStudent');

    // 迷雾开局：数据"？？？"
    expect(s0.county.infoAccuracy).toBe(0);
    expect(s0.villages.every((v) => v.infoAccuracy === 0 && !v.surveyed)).toBe(true);
    // 4 名干部：3 驻村第一书记 + 1 机关机动
    expect(s0.cadres).toHaveLength(4);
    // 回合开始注入精力池：county.cadrePower = Σ干部精力
    const r0 = playRound(s0, baseActions());
    expect(r0.state.county.cadrePower).toBe(r0.state.cadres.reduce((s, k) => s + k.energy, 0));

    // 摸排雾岭村：刘芳驻村 → 耗 2 精力
    const r1 = playRound(s0, baseActions({ surveyVillages: ['v_wuling'] }));
    const wuling = r1.state.villages.find((v) => v.id === 'v_wuling')!;
    expect(wuling.surveyed).toBe(true);
    expect(wuling.infoAccuracy).toBeGreaterThanOrEqual(9); // 首查 +12 − 未建档/自然漂移
    expect(r1.failures).toHaveLength(0);

    // 无驻村的云溪村摸排更贵（机关干部下去）：耗 3 精力
    const before = r1.state.cadres.find((k) => k.villageId === 'v_yunxi')!.energy;
    const r2 = playRound(r1.state, baseActions({ surveyVillages: ['v_yunxi'] }));
    expect(r2.state.villages.find((v) => v.id === 'v_yunxi')!.surveyed).toBe(true);
    void before;
  });

  it('未摸排的村施策是盲打：效果打折', () => {
    const s0 = createInitialState(SEED, 'local');
    // 不摸排雾岭村，直接给马家上产业带动（remote 标签匹配）
    const blind = playRound(
      s0,
      baseActions({ householdMeasures: [{ groupId: 'hh_wuling_ma', measureId: 'industry' }] })
    );
    const maBlind = blind.state.villages.flatMap((v) => v.households).find((h) => h.id === 'hh_wuling_ma')!;
    const blindGain = maBlind.exitWillingness - 35; // 初始 35

    // 先摸排再施策：效果不打折
    const s1 = createInitialState(SEED, 'local');
    const surveyed = playRound(
      s1,
      baseActions({
        surveyVillages: ['v_wuling'],
        householdMeasures: [{ groupId: 'hh_wuling_ma', measureId: 'industry' }],
      })
    );
    const maSurveyed = surveyed.state.villages.flatMap((v) => v.households).find((h) => h.id === 'hh_wuling_ma')!;
    const surveyGain = maSurveyed.exitWillingness - 35;

    // 盲打（迷雾未揭，infoAccuracy<40 → ×0.5）应少于摸排后施策
    expect(blindGain).toBeLessThan(surveyGain);
  });
});

describe('干部过劳', () => {
  it('疲劳爆表 → 过劳倒下：士气、信任、精力受损', () => {
    const s0 = createInitialState(SEED, 'entrusted');
    // 直接造一个临近过劳的干部（疲劳 79 + 回合末 +2 = 81 ≥ 80）
    const chen = s0.cadres.find((k) => k.id === 'cad_chen')!;
    chen.fatigue = 79;
    chen.morale = 60;
    const trustBefore = s0.county.trust;

    const r1 = playRound(s0, baseActions());
    expect(r1.state.county.fatigueEvents).toBe(1);
    expect(r1.state.county.trust).toBeLessThan(trustBefore); // 过劳 −2（加上传导微调）
    expect(r1.events.some((e) => e.type === 'cadreBurnout')).toBe(true);
    // 过劳后疲劳大幅回落、精力清零
    const after = r1.state.cadres.find((k) => k.id === 'cad_chen')!;
    expect(after.fatigue).toBeLessThan(80);
    expect(after.energy).toBe(0);
    expect(after.morale).toBeLessThan(60);
  });
});

describe('公文批阅（事件文件）', () => {
  it('第 2 回合收到第一份文件；批复 A 稳妥处置', () => {
    let s = createInitialState(SEED, 'returningStudent');
    // r1：无文件（第一份 minRound=2）
    const r1 = playRound(s, baseActions());
    expect(r1.state.eventInbox).toHaveLength(0);

    // r2：ef_water 入箱
    const r2 = playRound(r1.state, baseActions());
    expect(r2.state.eventInbox.map((e) => e.fileId)).toContain('ef_water');

    // 批复 A → 从待办移除 + 结算事件
    const r2b = playRound(r1.state, baseActions({ eventDecisions: [{ fileId: 'ef_water', optionId: 'A' }] }));
    expect(r2b.state.eventInbox.map((e) => e.fileId)).not.toContain('ef_water');
    expect(r2b.events.some((e) => e.type === 'eventFileResolved' && e.fileId === 'ef_water')).toBe(true);

    // 后续回合不重复发同一份文件
    const r3 = playRound(r2b.state, baseActions());
    expect(r3.state.eventInbox.map((e) => e.fileId)).not.toContain('ef_water');
    expect(r3.failures).toHaveLength(0);
    s = r3.state;
    void s;
  });

  it('逾期不批 → 按最坏自动结算（autoWorst 不用造假选项）', () => {
    let s = createInitialState(SEED, 'returningStudent');
    // r2 收到 ef_water（deadline 5），一直不批；追查信号防返贫预警累积
    for (let i = 1; i <= 6; i++) {
      const sigIds = s.signals.filter((x) => !x.investigated).map((x) => x.id);
      const o = playRound(s, baseActions({ investigate: sigIds }));
      s = o.state;
      expect(o.failures).toHaveLength(0);
    }
    // r6 时 deadline(5) < 6 → 自动结算
    const r6 = s.history.find((h) => h.round === 6)!;
    expect(r6.outcome.events.some((e) => e.type === 'eventFileExpired' && e.fileId === 'ef_water')).toBe(true);
    expect(s.eventInbox.map((e) => e.fileId)).not.toContain('ef_water');
    // autoWorst 不选 C（造假），瞒报记录保持 0
    expect(s.fraudRecords).toHaveLength(0);
  });
});

describe('瞒报抽查（造假审判）', () => {
  it('造假批复留痕；第三方覆盖达 40 后必抽查，4 条记录必暴雷', () => {
    let s = createInitialState(SEED, 'returningStudent');
    // r2 批复 ef_water 选 C（瞒报改台账）
    const r1 = playRound(s, baseActions());
    const r2 = playRound(r1.state, baseActions({ eventDecisions: [{ fileId: 'ef_water', optionId: 'C' }] }));
    expect(r2.state.fraudRecords.length).toBeGreaterThanOrEqual(1);
    expect(r2.events.some((e) => e.type === 'eventFileResolved' && e.optionId === 'C')).toBe(true);
    s = r2.state;

    // 直接累积 4 条瞒报记录（≥4 抽查必中）
    while (s.fraudRecords.length < 4) {
      s.fraudRecords.push({ fileId: 'ef_water', round: 2 });
    }
    // r3 开启第三方评估 → 抽查触发 → 底线失守
    const r3 = playRound(s, baseActions({ assessment: { density: 30, thirdParty: 40, directReport: 10 } }));
    expect(r3.failures).toContain('bottomLineBreach');
    expect(r3.gameStatus).toBe('ended');
    expect(r3.state.ending).toBe('bottomLine');
    expect(r3.events.some((e) => e.type === 'fraudCaught')).toBe(true);
  });

  it('瞒报但第三方覆盖不足且未到验收期：暂不抽查（风险潜伏）', () => {
    let s = createInitialState(SEED, 'returningStudent');
    const r1 = playRound(s, baseActions());
    const r2 = playRound(r1.state, baseActions({ eventDecisions: [{ fileId: 'ef_water', optionId: 'C' }] }));
    s = r2.state;
    // 不设第三方评估（默认 10 < 40），抽查不触发
    const r3 = playRound(s, baseActions());
    expect(r3.failures).not.toContain('bottomLineBreach');
    expect(r3.gameStatus).toBe('running');
  });
});

describe('双层视图：个人精力与节点交互', () => {
  it('节点交互耗个人精力；调度会提升组织密度；每回合恢复满额', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    expect(s0.county.playerStamina).toBe(6);
    s0.county.formality = 10; // 垫高基数，观察交材料 −3

    // r1：交材料(1) + 调度会(2) = 耗 3 点
    const r1 = playRound(s0, baseActions({ nodeActions: ['file_materials', 'dispatch_meeting'] }));
    expect(r1.state.county.playerStamina).toBe(3);
    // 交材料：形式主义 −3、政治资本 +1（传导层另有微调，只断言方向）
    expect(r1.state.county.formality).toBeLessThan(s0.county.formality);
    expect(r1.state.county.politicalCapital).toBeGreaterThan(s0.county.politicalCapital);

    // r2：回合开始恢复满额 6
    const r2 = playRound(r1.state, baseActions());
    expect(r2.state.county.playerStamina).toBe(6);
    expect(r2.failures).toHaveLength(0);
  });

  it('个人精力不足时节点交互被跳过（不扣账）', () => {
    const s0 = createInitialState(SEED, 'returningStudent');
    // 一次性排 5 个交材料 = 5 点（≤6 全过），第 6 个也过（=6）
    const r1 = playRound(s0, baseActions({ nodeActions: ['file_materials', 'file_materials', 'file_materials', 'file_materials', 'file_materials', 'file_materials'] }));
    expect(r1.state.county.playerStamina).toBe(0);
    // 下一回合恢复，再排 7 个（6 个过，第 7 个被跳过）
    const r2 = playRound(r1.state, baseActions({ nodeActions: ['file_materials', 'file_materials', 'file_materials', 'file_materials', 'file_materials', 'file_materials', 'file_materials'] }));
    expect(r2.state.county.playerStamina).toBe(0);
  });

  it('放弃批复急件收工：压力 +5、代价入账', () => {
    let s = createInitialState(SEED, 'returningStudent');
    const r1 = playRound(s, baseActions());
    s = r1.state;
    const r2 = playRound(s, baseActions());
    s = r2.state;
    // r3 有急件（ef_road 急，minRound 3）在箱，直接放弃批复收工
    const pressureBefore = s.county.pressure;
    const r3 = playRound(s, baseActions({ abandonUrgent: true }));
    expect(r3.state.county.pressure).toBeGreaterThan(pressureBefore);
    expect(r3.failures).toHaveLength(0); // 放弃≠硬失败，是考核扣分
  });
});
