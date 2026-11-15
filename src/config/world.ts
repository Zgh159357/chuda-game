import type { Cadre, DispatchedUnit, HouseholdGroup, ProjectState, ResettlementSite, VillageState } from '../core/types';

// ============================================================
// 开局世界内容：3 村 + 1 安置点 + 6 项目 + 3 派出单位 + 4 干部
// 全部虚构地名、人名。
// ============================================================

export function makeHouseholds(): HouseholdGroup[] {
  return [
    // 云溪村：因病户多、产业弱（老李家在此）
    { id: 'hh_yunxi_laoli', villageId: 'v_yunxi', name: '老李家', tag: 'disease', population: 5, laborAbility: 0.4, exitWillingness: 30, covered: false, measureId: null, agency: 55, registered: false },
    { id: 'hh_yunxi_zhou', villageId: 'v_yunxi', name: '周家', tag: 'noLabor', population: 3, laborAbility: 0.1, exitWillingness: 10, covered: false, measureId: null, agency: 20, registered: false },
    { id: 'hh_yunxi_chen', villageId: 'v_yunxi', name: '陈家', tag: 'education', population: 4, laborAbility: 0.7, exitWillingness: 45, covered: false, measureId: null, agency: 40, registered: false },
    // 雾岭村：迷雾重、偏远（小杨在此）
    { id: 'hh_wuling_ma', villageId: 'v_wuling', name: '马家', tag: 'remote', population: 4, laborAbility: 0.6, exitWillingness: 35, covered: false, measureId: null, agency: 45, registered: false },
    { id: 'hh_wuling_yang', villageId: 'v_wuling', name: '小杨家', tag: 'remote', population: 3, laborAbility: 0.8, exitWillingness: 60, covered: false, measureId: null, agency: 70, registered: false },
    { id: 'hh_wuling_he', villageId: 'v_wuling', name: '何家', tag: 'ecoConstraint', population: 4, laborAbility: 0.5, exitWillingness: 40, covered: false, measureId: null, agency: 35, registered: false },
    { id: 'hh_wuling_lao', villageId: 'v_wuling', name: '劳家', tag: 'noLabor', population: 2, laborAbility: 0.05, exitWillingness: 5, covered: false, measureId: null, agency: 15, registered: false },
    // 青石村：产业底子好、补贴依赖高（小王在此）
    { id: 'hh_qingshi_wang', villageId: 'v_qingshi', name: '小王家', tag: 'noSkill', population: 4, laborAbility: 0.9, exitWillingness: 70, covered: false, measureId: null, agency: 80, registered: false },
    { id: 'hh_qingshi_wu', villageId: 'v_qingshi', name: '吴家', tag: 'disease', population: 5, laborAbility: 0.3, exitWillingness: 25, covered: false, measureId: null, agency: 30, registered: false },
    { id: 'hh_qingshi_zheng', villageId: 'v_qingshi', name: '郑家', tag: 'education', population: 4, laborAbility: 0.7, exitWillingness: 50, covered: false, measureId: null, agency: 50, registered: false },
  ];
}

export function makeVillages(): VillageState[] {
  // 开局全县档案在雾里：信息精度一律 0，入户摸排后逐步揭开
  return [
    {
      id: 'v_yunxi', name: '云溪村',
      infoAccuracy: 0, externalEmbed: 20, internalGovernance: 25, industryBase: 15,
      industryChannel: 10, industryChain: 10, subsidyDependence: 30, returnRisk: 55,
      collectiveEconomy: 10, coopType: null, dualBindStability: 0, canHoldIndex: 0,
      dispatchedUnitId: null, participation: 25, surveyed: false, industryOutputMul: 1, governanceShield: 0,
      households: makeHouseholds().filter((h) => h.villageId === 'v_yunxi'),
      projects: ['p_yunxi_herb'],
    },
    {
      id: 'v_wuling', name: '雾岭村',
      infoAccuracy: 0, externalEmbed: 15, internalGovernance: 20, industryBase: 10,
      industryChannel: 8, industryChain: 8, subsidyDependence: 25, returnRisk: 65,
      collectiveEconomy: 5, coopType: null, dualBindStability: 0, canHoldIndex: 0,
      dispatchedUnitId: null, participation: 20, surveyed: false, industryOutputMul: 1, governanceShield: 0,
      households: makeHouseholds().filter((h) => h.villageId === 'v_wuling'),
      projects: ['p_wuling_chicken'],
    },
    {
      id: 'v_qingshi', name: '青石村',
      infoAccuracy: 0, externalEmbed: 30, internalGovernance: 35, industryBase: 40,
      industryChannel: 25, industryChain: 30, subsidyDependence: 45, returnRisk: 40,
      collectiveEconomy: 20, coopType: null, dualBindStability: 0, canHoldIndex: 0,
      dispatchedUnitId: null, participation: 35, surveyed: false, industryOutputMul: 1, governanceShield: 0,
      households: makeHouseholds().filter((h) => h.villageId === 'v_qingshi'),
      projects: ['p_qingshi_fruit'],
    },
  ];
}

