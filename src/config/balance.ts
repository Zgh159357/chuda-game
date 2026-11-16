import type { BalanceConfig } from '../core/types';

// ============================================================
// 平衡参数 —— 初始值、曲线、阈值、退坡表。阶段 8 只调这里。
// ============================================================
export const balance: BalanceConfig = {
  cadrePowerPerRound: 8,
  fiscalPerRound: 25,
  coopPerRound: 8,
  initial: {
    fiscalFund: 120,
    coopFund: 0,
    trust: 40,
    politicalCapital: 55,
    infoAccuracy: 30,
    adminBurden: 10,
    debtRisk: 12,
    ecology: 60,
    orgDensity: 30,
    assessmentDensity: 30,
    thirdPartyCoverage: 10,
    directReport: 10,
    eastWillingness: 50,
  },
  hardFail: {
    trustFloor: 8, // 信任崩盘
    debtCeiling: 95, // 债务生态暴雷
    pcFloor: 20, // 政治资本
    pcGraceRounds: 2, // 宽限期
    canHoldRatioCeiling: 0.5, // 过渡期接不住村比例
    returnRiskFloor: 70, // 规模性返贫：风险 ≥70 的村比例
    returnWaveMissed: 3, // 连续错过预警窗口次数
  },
  subsidyWaves: [
    { round: 35, cut: 20 },
    { round: 38, cut: 20 },
    { round: 41, cut: 20 },
  ],
  orgDensity: {
    forcedDropPerRound: 5, // D 阶段每回合 −5（半年 × 每年−10）
    bandMin: 40,
    bandMax: 60,
  },
  milestoneRounds: [4, 12, 20, 32, 35, 38, 41, 50],
  stars: { thresholds: [30, 55, 75, 90] }, // 表现分 → 星
  villagerEventsPerRound: [1, 3],
  signalsPerRound: [1, 2],
  proposalChance: 0.35,
  playerStaminaMax: 6, // 组长个人精力（双层视图：回合内资源）
  fileOptionStamina: { A: 2, B: 2, C: 1 }, // 批复耗精力：C 造假更省力=系统性诱惑
  paperStackClearCost: 1, // 清一堆迎检文件耗 1 点个人精力
  paperStackPressure: 2, // 每堆未清文件 ×2 计入考核压力
  cohesion: {
    drift: 2, // 凝聚力每回合自然流失
    perFacility: 5, // 每座配套设施提供的支撑
    riotThreshold: 30, // 低于此值触发「聚众闹事」
    crisisThreshold: 15, // 低于此值触发「返贫危机」
  },
  heroSpawnChance: 0.25, // 摸排走访触发「人才觉醒」的概率
  tabooAuditChance: 0.05, // 禁忌节点暗访：每回合 5% 概率直接失败
  heroSickCycle: 3, // sickCycle 人才每 3 回合病倒一轮
  industryDisasterChance: 0.04, // industryFragile 天灾：每回合 4% 概率全盘停滞
  resilience: {
    initialMax: 50, // 韧性上限初始值
    regenPerRound: 5, // 每回合基础恢复
    visitBonus: 5, // 本回合有入户走访/摸排 → 额外恢复
    floorDefenseCost: 200, // 底线防御每次紧急干预扣财政
    floorDefenseThreshold: 20, // 内生治理低于此值触发底线防御
  },
  governanceShield: {
    perCadrePerRound: 2, // 每名驻村干部每回合生成 2 点护盾
    max: 8, // 单村护盾上限
  },
  economy: {
    chainWithdrawChance: 0.25, // 退坡期高依赖链主每回合 25% 概率撤资
    chainWithdrawTrustHit: 6, // 撤资砸下的信任
    enclaveDividendInterval: 4, // 飞地每 4 回合分红一次
    coldChainUsagePerProject: 1, // 每个 active/recovered 项目占用 1 单位冷链
    idleRatePenaltyThreshold: 0.35, // 空置率超 35% = 无效投资
    appAdoptionThreshold: 0.2, // APP 使用率低于 20% = 无效投资
    appAdoptionGrowth: 0.02, // 参与≥60 时使用率每回合 +2%
    guaranteedPriceSubsidy: 2, // 保底价契约：该村补贴依赖每回合 +2
    propertyRightsDualBind: 8, // 产权确权：双绑稳定度 +8
    premiumTrustPer10: 0.5, // 溢价分成每 10% 信任 +0.5
    serviceFeeCollectivePerPoint: 0.2, // 服务费每 1 点集体经济 +0.2
  },
};
