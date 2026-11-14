import type {
  AchievementConfig,
  EndingSpec,
  HeroSpec,
  MeasureSpec,
  NegotiationHandSpec,
  PolicyCardSpec,
  RewardConfig,
  SkillSpec,
  StoryLineConfig,
  TechNodeSpec,
  TraitSpec,
  WonderSpec,
} from '../core/types';

// ============================================================
// 内容配置：措施 / 政策卡 / 成就 / 奖励 / 故事线 / 结局
// 全部虚构中性，不还原任何真实政策细节。
// ============================================================

// ----- 五个一批（虚构中性命名） -----
export const measures: MeasureSpec[] = [
  {
    id: 'industry',
    name: '产业带动',
    short: '产业',
    desc: '依托合作社与经营主体带动增收。匹配：缺技能、偏远。',
    matchTags: ['noSkill', 'remote'],
    cost: 3,
    effectBase: 10,
  },
  {
    id: 'relocate',
    name: '易地安置',
    short: '搬迁',
    desc: '对偏远户群实施集中安置。匹配：偏远、生态约束。',
    matchTags: ['remote', 'ecoConstraint'],
    cost: 5,
    effectBase: 12,
  },
  {
    id: 'ecoJob',
    name: '生态岗位',
    short: '生态',
    desc: '设置公益性生态岗位。匹配：生态约束、缺技能。',
    matchTags: ['ecoConstraint', 'noSkill'],
    cost: 2,
    effectBase: 8,
  },
  {
    id: 'training',
    name: '能力提升',
    short: '培训',
    desc: '技能培训与扶志扶智。匹配：缺技能、因学。',
    matchTags: ['noSkill', 'education'],
    cost: 2,
    effectBase: 7,
  },
  {
    id: 'guarantee',
    name: '兜底保障',
    short: '兜底',
    desc: '对无劳动能力户群实行兜底保障。匹配：缺劳力、因病。底线措施。',
    matchTags: ['noLabor', 'disease'],
    cost: 2,
    effectBase: 6,
  },
];