export function makeSites(): ResettlementSite[] {
  return [
    {
      id: 's_xinping', name: '新坪安置点',
      population: 0, governanceDensity: 10, livelihoodSelfReliance: 10,
      orgLayers: 2, serviceCost: 2, households: [],
      communityCohesion: 40, facilities: [],
    },
  ];
}

export function makeUnits(): DispatchedUnit[] {
  return [
    { id: 'u_agri', name: '县农业局', resourcePool: 60, politicalCredit: 50, businessPressure: 40 },
    { id: 'u_health', name: '县卫健局', resourcePool: 50, politicalCredit: 45, businessPressure: 50 },
    { id: 'u_east', name: '东部协作单位', resourcePool: 85, politicalCredit: 60, businessPressure: 65 },
  ];
}

export function makeCadres(): Cadre[] {
  // 干部主体性：三人驻村第一书记 + 一名机关机动干部；特质各有长短
  return [
    { id: 'cad_chen', name: '陈海', title: '第一书记', homeUnitId: 'u_agri', villageId: 'v_yunxi', energy: 8, morale: 62, fatigue: 25, specialty: 'massWork', skillLevel: 2, traits: ['trait_walker'] },
    { id: 'cad_liu', name: '刘芳', title: '第一书记', homeUnitId: 'u_health', villageId: 'v_wuling', energy: 8, morale: 70, fatigue: 20, specialty: 'projectOps', skillLevel: 2, traits: ['trait_clerk'] },
    { id: 'cad_zhou', name: '周远', title: '第一书记', homeUnitId: 'u_east', villageId: 'v_qingshi', energy: 8, morale: 66, fatigue: 30, specialty: 'orgBuilding', skillLevel: 2, traits: ['trait_mediator'] },
    { id: 'cad_wu', name: '吴敏', title: '机关干部', homeUnitId: 'u_agri', villageId: null, energy: 8, morale: 58, fatigue: 35, specialty: 'massWork', skillLevel: 1, traits: [] },
  ];
}

export function makeProjects(): ProjectState[] {
  return [
    { id: 'p_yunxi_herb', name: '云溪中药材基地', villageId: 'v_yunxi', measureId: 'industry', status: 'active', subsidyDependence: 40, channelStrength: 20, chainCompleteness: 15, effectBase: 8, invested: 20, roundsActive: 0 },
    { id: 'p_wuling_chicken', name: '雾岭土鸡养殖', villageId: 'v_wuling', measureId: 'industry', status: 'active', subsidyDependence: 30, channelStrength: 15, chainCompleteness: 10, effectBase: 6, invested: 12, roundsActive: 0 },
    { id: 'p_qingshi_fruit', name: '青石果品加工线', villageId: 'v_qingshi', measureId: 'industry', status: 'active', subsidyDependence: 55, channelStrength: 35, chainCompleteness: 40, effectBase: 12, invested: 30, roundsActive: 0 },
    { id: 'p_xinping_workshop', name: '新坪就业车间', villageId: 'v_qingshi', measureId: 'relocate', status: 'stalled', subsidyDependence: 45, channelStrength: 20, chainCompleteness: 25, effectBase: 10, invested: 0, roundsActive: 0 },
    { id: 'p_wuling_solar', name: '雾岭光伏电站', villageId: 'v_wuling', measureId: 'ecoJob', status: 'stalled', subsidyDependence: 50, channelStrength: 30, chainCompleteness: 20, effectBase: 9, invested: 0, roundsActive: 0 },
    { id: 'p_county_ecom', name: '县电商服务站', villageId: 'v_yunxi', measureId: 'training', status: 'stalled', subsidyDependence: 35, channelStrength: 45, chainCompleteness: 30, effectBase: 7, invested: 0, roundsActive: 0 },
  ];
}

export function makeRelationships() {
  return [
    { id: 'rel_team_sec', a: 'u_agri', b: 'v_yunxi', value: 40, label: '工作队↔村支书' },
    { id: 'rel_coop_ent', a: 'v_qingshi', b: 'u_east', value: 45, label: '合作社↔企业' },
    { id: 'rel_move_native', a: 's_xinping', b: 'v_wuling', value: 35, label: '搬迁户↔原住民' },
    { id: 'rel_unit_town', a: 'u_health', b: 'v_wuling', value: 40, label: '派出单位↔镇街' },
  ];
}
