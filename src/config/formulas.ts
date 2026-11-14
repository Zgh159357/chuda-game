import type { FormulasConfig } from '../core/types';

// ============================================================
// 公式系数 —— 全部数值集中于此，禁止在系统代码里写死数字
// ============================================================
export const formulas: FormulasConfig = {
  projectEffect: {
    // 项目效果 = 基础 × 信息精度系数 × 群众参与 × 边际递减 × 标签匹配(1/0.5) − 风险惩罚
    infoFactorPer10: 0.08, // 精度每 +10 点，效果 ×(1+0.08)（基准 0.5 → 系数 1±）
    diminishing: 0.9, // 连续追加投入的边际递减
    riskPenaltyPer10: 0.5, // 返贫风险每 10 点的效果惩罚
  },
  adminCost: {
    // 行政成本 = 基础 × 瞄准等级(1/1.5/2.25/3.375) × (1+信息精度/200)
    targetingMultiplier: { county: 1, village: 1.5, household: 2.25, person: 3.375 },
    infoFactorDiv: 200,
  },
  dualBind: {
    // 双绑稳定度 = 企业×0.4 + 合作社×0.3 + 农户×0.2 + 党组织×0.1 − 补贴依赖×0.5
    enterprise: 0.4,
    coop: 0.3,
    farmer: 0.2,
    party: 0.1,
    subsidy: 0.5,
  },
  canHold: {
    // 接得住 = 内生治理×0.4 + 产业×0.3 + 集体经济×0.2 + 参与×0.1 − 补贴依赖×0.4
    governance: 0.4,
    industry: 0.3,
    collective: 0.2,
    participation: 0.1,
    subsidy: 0.4,
    threshold: 40,
  },
  assessment: {
    // 考核反噬：密度>60 时 迎检负担 +=(密度−60)×0.8；做证明概率 +=(密度−60)×1.5；产出×0.95
    backlashThreshold: 60,
    burdenPerPoint: 0.8,
    fakeProbPerPoint: 1.5,
    outputMul: 0.95,
  },
  orgCost: { floor: 1 }, // 组织成本比率 = 成本 / max(1, 产出)
  trust: {
    // 信任变化 = 实际改善×透明度 − 形式主义×0.5 − 强制退出惩罚
    formalismPenalty: 0.5,
    forcedExitPenalty: 8,
    // 边际递减：越接近 100 增长越慢，保底 15%（防信任无脑拉满/一条心）
    saturationFloor: 0.15,
  },
  pressure: {
    // 压力传导：下层压力×1.1；信息精度×0.95；时间窗口−1
    perLayer: 1.1,
    infoDecay: 0.95,
    windowMinus: 1,
    // 压力消解：高于基线的部分每回合回落 15%（均衡点≈46，只放大冲击不成死亡螺旋）
    baseline: 20,
    reliefRate: 0.15,
  },
  cadre: {
    // 干部精力系统（重构）：精力=行动资源，士气/疲劳=状态量
    maxEnergy: 10,
    baseRegen: 3,
    fatigueRegenPenalty: 40, // 疲劳每满 40 少恢复 1
    lowMoraleThreshold: 40, // 士气低于 40 再少恢复 1
    baseFatiguePerRound: 2,
    burnoutThreshold: 80, // 疲劳 >80 过劳倒下
    burnoutMoralePenalty: 20,
    burnoutFatigueRelief: 30, // 过劳后疲劳回落 30
    burnoutTrustHit: 2,
    moveEnergyCost: 1, // 干部换岗（驻村/召回）
    surveyEnergyCost: 2, // 有驻村干部的村摸排
    surveyEnergyCostNoCadre: 3, // 无驻村干部的村摸排（抽调机关干部去）
    surveyFatigue: 3,
    surveyInfoGain: 12, // 首次入户摸排
    surveyInfoGainRepeat: 6, // 重复摸排
    fogRevealThreshold: 40, // 精度≥40：致贫标签显现（半盲）
    fogPreciseThreshold: 70, // 精度≥70：数值精确（全清晰）
    blindMeasureMul: 0.5, // 全盲施策（精度<40）：效果减半=信息错配
    halfBlindMeasureMul: 0.7, // 半盲施策：效果 7 折
  },
};