// ----- 政策卡牌库：A 阶段 9 张、B–E 每阶段 4 张，共 25 张（三卡槽：党建/产业/民生） -----
export const policies: PolicyCardSpec[] = [
  // A 精准识别
  { id: 'a_register', name: '建档立卡', phase: 'A', slot: 'livelihood', desc: '为全县户群建档，揭开信息迷雾。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'registerAll', value: 1 }] },
  { id: 'a_dispatch', name: '派驻工作队', phase: 'A', slot: 'party', desc: '派工作队驻村，外部嵌入大幅上升。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'dispatch', value: 1 }] },
  { id: 'a_audit', name: '信息核查', phase: 'A', slot: 'livelihood', desc: '逐户核实信息，提升精度。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'infoAccuracy', value: 14 }] },
  { id: 'a_visit', name: '入户走访', phase: 'A', slot: 'livelihood', desc: '干部入户，拉近与群众距离。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'trust', value: 4 }, { kind: 'participation', value: 4 }] },
  { id: 'a_public', name: '张榜公示', phase: 'A', slot: 'party', desc: '识别结果上墙公示，让群众来挑错。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'infoAccuracy', value: 5 }, { kind: 'trust', value: 3 }] },
  { id: 'a_recheck', name: '入户复核', phase: 'A', slot: 'livelihood', desc: '对边缘户逐户复核，防漏评错评。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'infoAccuracy', value: 8 }, { kind: 'returnRisk', value: -6 }] },
  { id: 'a_meeting', name: '村民评议会', phase: 'A', slot: 'party', desc: '把识别摆到台面上评，群众说了算。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'participation', value: 5 }, { kind: 'trust', value: 4 }] },
  { id: 'a_link', name: '结对联系', phase: 'A', slot: 'party', desc: '干部与困难户结对，动态跟踪动态帮。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'trust', value: 3 }, { kind: 'infoAccuracy', value: 4 }] },
  { id: 'a_survey', name: '产业摸排', phase: 'A', slot: 'industry', desc: '摸清各村产业家底，为施策铺路。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'infoAccuracy', value: 6 }, { kind: 'industryBase', value: 2 }] },
  // B 分类攻坚
  { id: 'b_subsidy', name: '产业奖补', phase: 'B', slot: 'industry', curse: true, desc: '真金白银砸产业——见效快，依赖也快。', cost: { cadre: 1, fiscal: 30, coop: 0 }, effects: [{ kind: 'industryBase', value: 12 }, { kind: 'subsidyDependence', value: 12 }] },
  { id: 'b_training', name: '技能培训', phase: 'B', slot: 'livelihood', desc: '送技能、扶志气。', cost: { cadre: 1, fiscal: 15, coop: 0 }, effects: [{ kind: 'laborAbility', value: 8 }, { kind: 'exitWillingness', value: 6 }] },
  { id: 'b_coop', name: '支部领办合作社', phase: 'B', slot: 'party', desc: '党组织领办，把散户组织起来。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'coopParty', value: 1 }] },
  { id: 'b_workrelief', name: '以工代赈', phase: 'B', slot: 'industry', desc: '干活挣工分，不养懒汉。', cost: { cadre: 1, fiscal: 20, coop: 0 }, effects: [{ kind: 'exitWillingness', value: 10 }, { kind: 'participation', value: 6 }], combo: ['b_training'] },
  // C 决战验收
  { id: 'c_inspect', name: '迎检准备', phase: 'C', slot: 'party', desc: '把台账做漂亮。有用，也有代价。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'inspectionPrep', value: 1 }] },
  { id: 'c_thirdparty', name: '引入第三方评估', phase: 'C', slot: 'party', desc: '请第三方来挑刺，公信力上升。', cost: { cadre: 1, fiscal: 0, coop: 10 }, effects: [{ kind: 'thirdParty', value: 15 }] },
  { id: 'c_consumption', name: '消费帮扶', phase: 'C', slot: 'industry', desc: '对口单位认购农产品，渠道打开。', cost: { cadre: 1, fiscal: 0, coop: 15 }, effects: [{ kind: 'channelStrength', value: 12 }], combo: ['b_coop'] },
  { id: 'c_burdencut', name: '减负令', phase: 'C', slot: 'party', desc: '砍掉重复报表。需要政治资本背书。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'adminBurden', value: -12 }, { kind: 'politicalCapital', value: -6 }] },
  // D 过渡期
  { id: 'd_monitor', name: '防返贫监测', phase: 'D', slot: 'livelihood', desc: '盯住返贫风险，窗口内响应。', cost: { cadre: 2, fiscal: 0, coop: 0 }, effects: [{ kind: 'returnRisk', value: -8 }, { kind: 'monitor', value: 1 }] },
  { id: 'd_taper', name: '退坡辅导', phase: 'D', slot: 'industry', desc: '教项目学会不靠补贴走路。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'subsidyTaper', value: 6 }] },
  { id: 'd_handover', name: '撤队交接', phase: 'D', slot: 'party', desc: '把外部嵌入转成内生治理。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'handover', value: 1 }] },
  { id: 'd_collective', name: '集体经济培育', phase: 'D', slot: 'industry', desc: '村里有了自己的家底。', cost: { cadre: 1, fiscal: 20, coop: 0 }, effects: [{ kind: 'collectiveEconomy', value: 10 }] },
  // E 常态化
  { id: 'e_reform', name: '考核改革', phase: 'E', slot: 'party', desc: '把考核从留痕转向实效。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'assessmentDensity', value: -10 }, { kind: 'adminBurden', value: -6 }] },
  { id: 'e_service', name: '公共服务均等化', phase: 'E', slot: 'livelihood', desc: '教育医疗公共服务向农村延伸。', cost: { cadre: 1, fiscal: 25, coop: 0 }, effects: [{ kind: 'trust', value: 5 }, { kind: 'internalGovernance', value: 5 }] },
  { id: 'e_monitor2', name: '相对贫困监测', phase: 'E', slot: 'livelihood', desc: '贫困治理没有终点，只有常态化。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'relativeMonitor', value: 1 }] },
  { id: 'e_endogenous', name: '内生治理赋能', phase: 'E', slot: 'party', desc: '把舞台还给村里人。', cost: { cadre: 1, fiscal: 0, coop: 0 }, effects: [{ kind: 'internalGovernance', value: 6 }, { kind: 'externalEmbed', value: -6 }] },
];

// ----- 成就 24 条：治理/取舍/反差/叙事 -----
export const achievements: AchievementConfig[] = [
  // 治理
  { id: 'ac_registered_all', name: '一户不落', category: 'governance', condition: 'allRegistered', desc: '全县户群全部建档立卡。', isNegative: false },
  { id: 'ac_accurate_10', name: '精准施策', category: 'governance', condition: 'accurateMatch10', desc: '10 次以上标签匹配施策。', isNegative: false },
  { id: 'ac_bottom_covered', name: '底线守住了', category: 'governance', condition: 'allNoLaborCovered', desc: '所有缺劳力户群获得兜底。', isNegative: false },
  { id: 'ac_burden_low', name: '减负专家', category: 'governance', condition: 'burdenLowAt32', desc: '第 32 回合行政负担低于 30。', isNegative: false },
  { id: 'ac_thirdparty', name: '敢请人挑刺', category: 'governance', condition: 'thirdParty60', desc: '第三方评估覆盖率达到 60。', isNegative: false },
  { id: 'ac_ecology', name: '绿水长流', category: 'governance', condition: 'ecology80', desc: '生态保持在 80 以上。', isNegative: false },
  // 取舍
  { id: 'ac_stoploss', name: '壮士断腕', category: 'tradeoff', condition: 'repairedStopLoss', desc: '以止损方式修复烂尾项目。', isNegative: false },
  { id: 'ac_restructure', name: '重组重生', category: 'tradeoff', condition: 'repairedRestructure', desc: '以重组方式修复烂尾项目。', isNegative: false },
  { id: 'ac_carrier', name: '换一条船', category: 'tradeoff', condition: 'repairedCarrier', desc: '以换载体方式修复烂尾项目。', isNegative: false },
  { id: 'ac_accountability', name: '把账算清楚', category: 'tradeoff', condition: 'repairedAccountability', desc: '以追责方式修复烂尾项目。', isNegative: false },
  { id: 'ac_taper_smooth', name: '平稳退坡', category: 'tradeoff', condition: 'taperSmooth', desc: '第 41 回合全县补贴依赖低于 30。', isNegative: false },
  { id: 'ac_direct_report', name: '敞开直报', category: 'tradeoff', condition: 'directReport50', desc: '群众直报通道达到 50。', isNegative: false },
  // 反差（负成就做镜子）
  { id: 'ac_inspection_maniac', name: '迎检狂人', category: 'mirror', condition: 'inspectionManiac', desc: '考核密度长期超过 80。', isNegative: true },
  { id: 'ac_paperwork_master', name: '留痕大师', category: 'mirror', condition: 'paperworkMaster', desc: '组织成本比率长期超过 2。', isNegative: true },
  { id: 'ac_overcommit', name: '争先的代价', category: 'mirror', condition: 'overcommitFailed', desc: '争先承诺未达标被约谈。', isNegative: true },
  { id: 'ac_fake_numbers', name: '证明我自己', category: 'mirror', condition: 'fakeProb30', desc: '做证明行为概率超过 30。', isNegative: true },
  { id: 'ac_empty_meetings', name: '文山会海', category: 'mirror', condition: 'meetingsHigh', desc: '会议与填表挤占大半行动力。', isNegative: true },
  { id: 'ac_subsidy_addict', name: '补贴成瘾', category: 'mirror', condition: 'subsidyAddict', desc: '全县补贴依赖超过 70。', isNegative: true },
  // 叙事
  { id: 'ac_laoli', name: '老李家的路', category: 'narrative', condition: 'laoliStage3', desc: '陪老李家走到故事终点。', isNegative: false },
  { id: 'ac_xiaoyang', name: '小杨安家', category: 'narrative', condition: 'xiaoyangStage3', desc: '小杨在安置点站稳了脚。', isNegative: false },
  { id: 'ac_xiaowang', name: '小王返乡', category: 'narrative', condition: 'xiaowangStage3', desc: '小王带着本事回了村。', isNegative: false },
  { id: 'ac_repairer', name: '修复者', category: 'narrative', condition: 'repairer', desc: '成功修复两个以上烂尾项目。', isNegative: false },
  { id: 'ac_canhold_all', name: '接得住', category: 'narrative', condition: 'canHoldAll', desc: '终局时所有村接得住指数不低于 60。', isNegative: false },
  { id: 'ac_tags_gone', name: '标签消失', category: 'narrative', condition: 'tagsGoneEnding', desc: '达成「标签消失」结局。', isNegative: false },
];

// ----- 干部技能树（G3）：三条线 × 三级，治理经验点解锁 -----
// 技能点是稀缺资源：8 个里程碑回合各给 1 点，全满需 12 点 —— 必须取舍。
export const skills: SkillSpec[] = [
  // 群众工作线
  { id: 'mass1', name: '群众工作·听', line: 'massWork', level: 1, desc: '村民更愿意开口提方案。', effect: { kind: 'proposalChance', value: 0.05 }, cost: 1 },
  { id: 'mass2', name: '群众工作·接', line: 'massWork', level: 2, desc: '村民自主行动带动更多参与与内生治理。', effect: { kind: 'agencyGrowth', value: 1 }, cost: 1 },
  { id: 'mass3', name: '群众工作·让', line: 'massWork', level: 3, desc: '村民主体性显著增强，提案源源不断。', effect: { kind: 'proposalChance', value: 0.1 }, cost: 2 },
  // 项目运营线
  { id: 'project1', name: '项目运营·管', line: 'projectOps', level: 1, desc: '项目效果提升 10%。', effect: { kind: 'projectMul', value: 0.1 }, cost: 1 },
  { id: 'project2', name: '项目运营·稳', line: 'projectOps', level: 2, desc: '项目更抗烂尾：停摆门槛提高。', effect: { kind: 'stallThreshold', value: 10 }, cost: 1 },
  { id: 'project3', name: '项目运营·通', line: 'projectOps', level: 3, desc: '运营中的项目渠道稳步增强。', effect: { kind: 'channelGrowth', value: 1 }, cost: 2 },
  // 组织建设线
  { id: 'org1', name: '组织建设·简', line: 'orgBuilding', level: 1, desc: '台账负担减半。', effect: { kind: 'tableCut', value: 0.5 }, cost: 1 },
  { id: 'org2', name: '组织建设·传', line: 'orgBuilding', level: 2, desc: '撤队交接留下更厚的内生治理遗产。', effect: { kind: 'handoverLegacy', value: 5 }, cost: 1 },
  { id: 'org3', name: '组织建设·轻', line: 'orgBuilding', level: 3, desc: '组织成本比率降低 20%。', effect: { kind: 'orgCostCut', value: 0.2 }, cost: 2 },
];

// ----- 干部特质（Cadre Traits，主控提示词第七节） -----
// 特质匹配的任务精力减半（铁脚板·摸排）；负面特质在过劳时获得并常驻。
export const traits: TraitSpec[] = [
  { id: 'trait_walker', name: '铁脚板', desc: '入户摸排耗能减半，不怕山路。', positive: true, match: 'survey' },
  { id: 'trait_mediator', name: '擅长调解', desc: '驻在村里，群众信任一点一点攒。', positive: true, match: 'mediate' },
  { id: 'trait_clerk', name: '填表大师', desc: '迎检填表那套，压不垮他。', positive: true, match: 'paperwork' },
  { id: 'trait_acclimatize', name: '水土不服', desc: '人在村里，身子一直没顺过来，比旁人更累。', positive: false, match: 'endure' },
];

// ----- 谈判博弈手牌（Negotiation，主控提示词第七节） -----
// 钉子户 / 低退出意愿户的攻坚：打手牌对「顽固值」，赢了才推进。
export const negotiationHands: NegotiationHandSpec[] = [
  { id: 'hand_interest', name: '利益交换', desc: '答应把补偿和后续帮扶一次性讲清楚。', value: 35, cost: { fiscal: 6 } },
  { id: 'hand_law', name: '法律威慑', desc: '摆政策摆文件：这是红线，不能例外。', value: 30, cost: {} },
  { id: 'hand_patience', name: '耐心劝说', desc: '一趟趟上门，把道理掰开揉碎讲。', value: 20, cost: { stamina: 1 } },
  { id: 'hand_elder', name: '请乡贤调解', desc: '请村里说得上话的老人出面。', value: 25, cost: { trust: -1 } },
];

// ----- 机制树（Tech Tree，主控提示词第八节） -----
// 三大分支 × 两级：政治资本解锁，效果永久生效。
export const techTree: TechNodeSpec[] = [
  // ===== 组织（org）8 节点 =====
  {
    id: 'tech_grid', name: '网格化管理', branch: 'org', type: 'basic',
    desc: '把村组划成网格，责任到人。', effectDesc: '摸排耗能 −1',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'surveyCostCut', value: 1 }],
  },
  {
    id: 'tech_visit', name: '常态入户', branch: 'org', type: 'basic',
    desc: '干部每周至少下一次村。', effectDesc: '群众信任每回合 +0.3',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'trustTrickle', value: 0.3 }],
  },
  {
    id: 'tech_dispatch_rotation', name: '干部轮换制', branch: 'org', type: 'basic',
    desc: '驻村干部定期轮换，防疲劳也防怠工。', effectDesc: '干部每回合多恢复 1 点精力',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'cadreRegenBonus', value: 1 }],
  },
  {
    id: 'tech_township_link', name: '乡镇联审', branch: 'org', type: 'basic',
    desc: '台账由乡镇两级联审，减少做证明的空间。', effectDesc: '做证明概率 −10',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'fakeProbCut', value: 10 }],
  },
  {
    id: 'tech_rotation', name: '驻村轮训', branch: 'org', type: 'advanced',
    desc: '干部定期回炉充电。', effectDesc: '干部每回合多恢复 1 点精力',
    politicalCapitalCost: 35, requires: ['tech_grid'],
    conditions: { requiredState: { minRound: 8 } },
    effects: [{ kind: 'cadreRegenBonus', value: 1 }],
  },
  {
    id: 'tech_thirdparty', name: '第三方评估常态', branch: 'org', type: 'advanced',
    desc: '把第三方评估做成每季度的固定动作，而不是迎检前的突击。', effectDesc: '做证明概率 −15',
    politicalCapitalCost: 35, requires: ['tech_township_link'],
    conditions: { requiredState: { minFraudCleanStreak: 3 } },
    effects: [{ kind: 'fakeProbCut', value: 15 }],
  },
  {
    id: 'tech_iron_org', name: '铁腕问责', branch: 'org', type: 'extreme',
    desc: '限时办结、末位约谈。执行速度翻倍，干部弦崩到最紧。', effectDesc: '摸排耗能 −2',
    penaltyDesc: '干部疲劳翻倍，过劳倒下概率大增',
    politicalCapitalCost: 45, requires: ['tech_rotation'],
    conditions: { requiredState: { minFatigue: 70 }, requiredEvents: ['cadreSlack'] },
    effects: [{ kind: 'surveyCostCut', value: 2 }],
    penalty: { kind: 'fatigueDouble', value: 1, desc: '干部疲劳每回合翻倍' },
  },
  {
    id: 'tech_beautify_org', name: '台账美化', branch: 'org', type: 'taboo',
    desc: '把数字做得好看，比把事做好容易。', effectDesc: '考核进度 +20，做证明概率 −10',
    penaltyDesc: '每回合 5% 概率暗访直接失败',
    politicalCapitalCost: 15, hidden: true,
    conditions: { requiredState: { minCutCornersStreak: 3 } },
    effects: [{ kind: 'checkpointBonus', value: 20 }, { kind: 'fakeProbCut', value: 10 }],
    penalty: { kind: 'auditRisk', value: 0.05, desc: '每回合 5% 概率暗访直接失败' },
  },
  {
    id: 'tech_floor_defense', name: '底线防御', branch: 'org', type: 'advanced',
    desc: '把「不能跌破」写进预算。哪村内生治理要塌，财政先顶上去。', effectDesc: '村内生治理 <20 时自动拨 200 财政锁住底线',
    politicalCapitalCost: 30, requires: ['tech_iron_org'],
    conditions: {},
    effects: [{ kind: 'floorDefense', value: 20 }],
  },
  // ===== 产业（industry）8 节点 =====
  {
    id: 'tech_coldchain', name: '冷链物流', branch: 'industry', type: 'basic',
    desc: '山货不再烂在半路。', effectDesc: '产业项目效果 +15%',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'projectEffectBonus', value: 0.15 }],
  },
  {
    id: 'tech_channel', name: '产销对接', branch: 'industry', type: 'basic',
    desc: '把县里的货对接到城里的渠道。', effectDesc: '渠道强度每回合 +0.5',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'channelGrowthBonus', value: 0.5 }],
  },
  {
    id: 'tech_taper_course', name: '退坡辅导', branch: 'industry', type: 'basic',
    desc: '提前给产业做断奶训练。', effectDesc: '补贴退坡幅度减免 25%',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'taperResist', value: 0.25 }],
  },
  {
    id: 'tech_micro_credit', name: '小额信贷', branch: 'industry', type: 'basic',
    desc: '把银行的网点引到镇上。', effectDesc: '财政每回合 +3',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'fiscalPerRound', value: 3 }],
  },
  {
    id: 'tech_brand', name: '区域品牌', branch: 'industry', type: 'advanced',
    desc: '把云岭的名字打出去。', effectDesc: '渠道强度每回合 +0.5',
    politicalCapitalCost: 35, requires: ['tech_channel'],
    conditions: { requiredState: { minRound: 10 } },
    effects: [{ kind: 'channelGrowthBonus', value: 0.5 }],
  },
  {
    id: 'tech_digitize', name: '大数据穿透', branch: 'industry', type: 'advanced',
    desc: '用数据看清每家每户的真实情况。', effectDesc: '产业项目效果 +20%',
    politicalCapitalCost: 35, requires: ['tech_coldchain'],
    conditions: { requiredState: { minInfoAccuracy: 90, minFraudCleanStreak: 3 } },
    effects: [{ kind: 'projectEffectBonus', value: 0.2 }],
  },
  {
    id: 'tech_loop_industry', name: '全产业链闭环', branch: 'industry', type: 'extreme',
    desc: '从地头到货架全包了。', effectDesc: '补贴退坡减免 100%',
    penaltyDesc: '遇天灾全盘崩溃：每回合概率全部项目停滞',
    politicalCapitalCost: 45, requires: ['tech_brand'],
    conditions: { requiredState: { noStalledProjects: true } },
    effects: [{ kind: 'taperResist', value: 1 }],
    penalty: { kind: 'industryFragile', value: 1, desc: '每回合概率天灾全盘停滞' },
  },
  {
    id: 'tech_fake_ind', name: '虚假招商', branch: 'industry', type: 'taboo',
    desc: '把签不下来的项目先写上墙。', effectDesc: '财政每回合 +15',
    penaltyDesc: '债务每回合 +3',
    politicalCapitalCost: 15, hidden: true,
    conditions: { requiredState: { maxPoliticalCapital: 40 } },
    effects: [{ kind: 'fiscalPerRound', value: 15 }],
    penalty: { kind: 'debtDrift', value: 3, desc: '债务每回合 +3' },
  },
  // ===== 民生（livelihood）8 节点 =====
  {
    id: 'tech_radar', name: '防返贫雷达', branch: 'livelihood', type: 'basic',
    desc: '早发现、早干预。', effectDesc: '返贫预警阈值从 70 提前到 60',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'radarThreshold', value: 10 }],
  },
  {
    id: 'tech_pair', name: '结对帮扶', branch: 'livelihood', type: 'basic',
    desc: '一户一人，帮到底。', effectDesc: '群众信任每回合 +0.3',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'trustTrickle', value: 0.3 }],
  },
  {
    id: 'tech_safety_net', name: '兜底快通道', branch: 'livelihood', type: 'basic',
    desc: '缺劳力的户不用排队，材料齐了当月发钱。', effectDesc: '全县返贫风险每回合 −0.5',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'returnRiskCutAll', value: 0.5 }],
  },
  {
    id: 'tech_public_service', name: '公共服务卡', branch: 'livelihood', type: 'basic',
    desc: '一张卡办好低保医保。', effectDesc: '组织成本比率 −0.05',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'orgCostCut', value: 0.05 }],
  },
  {
    id: 'tech_monitor_all', name: '全域监测', branch: 'livelihood', type: 'advanced',
    desc: '把监测从重点村铺到全县。', effectDesc: '全县返贫风险每回合 −0.5',
    politicalCapitalCost: 35, requires: ['tech_radar'],
    conditions: { requiredState: { minRound: 12 } },
    effects: [{ kind: 'returnRiskCutAll', value: 0.5 }],
  },
  {
    id: 'tech_school_canteen', name: '爱心食堂', branch: 'livelihood', type: 'advanced',
    desc: '村里老人孩子中午有口热饭。', effectDesc: '群众信任每回合 +0.3',
    politicalCapitalCost: 35, requires: ['tech_pair'],
    conditions: { requiredState: { minRound: 15 } },
    effects: [{ kind: 'trustTrickle', value: 0.3 }],
  },
  {
    id: 'tech_extreme_safety', name: '极限兜底', branch: 'livelihood', type: 'extreme',
    desc: '应兜尽兜，一分不少。', effectDesc: '全县返贫风险每回合 −1.5',
    penaltyDesc: '财政每回合 −5',
    politicalCapitalCost: 45, requires: ['tech_monitor_all'],
    conditions: { requiredState: { minPoliticalCapital: 50 } },
    effects: [{ kind: 'returnRiskCutAll', value: 1.5 }],
    penalty: { kind: 'fiscalDrain', value: 5, desc: '财政每回合 −5' },
  },
  {
    id: 'tech_paper_liv', name: '数字脱贫', branch: 'livelihood', type: 'taboo',
    desc: '表格上的贫困已经清零。', effectDesc: '考核进度 +15',
    penaltyDesc: '全县返贫风险每回合 +2',
    politicalCapitalCost: 15, hidden: true,
    conditions: { requiredState: { minCutCornersStreak: 2 } },
    effects: [{ kind: 'checkpointBonus', value: 15 }],
    penalty: { kind: 'returnRiskDrift', value: 2, desc: '全县返贫风险每回合 +2' },
  },
  // ===== 基建（infra）8 节点 =====
  {
    id: 'tech_road_basic', name: '村村通公路', branch: 'infra', type: 'basic',
    desc: '先把路修到每个村口。', effectDesc: '组织成本比率 −0.05',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'orgCostCut', value: 0.05 }],
  },
  {
    id: 'tech_green', name: '生态修复', branch: 'infra', type: 'basic',
    desc: '退耕还林，封山育林。', effectDesc: '生态每回合 +0.5',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'ecoPerRound', value: 0.5 }],
  },
  {
    id: 'tech_water', name: '安全饮水', branch: 'infra', type: 'basic',
    desc: '高山寨子的水窖全部换新。', effectDesc: '全县返贫风险每回合 −0.3',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'returnRiskCutAll', value: 0.3 }],
  },
  {
    id: 'tech_comm', name: '通讯入户', branch: 'infra', type: 'basic',
    desc: '基站上山，信号进家。', effectDesc: '做证明概率 −5',
    politicalCapitalCost: 25, conditions: {},
    effects: [{ kind: 'fakeProbCut', value: 5 }],
  },
  {
    id: 'tech_road_all', name: '全县硬化', branch: 'infra', type: 'advanced',
    desc: '把碎石路全部铺成水泥路。', effectDesc: '组织成本比率 −0.05',
    politicalCapitalCost: 35, requires: ['tech_road_basic'],
    conditions: { requiredState: { minRound: 10 } },
    effects: [{ kind: 'orgCostCut', value: 0.05 }],
  },
  {
    id: 'tech_ecom_station', name: '物流集散点', branch: 'infra', type: 'advanced',
    desc: '每个镇一个集散点，快递隔天到村。', effectDesc: '全县路网与物流覆盖贯通',
    politicalCapitalCost: 35, requires: ['tech_road_all'],
    conditions: { requiredState: { minRound: 14 } },
    effects: [{ kind: 'logisticsAll', value: 1 }],
  },
  {
    id: 'tech_infra_extreme', name: '硬联通', branch: 'infra', type: 'extreme',
    desc: '桥隧齐上，把天堑变通途。', effectDesc: '全县路网与物流覆盖贯通，组织成本比率 −0.05',
    penaltyDesc: '财政每回合 −8',
    politicalCapitalCost: 45, requires: ['tech_ecom_station'],
    conditions: { requiredState: { minRankStreak: 2 } },
    effects: [{ kind: 'logisticsAll', value: 1 }, { kind: 'orgCostCut', value: 0.05 }],
    penalty: { kind: 'fiscalDrain', value: 8, desc: '财政每回合 −8' },
  },
  {
    id: 'tech_face_infra', name: '面子工程', branch: 'infra', type: 'taboo',
    desc: '把工程修在领导看得见的地方。', effectDesc: '组织成本比率 −0.1',
    penaltyDesc: '生态每回合 −1.5',
    politicalCapitalCost: 15, hidden: true,
    conditions: { requiredState: { minRound: 10, maxPoliticalCapital: 35 } },
    effects: [{ kind: 'orgCostCut', value: 0.1 }],
    penalty: { kind: 'ecologyDrift', value: 1.5, desc: '生态每回合 −1.5' },
  },
];

