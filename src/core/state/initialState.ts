import type { GameState, PlayerAnchor, Round } from '../types';
import { config } from '../../config';
import { makeCadres, makeProjects, makeRelationships, makeSites, makeUnits, makeVillages } from '../../config/world';
import { chainMasterCatalog, INITIAL_INFRA } from '../../config/economy';

// ============================================================
// 初始状态工厂（P1：玩家身份锚点三选一）
// ============================================================

/**
 * 玩家身份锚点：
 * - returningStudent 返乡大学生：群众参与 +5，初始信任 −3（年轻人要证明自己）
 * - entrusted 前任托付：初始信任 +3，政治资本 −2（前任的摊子连着债）
 * - local 本地干部：行动力 +1/回合，行政负担 +2（熟人社会，人情也是成本）
 */
export const anchorEffects: Record<
  PlayerAnchor,
  { trust: number; politicalCapital: number; participation: number; adminBurden: number; cadrePerRound: number }
> = {
  returningStudent: { trust: -3, politicalCapital: 0, participation: 5, adminBurden: 0, cadrePerRound: 0 },
  entrusted: { trust: 3, politicalCapital: -2, participation: 0, adminBurden: 0, cadrePerRound: 0 },
  local: { trust: 0, politicalCapital: 0, participation: 0, adminBurden: 2, cadrePerRound: 1 },
};

export function createInitialState(seed: number, anchor: PlayerAnchor): GameState {
  const eff = anchorEffects[anchor];
  const ini = config.balance.initial;

  const villages = makeVillages();
  // 锚点：群众参与加成落到各村
  for (const v of villages) {
    v.participation = Math.max(0, Math.min(100, v.participation + eff.participation));
  }

  return {
    version: 16,
    seed,
    status: 'running',
    anchor,
    county: {
      year: 2012,
      quarter: 1,
      round: 1 as Round,
      phase: 'A',
      fiscalFund: ini.fiscalFund,
      cooperationFund: 0,
      cadrePower: config.balance.cadrePowerPerRound + eff.cadrePerRound,
      cadrePerRound: config.balance.cadrePowerPerRound + eff.cadrePerRound,
      trust: ini.trust + eff.trust,
      politicalCapital: ini.politicalCapital + eff.politicalCapital,
      commitment: 'standard',
      commitmentRound: 1 as Round,
      infoAccuracy: 0, // 迷雾开局：全县档案在雾里（settleInfoFog 每回合按村重算）
      adminBurden: ini.adminBurden + eff.adminBurden,
      debtRisk: ini.debtRisk,
      ecology: ini.ecology,
      orgDensity: ini.orgDensity,
      assessmentDensity: ini.assessmentDensity,
      thirdPartyCoverage: ini.thirdPartyCoverage,
      directReport: ini.directReport,
      eastWillingness: ini.eastWillingness,
      orgCostRatio: 0,
      backlash: { inspectionBurden: 0, fakeProb: 0, outputMul: 1 },
      formality: 0,
      meetingBurden: 0,
      tableBurden: 0,
      inspectionBurden: 0,
      pressure: 10,
      formalityPeak: 0,
      canHoldIndex: 0,
      relativeMonitor: false,
      lastTargeting: 'village',
      skillPoints: 0,
      fatigueEvents: 0,
      playerStamina: config.balance.playerStaminaMax,
      logisticsStation: false,
      organizationalResilience: config.balance.resilience.initialMax,
      maxResilience: config.balance.resilience.initialMax,
    },
    villages,
    sites: makeSites(),
    units: makeUnits(),
    projects: makeProjects(),
    relationships: makeRelationships(),
    cadres: makeCadres(),
    eventInbox: [],
    eventFilesSeen: [],
    fraudRecords: [],
    zoning: [],
    ledger: { entries: [] },
    unlocked: {
      policies: ['a_register', 'a_dispatch', 'a_audit', 'a_visit', 'a_public', 'a_recheck', 'a_meeting', 'a_link', 'a_survey'],
      achievements: [],
      milestones: [],
      skills: [],
    },
    storylines: [
      { id: 'laoli', stageIndex: 0 },
      { id: 'xiaoyang', stageIndex: 0 },
      { id: 'xiaowang', stageIndex: 0 },
    ],
    combo: { streak: 0, lastKind: null },
    history: [],
    pcLowRounds: 0,
    missedReturnWarnings: 0,
    trapRewards: [],
    signals: [],
    pendingProposals: [],
    projectsRepaired: [],
    projectFailures: [],
    accurateMatches: 0,
    repairModes: [],
    extraRoads: [],
    techUnlocked: [],
    wonders: config.wonders.map((w) => ({ id: w.id, invested: 0, built: false })),
    heroes: [],
    eventHistory: [],
    streaks: { fraudClean: 0, cutCorners: 0, rank: 0, villageStall: {} },
    pendingRecruits: [],
    declinedRecruits: [],
    heroChains: {},
    builtNodes: [], // §15 自建产业设施
    chainMasters: chainMasterCatalog.map((c) => ({ ...c, isPresent: false, subsidyPaid: 0 })), // §16
    enclaves: [], // §16 飞地抱团
    distributionContracts: {}, // §16 各村分红契约（缺省=口头约定）
    physicalInfra: { ...INITIAL_INFRA }, // §16 冷链与数字化错位
  };
}