// ----- 超级工程（Wonder，第九节：15 奇观） -----
// 分回合砸财政，建成给永久全局 Buff + 地图剧变；争议类只有面子没有里子。
export const wonders: WonderSpec[] = [
  // 交通 4
  {
    id: 'w_bridge', name: '跨山大桥', category: 'transport',
    desc: '把山那头的寨子和县城连起来。',
    cell: { x: 0, y: 5 }, totalCost: 120, conditions: {},
    bonus: { kind: 'bridgeAllRoads', value: 1, desc: '全县路网贯通（所有地块通公路），组织成本比率 −0.1' },
  },
  {
    id: 'w_tunnel', name: '穿山隧道', category: 'transport',
    desc: '雾岭到县城的车程从两个钟头缩到四十分钟。',
    cell: { x: 5, y: 3 }, totalCost: 150,
    conditions: { requiredState: { minRound: 10 } },
    bonus: { kind: 'logisticsBonus', value: 1, desc: '全县物流覆盖（无需物流站）' },
  },
  {
    id: 'w_roadnet', name: '县域路网提升', category: 'transport',
    desc: '所有县乡道全部提质改造。',
    cell: { x: 2, y: 5 }, totalCost: 130,
    conditions: { requiredState: { minRound: 5 } },
    bonus: { kind: 'orgCostCut', value: 0.1, desc: '组织成本比率 −0.1' },
  },
  {
    id: 'w_wharf', name: '云岭货运码头', category: 'transport',
    desc: '山里货顺江而下。',
    cell: { x: 5, y: 1 }, totalCost: 140,
    conditions: { requiredState: { minRound: 8 } },
    bonus: { kind: 'industryPerRound', value: 1, desc: '每村产业基础每回合 +1' },
  },
  // 产业 4
  {
    id: 'w_agri', name: '现代农科园', category: 'industry',
    desc: '高标准农田，院士工作站挂牌。',
    cell: { x: 5, y: 0 }, totalCost: 150, conditions: {},
    bonus: { kind: 'industryPerRound', value: 1.5, desc: '每村产业基础每回合 +1.5' },
  },
  {
    id: 'w_agripark', name: '国家级农业园', category: 'industry',
    desc: '要和邻县竞标拿下的国家级牌子。',
    cell: { x: 0, y: 4 }, totalCost: 200, hidden: true,
    conditions: { requiredResources: { fiscalFund: 80 }, requiredState: { minRankStreak: 5, noStalledProjects: true } },
    bonus: { kind: 'industryPerRound', value: 2.5, desc: '每村产业基础每回合 +2.5' },
  },
  {
    id: 'w_factory', name: '绿色食品加工园', category: 'industry',
    desc: '把原料变成成品，钱才留得下来。',
    cell: { x: 4, y: 5 }, totalCost: 160,
    conditions: { requiredState: { minVillageIndustry: 60 } },
    bonus: { kind: 'fiscalPerRound', value: 10, desc: '财政每回合 +10' },
  },
  {
    id: 'w_solar', name: '光伏产业园', category: 'industry',
    desc: '荒坡上种太阳。',
    cell: { x: 5, y: 4 }, totalCost: 140,
    conditions: { requiredState: { minEcology: 60 } },
    bonus: { kind: 'ecoPerRound', value: 1.5, desc: '生态每回合 +1.5' },
  },
  // 民生 4
  {
    id: 'w_school', name: '县域职教中心', category: 'livelihood',
    desc: '让年轻人学到手艺再出去。',
    cell: { x: 0, y: 0 }, totalCost: 150, conditions: {},
    bonus: { kind: 'educationAgency', value: 0.5, desc: '每村群众参与每回合 +0.5' },
  },
  {
    id: 'w_hospital', name: '县医院新院区', category: 'livelihood',
    desc: '大病不出县。',
    cell: { x: 1, y: 0 }, totalCost: 180,
    conditions: { requiredState: { minRound: 12 } },
    bonus: { kind: 'trustAll', value: 1, desc: '群众信任每回合 +1' },
  },
  {
    id: 'w_mega_site', name: '万人安置区', category: 'livelihood',
    desc: '把散在深山的人都接下来。清空贫困人口，但每个月的物业供暖都是钱。',
    cell: { x: 4, y: 4 }, totalCost: 240, upkeep: 200, trap: true,
    conditions: { requiredState: { minRound: 33 } },
    bonus: { kind: 'returnRiskCutAll', value: 1, desc: '全县返贫风险每回合 −1（代价：财政每回合 −200）' },
  },
  {
    id: 'w_clinic', name: '乡村卫生室全覆盖', category: 'livelihood',
    desc: '每个村配一名村医。',
    cell: { x: 2, y: 0 }, totalCost: 120,
    conditions: { requiredState: { minRound: 6 } },
    bonus: { kind: 'returnRiskCutAll', value: 0.5, desc: '全县返贫风险每回合 −0.5' },
  },
  // 争议 3
  {
    id: 'w_plaza', name: '脱贫形象广场', category: 'controversy',
    desc: '耗资巨万，只加政治资本，没有实际产出。',
    cell: { x: 3, y: 3 }, totalCost: 100, trap: true, hidden: true,
    conditions: { requiredState: { maxPoliticalCapital: 19 } },
    bonus: { kind: 'pcPerRound', value: 2, desc: '政治资本每回合 +2（除此之外什么也不产出）' },
  },
  {
    id: 'w_tower', name: '云岭地标塔', category: 'controversy',
    desc: '县城的新地标。远处看很气派，账上看很心疼。',
    cell: { x: 0, y: 1 }, totalCost: 130, trap: true, hidden: true,
    conditions: { requiredState: { maxPoliticalCapital: 30 } },
    bonus: { kind: 'pcPerRound', value: 1, desc: '政治资本每回合 +1' },
  },
  {
    id: 'w_photo_wall', name: '攻坚成就展览馆', category: 'controversy',
    desc: '把成绩挂上墙。',
    cell: { x: 1, y: 1 }, totalCost: 90, trap: true,
    conditions: { requiredState: { minRankStreak: 2 } },
    bonus: { kind: 'pcPerRound', value: 1.5, desc: '政治资本每回合 +1.5' },
  },
];

// ----- 人才图鉴（Hero Talent，第九节：26 人，触发式招募） -----
// 人才不再随机抽卡：每个都有触发事件链 + 两难抉择（接受成本 / 拒绝后果）。
export const heroes: HeroSpec[] = [
  {
    id: 'hero_returner', name: '李默', role: '返乡创业青年',
    desc: '在外面跑过货运，会算账也敢想。派驻村产业项目效果 +20%。',
    talentKind: 'agriYield', talentValue: 0.2,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 4 } },
      question: '李默想开电商小店，需要 15 万启动资金。批吗？',
      acceptCosts: { fiscal: 15 }, acceptEffect: '李默入队，派驻村产业项目效果 +20%',
      declinePenalty: '该村群众参与 −3', declineCloses: true,
    },
  },
  {
    id: 'hero_agronomist', name: '赵长耕', role: '高级农技专家',
    desc: '县农科所退休的老把式。派驻村信息精度每回合 +0.5，摸排多揭 3 点雾。',
    talentKind: 'techGuide', talentValue: 3,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 6 } },
      question: '老赵要 10 万农技服务经费才肯出山。',
      acceptCosts: { fiscal: 10 }, acceptEffect: '老赵入队，摸排多揭 3 点雾',
      declinePenalty: '老赵不再接电话', declineCloses: true,
    },
  },
  {
    id: 'hero_organizer', name: '田桂芬', role: '退休老支书',
    desc: '张罗红白事的一把好手。派驻村群众参与每回合 +1，信任 +0.2。',
    talentKind: 'socialGlue', talentValue: 1,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 8 } },
      question: '田桂芬愿意出山，但要求不当摆设，村务要听她的。',
      acceptCosts: { trust: -1 }, acceptEffect: '田桂芬入队，参与+信任每回合提升',
      declinePenalty: '她转身走了', declineCloses: true,
    },
  },
  {
    id: 'hero_shen', name: '沈书记', role: '外调强人',
    desc: '驻村内生治理每回合大涨，但身体是纸糊的。',
    talentKind: 'socialGlue', talentValue: 1,
    flawKind: 'sickCycle', flawValue: 3, flawDesc: '每 3 回合病倒一轮，期间效果失效',
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minVillageStall: 3 } },
      question: '沈书记要求免去现任村支书，并把 50% 的到村资金交给他支配。',
      acceptCosts: { fiscal: 30, trust: -2 }, acceptEffect: '沈书记入队，该村合作社载体与村务由他把持',
      declinePenalty: '他去了邻县', declineCloses: true,
    },
  },
  {
    id: 'hero_liu', name: '表格战神小刘', role: '迎检专员',
    desc: '免除全部迎检惩罚，但下乡摸排效率极低。',
    talentKind: 'inspectionImmune', talentValue: 1,
    flawKind: 'surveyWeak', flawValue: 4, flawDesc: '摸排少揭 4 点雾',
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minFatigue: 50 } },
      question: '小刘愿意来，但明说不下乡：表他来填，活别人干。',
      acceptCosts: { fiscal: 8 }, acceptEffect: '迎检负担免疫，摸排变差',
      declinePenalty: '没有影响', declineCloses: false,
    },
  },
  {
    id: 'hero_zhao', name: '老赵头', role: '庄稼把式',
    desc: '农业产量翻倍，但拒绝任何现代农业改造。',
    talentKind: 'agriYield', talentValue: 1,
    flawKind: 'noTech', flawValue: 1, flawDesc: '该村科技型项目加成减半',
    recruit: {
      triggerEvents: ['projectFailure'], conditions: { requiredState: { minRound: 8 } },
      question: '现代农业项目烂尾伤了老赵的心。要 100 万推平大棚并当面道歉，他才肯出山。',
      acceptCosts: { fiscal: 100, trust: -1 }, acceptEffect: '老赵入队，农业产量翻倍',
      declinePenalty: '他闭门谢客', declineCloses: true,
    },
  },
  {
    id: 'hero_postman', name: '陈邮差', role: '乡土信使',
    desc: '跑遍每个寨子，谁家什么情况门儿清。派驻村摸排多揭 4 点雾。',
    talentKind: 'surveyMaster', talentValue: 4,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 5 } },
      question: '陈邮差愿意兼职信息员，每月要 5 万补贴。',
      acceptCosts: { fiscal: 5 }, acceptEffect: '陈邮差入队，摸排多揭 4 点雾',
      declinePenalty: '他继续送他的信', declineCloses: true,
    },
  },
  {
    id: 'hero_herdsman', name: '孙兽医', role: '畜牧兽医',
    desc: '土鸡土猪有个三长两短都找他。派驻村返贫风险每回合 −1。',
    talentKind: 'returnRiskCut', talentValue: 1,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 6 } },
      question: '孙兽医想开个兽药站，缺 8 万周转。',
      acceptCosts: { fiscal: 8 }, acceptEffect: '孙兽医入队，返贫风险下降',
      declinePenalty: '他去了镇上的养殖场', declineCloses: true,
    },
  },
  {
    id: 'hero_mason', name: '周瓦匠', role: '泥瓦匠师傅',
    desc: '带出过一支施工队。派驻安置点凝聚力每回合 +2。',
    talentKind: 'cohesionBoost', talentValue: 2,
    recruit: {
      triggerEvents: ['cohesionRiot'], conditions: { requiredState: { minRound: 33 } },
      question: '周瓦匠愿意管安置点的维修队，要个正式名分。',
      acceptCosts: { fiscal: 6 }, acceptEffect: '周瓦匠入队，安置点凝聚力提升',
      declinePenalty: '安置点凝聚力 −5', declineCloses: true,
    },
  },
  {
    id: 'hero_song', name: '吴山歌', role: '山歌队长',
    desc: '嗓子一亮，谁家不痛快都能劝开。该村驻村干部士气每回合 +1。',
    talentKind: 'moraleAura', talentValue: 1,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 9 } },
      question: '吴山歌要办山歌队，批 4 万置办行头。',
      acceptCosts: { fiscal: 4 }, acceptEffect: '吴山歌入队，士气提升',
      declinePenalty: '没有影响', declineCloses: false,
    },
  },
  {
    id: 'hero_finance', name: '钱所长', role: '退休财政所长',
    desc: '抠门了一辈子。全局财政每回合 +3。',
    talentKind: 'fiscalEfficiency', talentValue: 3,
    recruit: {
      triggerEvents: ['eventFileResolved'], conditions: { requiredState: { minRound: 12 } },
      question: '钱所长愿意当顾问，条件是所有超 20 万的支出要他过目。',
      acceptCosts: { politicalCapital: -2 }, acceptEffect: '钱所长入队，财政增收',
      declinePenalty: '他去带孙子了', declineCloses: true,
    },
  },
  {
    id: 'hero_teacher', name: '郑老师', role: '支教老师',
    desc: '在村小教了十年。派驻村群众参与每回合 +1。',
    talentKind: 'socialGlue', talentValue: 0.5,
    recruit: {
      triggerEvents: ['storyStage'], conditions: { requiredState: { minRound: 10 } },
      question: '郑老师希望村里重修操场。',
      acceptCosts: { fiscal: 12 }, acceptEffect: '郑老师入队，参与提升',
      declinePenalty: '她申请调走了', declineCloses: true,
    },
  },
  {
    id: 'hero_machinist', name: '冯农机手', role: '农机手',
    desc: '旋耕机收割机都会开。派驻村产业项目效果 +30%。',
    talentKind: 'agriYield', talentValue: 0.3,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 7 } },
      question: '冯农机手想组农机合作社，要 15 万买二手收割机。',
      acceptCosts: { fiscal: 15 }, acceptEffect: '冯农机手入队，项目效果提升',
      declinePenalty: '他去了邻县的农机队', declineCloses: true,
    },
  },
  {
    id: 'hero_weaver', name: '竹编艺人老许', role: '非遗传承人',
    desc: '一双巧手，竹丝能卖大价钱。派驻村渠道强度每回合 +0.8。',
    talentKind: 'agriYield', talentValue: 0.15,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 11 } },
      question: '老许要 6 万建竹编工坊，带村里妇女一起干。',
      acceptCosts: { fiscal: 6 }, acceptEffect: '老许入队，竹编工坊开业',
      declinePenalty: '工坊黄了', declineCloses: true,
    },
  },
  {
    id: 'hero_liaison', name: '林联络员', role: '外出务工联络员',
    desc: '在广东的工厂群里人头熟。派驻村搬迁户退出意愿每回合 +2。',
    talentKind: 'relocateBoost', talentValue: 2,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 20 } },
      question: '林联络员要 3 万路费，年后带 50 个老乡出去。',
      acceptCosts: { fiscal: 3 }, acceptEffect: '林联络员入队，退出意愿提升',
      declinePenalty: '他年后自己走了', declineCloses: true,
    },
  },
  {
    id: 'hero_weather', name: '高气象员', role: '山洪监测员',
    desc: '看云识天气，比天气预报还准。派驻村返贫风险每回合 −1.5。',
    talentKind: 'returnRiskCut', talentValue: 1.5,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 8 } },
      question: '高气象员要一套雨量监测设备。',
      acceptCosts: { fiscal: 9 }, acceptEffect: '高气象员入队，返贫风险下降',
      declinePenalty: '他继续义务监测', declineCloses: false,
    },
  },
  {
    id: 'hero_doctor', name: '何老中医', role: '坐堂老中医',
    desc: '疑难杂症找他，药费减半。派驻村返贫风险每回合 −1。',
    talentKind: 'returnRiskCut', talentValue: 1,
    recruit: {
      triggerEvents: ['eventFileResolved'], conditions: { requiredState: { minRound: 9 } },
      question: '何老中医要 5 万重建药房。',
      acceptCosts: { fiscal: 5 }, acceptEffect: '何老中医入队，返贫风险下降',
      declinePenalty: '他收了医箱', declineCloses: true,
    },
  },
  {
    id: 'hero_soldier', name: '秦班长', role: '复员军人',
    desc: '带队伍是把好手。该村驻村干部士气每回合 +1.5。',
    talentKind: 'moraleAura', talentValue: 1.5,
    recruit: {
      triggerEvents: ['cadreBurnout'], conditions: { requiredState: { minRound: 12 } },
      question: '秦班长愿意驻村，要一个正式的任命。',
      acceptCosts: { politicalCapital: -1 }, acceptEffect: '秦班长入队，士气提升',
      declinePenalty: '他回城找了工作', declineCloses: true,
    },
  },
  {
    id: 'hero_officer', name: '马村官', role: '大学生村官',
    desc: '电脑手机样样通。派驻村群众参与每回合 +0.8。',
    talentKind: 'socialGlue', talentValue: 0.8,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 5 } },
      question: '马村官任期将满，续任要 2 万安家费。',
      acceptCosts: { fiscal: 2 }, acceptEffect: '马村官入队，参与提升',
      declinePenalty: '她考走了', declineCloses: true,
    },
  },
  {
    id: 'hero_broker', name: '徐果贩', role: '果园经纪人',
    desc: '城里的果商都认他。派驻村产业项目效果 +25%。',
    talentKind: 'agriYield', talentValue: 0.25,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 10 } },
      question: '徐果贩要 10 万包销定金周转。',
      acceptCosts: { fiscal: 10 }, acceptEffect: '徐果贩入队，项目效果提升',
      declinePenalty: '他少跑这村', declineCloses: false,
    },
  },
  {
    id: 'hero_carpenter', name: '唐木匠', role: '木工队队长',
    desc: '手底下十来个木工。派驻安置点凝聚力每回合 +1.5。',
    talentKind: 'cohesionBoost', talentValue: 1.5,
    recruit: {
      triggerEvents: ['cohesionRiot'], conditions: { requiredState: { minRound: 33 } },
      question: '唐木匠要 7 万给木工队买设备。',
      acceptCosts: { fiscal: 7 }, acceptEffect: '唐木匠入队，凝聚力提升',
      declinePenalty: '木工队散了', declineCloses: true,
    },
  },
  {
    id: 'hero_accountant', name: '鲁会计', role: '退休会计师',
    desc: '一本账算得清。全局财政每回合 +2。',
    talentKind: 'fiscalEfficiency', talentValue: 2,
    flawKind: 'greedyCost', flawValue: 1, flawDesc: '每回合要 1 万顾问费',
    recruit: {
      triggerEvents: ['eventFileResolved'], conditions: { requiredState: { minRound: 14 } },
      question: '鲁会计要签顾问合同：每月 1 万，先付半年。',
      acceptCosts: { fiscal: 6 }, acceptEffect: '鲁会计入队，账目清晰',
      declinePenalty: '他去给镇上的企业做账了', declineCloses: true,
    },
  },
  {
    id: 'hero_troupe', name: '白团长', role: '剧团团长',
    desc: '锣鼓一响，全村都来。该村驻村干部士气每回合 +1。',
    talentKind: 'moraleAura', talentValue: 1,
    recruit: {
      triggerEvents: ['villagerInitiative'], conditions: { requiredState: { minRound: 8 } },
      question: '白团长要 3 万排一台新戏。',
      acceptCosts: { fiscal: 3 }, acceptEffect: '白团长入队，士气提升',
      declinePenalty: '没有影响', declineCloses: false,
    },
  },
  {
    id: 'hero_nurse', name: '叶护士', role: '返乡护士',
    desc: '大医院干过十年。派驻村返贫风险每回合 −1。',
    talentKind: 'returnRiskCut', talentValue: 1,
    recruit: {
      triggerEvents: ['fogRevealed'], conditions: { requiredState: { minRound: 7 } },
      question: '叶护士要 4 万给村卫生室配设备。',
      acceptCosts: { fiscal: 4 }, acceptEffect: '叶护士入队，返贫风险下降',
      declinePenalty: '她回了城里', declineCloses: true,
    },
  },
  {
    id: 'hero_welder', name: '韩焊工', role: '水电师傅',
    desc: '安置点的水电都归他。派驻村摸排多揭 2 点雾。',
    talentKind: 'surveyMaster', talentValue: 2,
    flawKind: 'coldShoulder', flawValue: 0.5, flawDesc: '该村群众参与每回合 −0.5（脾气臭）',
    recruit: {
      triggerEvents: ['cohesionRiot'], conditions: { requiredState: { minRound: 33 } },
      question: '韩焊工愿意管安置点水电，但说话难听，村民意见大。',
      acceptCosts: { trust: -1 }, acceptEffect: '韩焊工入队，摸排揭雾',
      declinePenalty: '水电继续三天两头坏', declineCloses: true,
    },
  },
  {
    id: 'hero_schoolmaster', name: '退休校长老乔', role: '退休校长',
    desc: '全村的读书人都是他学生。派驻村群众参与每回合 +1。',
    talentKind: 'socialGlue', talentValue: 1,
    recruit: {
      triggerEvents: ['storyStage'], conditions: { requiredState: { minRound: 12 } },
      question: '老乔愿意牵头修村史馆，要 8 万。',
      acceptCosts: { fiscal: 8 }, acceptEffect: '老乔入队，参与提升',
      declinePenalty: '没有影响', declineCloses: false,
    },
  },
  {
    id: 'hero_oldsecretary', name: '老支书', role: '维稳/组织',
    desc: '在村里说一不二的老人。派驻村组织度下降速度减半，全县组织韧性上限 +30；但他凡事都要过问，县里的事你就少操一份心。',
    talentKind: 'orgSlow', talentValue: 0.5,
    extraTalent: { kind: 'resilienceMax', value: 30 },
    flawKind: 'staminaCap', flawValue: 1,
    flawDesc: '凡事过问：玩家个人精力上限 −1',
    recruit: {
      triggerEvents: ['canHoldEvent'], conditions: { requiredState: { minRound: 12 } },
      question: '老支书想回村带一带班子，但他手把手把着，县里的事就没人替你分担了。',
      acceptCosts: { fiscal: 10 }, acceptEffect: '老支书入队：派驻村组织度下降减半，全县韧性上限 +30',
      declinePenalty: '那村内生治理 −5（老支书寒了心）', declineCloses: true,
    },
  },
];

// ----- 奖励配置（与结算分离；陷阱奖励终局标出） -----
export const rewards: RewardConfig[] = [
  // 即时微反馈（每回合 ≤2）
  { id: 'mf_villager_card', type: 'micro', trigger: 'registeredHousehold', effect: 'showVillagerCard', isTrap: false },
  { id: 'mf_accurate_badge', type: 'badge', trigger: 'accurateMatch', effect: 'showAccurateBadge', isTrap: false },
  { id: 'mf_thanks_letter', type: 'micro', trigger: 'highTrustDelta', effect: 'showThanksLetter', isTrap: false },
  { id: 'mf_model_cadre', type: 'micro', trigger: 'solidWork', effect: 'showModelCadre', isTrap: false },
  { id: 'mf_scheduler', type: 'micro', trigger: 'balancedRound', effect: 'showScheduler', isTrap: false },
  // 里程碑（解锁能力/卡牌，非纯资源）
  { id: 'ms_r4_filing', type: 'milestone', trigger: 'round4', effect: 'unlockFiling', isTrap: false },
  { id: 'ms_r12_coop', type: 'milestone', trigger: 'round12', effect: 'unlockCoop', isTrap: false },
  { id: 'ms_r20_collab', type: 'milestone', trigger: 'round20', effect: 'unlockCollab', isTrap: false },
  { id: 'ms_r32_report', type: 'milestone', trigger: 'round32', effect: 'acceptanceReport', isTrap: false },
  { id: 'ms_r35_taper', type: 'milestone', trigger: 'round35', effect: 'taperStart', isTrap: false },
  { id: 'ms_r38_taper', type: 'milestone', trigger: 'round38', effect: 'taperSecond', isTrap: false },
  { id: 'ms_r41_handover', type: 'milestone', trigger: 'round41', effect: 'withdrawReport', isTrap: false },
  { id: 'ms_r50_final', type: 'milestone', trigger: 'round50', effect: 'finalReport', isTrap: false },
  // 陷阱奖励（终局复盘：哪些奖励其实是债）
  { id: 'trap_overcommit', type: 'badge', trigger: 'overachievePromise', effect: 'politicalCapitalBoost', isTrap: true, trapCost: '争先承诺的即时政治资本，是后面每一次督查的债。' },
  { id: 'trap_fast_acceptance', type: 'badge', trigger: 'fastAcceptance', effect: 'fastAcceptanceBoost', isTrap: true, trapCost: '提前摘帽的光环，掩盖了未消化的补贴依赖。' },
  { id: 'trap_high_subsidy', type: 'badge', trigger: 'highSubsidyIndustry', effect: 'industryBoost', isTrap: true, trapCost: '高补贴产业的红火，退坡后变成断崖。' },
  { id: 'trap_full_assessment', type: 'badge', trigger: 'assessmentMaxed', effect: 'assessmentBoost', isTrap: true, trapCost: '拉满的考核密度，换来了迎检负担与做证明行为。' },
  { id: 'trap_full_guarantee', type: 'badge', trigger: 'guaranteeAll', effect: 'guaranteeBoost', isTrap: true, trapCost: '一刀切的全兜底，滋养了逆向激励。' },
  // 连击（G1）
  { id: 'combo_precision', type: 'combo', trigger: 'precisionCombo', effect: 'precisionStreak', isTrap: false },
  { id: 'combo_solid', type: 'combo', trigger: 'solidCombo', effect: 'solidStreak', isTrap: false },
  { id: 'combo_guarantee', type: 'combo', trigger: 'guaranteeCombo', effect: 'guaranteeStreak', isTrap: false },
  { id: 'combo_endogenous', type: 'combo', trigger: 'endogenousCombo', effect: 'endogenousStreak', isTrap: false },
  { id: 'combo_decay', type: 'combo', trigger: 'decayCombo', effect: 'decayStreak', isTrap: false },
];

// ----- 三条户故事线（贯穿 50 回合） -----
export const storylines: StoryLineConfig[] = [
  {
    id: 'laoli',
    householdId: 'hh_yunxi_laoli',
    title: '老李家',
    stages: [
      { trigger: 'registered', textId: 'story_laoli_1', effect: 'trust+3' },
      { trigger: 'covered', textId: 'story_laoli_2', effect: 'trust+5' },
      { trigger: 'participated', textId: 'story_laoli_3', effect: 'trust+8' },
    ],
  },
  {
    id: 'xiaoyang',
    householdId: 'hh_wuling_yang',
    title: '小杨',
    stages: [
      { trigger: 'relocateStart', textId: 'story_xiaoyang_1' },
      { trigger: 'settled', textId: 'story_xiaoyang_2', effect: 'trust+5' },
      { trigger: 'selfReliant', textId: 'story_xiaoyang_3', effect: 'trust+8' },
    ],
  },
  {
    id: 'xiaowang',
    householdId: 'hh_qingshi_wang',
    title: '小王',
    stages: [
      { trigger: 'trained', textId: 'story_xiaowang_1' },
      { trigger: 'started', textId: 'story_xiaowang_2', effect: 'industryBase+5' },
      { trigger: 'leading', textId: 'story_xiaowang_3', effect: 'participation+8' },
    ],
  },
];

// ----- 七种结局 -----
export const endings: EndingSpec[] = [
  { id: 'tagsGone', name: '标签消失', grade: 'S', desc: '贫困的标签不再需要了。不是打赢了一场战争，而是这场战争不再被需要。' },
  { id: 'canHold', name: '接得住', grade: 'A', desc: '外部力量退去之后，村子自己站了起来。触达是能力，接得住才是治理。' },
  { id: 'waveEbb', name: '运动退潮', grade: 'B', desc: '攻坚战打赢了，潮水也退了。基础设施还在，组织网络正在松动。' },
  { id: 'formalismIdle', name: '形式主义空转', grade: 'C', desc: '台账一年比一年厚，村口的路一年比一年旧。数据很好看，日子很难说。' },
  { id: 'debtBurst', name: '债务生态暴雷', grade: 'D', desc: '产业的红火是借来的，退坡之后只剩下一地欠条。' },
  { id: 'bottomLine', name: '底线失守', grade: 'F', desc: '最需要兜底的人被漏掉了。账本上的数字再漂亮，也盖不住那一声叹息。' },
  { id: 'temperature', name: '温度', grade: 'S', desc: '（隐藏结局）数字之外，人记住了你。治理的温度，是这台机器唯一无法量化的产出。', hidden: true },
];
