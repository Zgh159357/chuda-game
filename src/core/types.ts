// ============================================================
// 《触达》核心类型 —— 全部机制的数据基础
// 纯类型定义，禁止 import 任何实现。
// ============================================================

// ===== 时间与阶段 =====
export type Round = number; // 1..50
export type Year = number; // 2012..2030
export type Quarter = 1 | 2 | 3 | 4;
export type PhaseId = 'A' | 'B' | 'C' | 'D' | 'E';
export type RoundSpan = 'halfYear' | 'quarter';

// ===== 瞄准 / 措施 / 承诺 / 载体 =====
export type TargetingLevel = 'county' | 'village' | 'household' | 'person';
// 成本倍率 ×1.5 递增：1 / 1.5 / 2.25 / 3.375

export type PovertyTag =
  | 'disease' // 因病
  | 'education' // 因学
  | 'noLabor' // 缺劳力
  | 'noSkill' // 缺技能
  | 'remote' // 偏远
  | 'ecoConstraint'; // 生态约束

export type MeasureId = 'industry' | 'relocate' | 'ecoJob' | 'training' | 'guarantee';
// 五个一批（虚构中性命名）：产业带动 / 易地安置 / 生态岗位 / 能力提升 / 兜底保障

export type CommitmentLevel = 'conservative' | 'standard' | 'overachieve';
export type CoopType = 'ablePerson' | 'partyBranch' | 'enterprise' | 'retail';
export type PlayerAnchor = 'returningStudent' | 'entrusted' | 'local'; // P1 开局三选一

// ===== §12 玩家初始身份（主控提示词：环境与人文阻力） =====
/** 身份三类：返乡大学生 / 退伍军人 / 空降干部。由 PlayerAnchor 映射（见 core/calculations.ts originOf） */
export type PlayerOrigin = 'origin_student' | 'origin_veteran' | 'origin_airdrop';

// ===== 政策卡槽（重构：党建 / 产业 / 民生） =====
export type SlotKind = 'party' | 'industry' | 'livelihood';
export const SLOT_LABELS: Record<SlotKind, string> = {
  party: '党建',
  industry: '产业',
  livelihood: '民生',
};

/** 卡槽草稿：施政方针可显式指派到村（缺省回退自动聚焦） */
export interface SlotDraft {
  cardId: string;
  villageId?: string;
}

// ===== 沙盘规划画区（Zoning，主控提示词：拖拽框选地块规划用途） =====
export type ZoningKind = 'agri' | 'industry' | 'resettle';
export const ZONING_LABELS: Record<ZoningKind, string> = {
  agri: '农业区',
  industry: '产业区',
  resettle: '易地搬迁安置区',
};
/** 单块已规划地块（长期空间决策，随 GameState 持久化） */
export interface ZoningCell {
  x: number;
  y: number;
  kind: ZoningKind;
}
/** 本回合草稿里的一次规划动作（结算时由纯函数并入 state.zoning） */
export interface ZoningAction {
  kind: ZoningKind;
  cells: { x: number; y: number }[];
}

// ===== 物流网络与产业链（Logistics） =====
// ===== §12 地块环境特征（自然环境与人文环境阻力） =====
export type Terrain = '深山' | '石漠化' | '平原' | '丘陵';

export interface EnvironmentTraits {
  terrain: Terrain;
  disasterRisk: number; // 灾害风险 0-100
  clanPower: number; // 宗族势力 0-100
  traditionalIdeology: number; // 传统观念阻力 0-100
  resources: ResourceTag[]; // §14 隐性资源标签（富硒土壤/非遗文化/充足日照…）
}

/** 建筑/项目类型（版画沙盘渲染与产出修正用） */
export type BuildingType = '茅草屋' | '砖瓦房' | '大棚' | '加工厂' | 'wonder_bridge' | 'wonder_relocation';

/** 沙盘地块（派生类型，不持久化：由 state 纯函数计算，UI/store 每次重绘） */
export interface Tile {
  id: string; // `${x},${y}`
  x: number;
  y: number;
  villageId: string | null; // 所属村（县治/安置点/荒野为 null）
  environment: EnvironmentTraits; // 地块环境特征（村庄格取该村环境，其余取默认平原）
  building: BuildingType | null; // 已建成建筑（由项目/奇观派生）
  infoAccuracy: number; // 信息精度 0-100（村庄格取村精度，其余 100）
  road: boolean; // 道路连通性（村/县/安置点格通公路，规划区可延伸机耕道）
  logisticsCovered: boolean; // 物流覆盖（县物流站建成后，通公路的格即被覆盖）
  zoningKind: ZoningKind | null; // 已规划用途
  hasWonder?: 'wonder_bridge' | 'wonder_relocation' | 'wonder_modern_agri' | null; // 该格奇观
  wonderProgress?: number; // 奇观建造进度 0-100（未建 0，建成 100）
}

// ===== §13 高自由度沙盒与动态事件池（主控提示词：创造力引擎） =====
/** 产业链节点类型（自由拼装：农田→加工厂→物流站→市场） */
export type NodeType = 'farm' | 'factory' | 'logistics' | 'market';

/** 村庄动态头衔：由玩家建设组合自动生成（如「农旅融合村」） */
export interface VillageTitle {
  id: string;
  name: string;
  condition: string; // 条件表达式描述，如 "farm>=1&market>=1&terrain=深山"
  globalBuff: Record<string, number>; // 给全县带来的加成
}

/** 状态校验条件（动态事件入池判定） */
export interface EventCondition {
  target: 'global' | 'village' | 'cadre';
  metric: string; // 'fiscalFund' | 'avgFatigue' | 'clanPower' | 'traditionalIdeology' 等
  operator: '<' | '>' | '==' | '<=' | '>=';
  value: number;
}

/** 动态事件分类 */
export type DynamicEventCategory = 'crisis' | 'opportunity' | 'routine' | 'black_swan';

/**
 * 动态事件配置（条件驱动 + 权重随机；替代固定回合触发）。
 * 与 GameEvent（结算产生的事件记录）不同：GameEventConfig 是策划配置表。
 */
export interface GameEventConfig {
  id: string;
  title: string;
  description: string;
  category: DynamicEventCategory;
  conditions: EventCondition[]; // 必须同时满足才进入本回合抽奖池
  weight: number; // 权重（轮盘赌抽中概率）
  cooldownTurns?: number; // 触发后的冷却回合
  targetVillage?: boolean; // true=村庄目标：任一村庄满足即可触发（记录触发村 id）
  requiredSynergyTitle?: string; // §14 头衔联动：仅已解锁该融合配方（recipeId）的村庄可触发
  effectsOnAccept: Record<string, number>;
  effectsOnDecline: Record<string, number>;
  delayedEventOnAccept?: string; // 连锁事件：接受后向未来卡池注入的事件 id（如瞒报→暗访）
  delayedEventOnDecline?: string; // 连锁事件：拒绝后注入
}

/** 抽奖结果（配置 + 命中村庄；村庄事件才有 villageId） */
export interface RolledEvent {
  config: GameEventConfig;
  villageId?: string;
}

// ===== §14 要素标签化与涌现式产业融合（主控提示词：产业融合引擎） =====
/** 地块的隐性资源标签 */
export type ResourceTag = 'fertile_soil' | 'rich_selenium' | 'sunlight' | 'non_heritage' | 'idle_houses';

/** 产业建筑的产出标签 */
export type IndustryTag = 'primary_agri' | 'processing' | 'service' | 'logistics' | 'energy';

/** 产业节点（建筑蓝图：玩家放置/项目派生的产业设施） */
export interface IndustryNode {
  id: string;
  name: string; // 如「富硒水稻」「加工厂」「康养民宿」
  tags: IndustryTag[]; // 一个建筑可以有多个标签
  baseOutput: number;
  cost: number;
}

/**
 * 融合配方（化合反应）：资源标签 + 产业标签 同时满足 → 质变
 */
export interface SynergyRecipe {
  id: string;
  name: string; // 如「农旅融合」「光伏农业」
  requiredResourceTags: ResourceTag[]; // 地块必须有的隐性资源
  requiredIndustryTags: IndustryTag[]; // 周边必须建成的产业标签
  requiredTerrain?: Terrain; // 可选：限定地形（如「高山特色药业」要求深山）
  forbiddenIndustryTags?: IndustryTag[]; // §15 反面配方：有这些标签反而成不了（如民宿没路）
  requiredTitles?: string[]; // §15 进化前置：必须已解锁的配方头衔（tier 2/3）
  catalystId?: string; // §15 商机限时：仅当本回合商机匹配时才能炼出
  requiredHeroId?: string; // §15 人才联动：需要指定人才派驻本村
  outputMultiplier: number; // 产出倍率（反面配方 <1）
  specialEffectDesc: string; // 特殊效果描述
  unlockVillageTitle: string; // 解锁的村庄头衔
  tier?: 1 | 2 | 3; // §15 流派阶位（进化链）
  anti?: boolean; // §15 反面配方（烂点子成真了）
  effects?: SynergyEffect[]; // §15 持有头衔时每回合的持续效果
}

/** §15 流派持续效果类型（持有头衔期间每回合结算） */
export type SynergyEffectKind = 'trust' | 'ecology' | 'returnRisk' | 'subsidyDependence' | 'participation';

export interface SynergyEffect {
  kind: SynergyEffectKind;
  value: number; // 正=增益、负=代价（反面配方写负值）
  desc: string;
}

/** §15 本回合商机（催化剂）：让特定配方限时解锁 */
export interface SynergyCatalyst {
  id: string;
  name: string; // 如「春茶季」「雨季」「直播节」
  matchTag: ResourceTag | IndustryTag; // 撬动的要素标签
  desc: string;
  weight: number; // 轮盘权重（无商机=权重外的空档）
}

/** §15 玩家自建产业设施（沙盘自由组合的落点） */
export interface BuiltNode {
  id: string; // 实例 id（nodeId_villageId_round）
  nodeId: string; // 蓝图 id（industryNodes）
  villageId: string;
  builtRound: number;
}

// ===== 干部特质（Cadre Traits） =====
export interface TraitSpec {
  id: string;
  name: string;
  desc: string;
  positive: boolean; // false=负面特质（过劳获得）
  match?: 'survey' | 'paperwork' | 'mediate' | 'endure'; // 任务匹配类型
}

// ===== 谈判博弈（Negotiation） =====
export interface NegotiationHandSpec {
  id: string;
  name: string;
  desc: string;
  value: number; // 说服力
  cost: { fiscal?: number; stamina?: number; trust?: number }; // 打出成本
}

// ===== 因果律条件引擎（主控提示词第九节：解锁必须基于治理状态+事件链） =====
export interface UnlockCondition {
  requiredResources?: { politicalCapital?: number; fiscalFund?: number };
  requiredState?: {
    minInfoAccuracy?: number; // 全县档案精度下限
    minFatigue?: number; // 全县干部平均疲劳下限
    maxFatigue?: number; // 平均疲劳上限（防过劳解锁）
    maxPoliticalCapital?: number; // 政治资本上限（低于此才触发，如「脱贫广场」）
    minPoliticalCapital?: number;
    minRound?: number;
    maxRound?: number;
    minFraudCleanStreak?: number; // 连续无造假回合数
    minCutCornersStreak?: number; // 连续敷衍回合数（隐式解锁）
    minRankStreak?: number; // 连续考核夺魁回合数（奇观竞标）
    noStalledProjects?: boolean; // 全县 0 烂尾/停滞项目
    minVillageStall?: number; // 某村内生治理停滞回合数
    minVillageIndustry?: number; // 某村产业强度下限
    maxReturnRisk?: number; // 全县平均返贫风险上限
    minEcology?: number;
  };
  requiredEvents?: string[]; // 必须触发过的事件类型（eventHistory 匹配）
}

// ===== 机制树（Tech Tree，第八节基础 + 第九节四流派/极值/禁忌） =====
export type TechBranch = 'org' | 'industry' | 'livelihood' | 'infra';
export type TechNodeType = 'basic' | 'advanced' | 'extreme' | 'taboo';
export type TechEffectKind =
  | 'surveyCostCut' // 摸排耗能 −value（最低 1）
  | 'cadreRegenBonus' // 干部每回合恢复精力 +value
  | 'projectEffectBonus' // 产业项目效果 +value（乘算）
  | 'channelGrowthBonus' // 渠道强度每回合 +value
  | 'radarThreshold' // 返贫预警提前：预警阈值 70 → 70−value
  | 'trustTrickle' // 信任每回合 +value
  | 'checkpointBonus' // 大考进度 +value
  | 'fakeProbCut' // 做证明概率 −value
  | 'fiscalPerRound' // 财政每回合 +value
  | 'taperResist' // 退坡减免：补贴退坡幅度 ×(1−value)
  | 'orgCostCut' // 组织成本比率 −value
  | 'returnRiskCutAll' // 全县返贫风险每回合 −value
  | 'logisticsAll' // 全县路网贯通（含物流覆盖）
  | 'ecoPerRound' // 生态每回合 +value
  | 'floorDefense'; // 底线防御：村内生治理将跌破阈值时自动财政干预锁底（第十节）
export type TechPenaltyKind =
  | 'fatigueDouble' // 干部疲劳翻倍
  | 'industryFragile' // 产业脆弱：每回合概率天灾全盘停滞
  | 'auditRisk' // 暗访风险：每回合概率直接失败
  | 'debtDrift' // 债务每回合 +value
  | 'returnRiskDrift' // 全县返贫风险每回合 +value
  | 'ecologyDrift' // 生态每回合 −value
  | 'fiscalDrain'; // 财政每回合 −value
export interface TechNodeSpec {
  id: string;
  name: string;
  branch: TechBranch;
  type: TechNodeType;
  desc: string;
  effectDesc: string;
  penaltyDesc?: string; // 极值/禁忌的永久代价
  politicalCapitalCost: number; // 解锁消耗的政治资本
  requires?: string[]; // 前置节点
  conditions: UnlockCondition; // 因果律条件（第九节核心）
  hidden?: boolean; // 隐藏节点：条件满足才显现（如禁忌线）
  effects: { kind: TechEffectKind; value: number }[];
  penalty?: { kind: TechPenaltyKind; value: number; desc: string };
}

// ===== 超级工程（Wonder，第八节基础 + 第九节 15 奇观） =====
export type WonderCategory = 'transport' | 'industry' | 'livelihood' | 'controversy';
export type WonderBonusKind =
  | 'bridgeAllRoads' // 全县路网贯通（物流）
  | 'industryPerRound' // 每村产业每回合 +
  | 'educationAgency' // 参与每回合 +
  | 'pcPerRound' // 政治资本每回合 +
  | 'returnRiskCutAll' // 全县返贫风险每回合 −
  | 'logisticsBonus' // 物流覆盖（不建站也有）
  | 'fiscalPerRound' // 财政每回合 +
  | 'trustAll' // 信任每回合 +
  | 'orgCostCut' // 组织成本比率 −
  | 'ecoPerRound'; // 生态每回合 +
export interface WonderSpec {
  id: string;
  name: string;
  category: WonderCategory;
  desc: string;
  cell: { x: number; y: number }; // 沙盘地块
  totalCost: number; // 建成所需财政总投入（玩家分回合投入）
  conditions: UnlockCondition; // 因果律条件（如竞标、险境触发）
  upkeep?: number; // 建成后每回合财政吸血
  trap?: boolean; // 陷阱奇观：只有面子没有里子
  hidden?: boolean; // 条件满足才显现
  bonus: { kind: WonderBonusKind; value: number; desc: string }; // 永久全局 Buff
}
export interface WonderProgress {
  id: string;
  invested: number; // 已投入财政
  built: boolean;
}

// ===== 人才（Hero Talent，第八节基础 + 第九节 25+ 图鉴） =====
export type HeroTalentKind =
  | 'agriYield' // 该村项目效果 ×(1+value)
  | 'socialGlue' // 参与+信任 每回合 +
  | 'techGuide' // 摸排多揭 value 点+精度缓升
  | 'inspectionImmune' // 免迎检惩罚（全局）
  | 'surveyMaster' // 摸排多揭 value 点（大）
  | 'moraleAura' // 该村驻村干部士气每回合 +
  | 'returnRiskCut' // 该村返贫风险每回合 −
  | 'cohesionBoost' // 所在安置点凝聚力每回合 +
  | 'fiscalEfficiency' // 全局：财政每回合 +
  | 'relocateBoost' // 该村 remote 户退出意愿每回合 +
  | 'orgSlow' // §10：该村组织度扣减 ×(1−value)
  | 'resilienceMax'; // §10：全县韧性上限 +value
export type HeroFlawKind =
  | 'sickCycle' // 每 N 回合病倒一轮（效果失效）
  | 'surveyWeak' // 摸排少揭 value 点
  | 'noTech' // 该村科技型项目加成减半
  | 'greedyCost' // 全局：财政每回合 −value
  | 'burnoutFast' // 该村驻村干部疲劳每回合额外 +
  | 'coldShoulder' // 该村参与每回合 −value
  | 'staminaCap'; // §10：玩家个人精力上限 −value（行政精力）
export interface HeroRecruitConfig {
  triggerEvents: string[]; // 触发条件事件链
  conditions?: UnlockCondition; // 附加治理状态条件
  question: string; // 两难选择的问句
  acceptCosts?: { fiscal?: number; politicalCapital?: number; trust?: number };
  acceptEffect: string;
  declinePenalty: string;
  declineCloses?: boolean; // 拒绝后永不再次招募
}
export interface HeroSpec {
  id: string;
  name: string;
  role: string;
  desc: string;
  talentKind: HeroTalentKind;
  talentValue: number;
  extraTalent?: { kind: HeroTalentKind; value: number }; // §10：第二绝活（老支书）
  flawKind?: HeroFlawKind;
  flawValue?: number;
  flawDesc?: string;
  recruit?: HeroRecruitConfig; // 有=触发式招募；无=不再出现（旧随机觉醒废弃）
}
export interface HeroState {
  heroId: string;
  villageId: string; // 当前派驻村（'' = 未派驻）
  recruitRound?: number; // 入队回合（病倒周期用）
}

// ===== §16 产业深度模拟（链主资本博弈 / 飞地腾挪 / 契约化分配 / 物理漏损） =====
/** 链主企业（纵向整合巨头）：落地要补贴、给就业税收，退坡就撤资 */
export interface ChainMaster {
  id: string;
  name: string; // 如「云岭乳业链主」「通海高原蔬菜」
  targetVillageId: string; // 意向投资村（产业禀赋匹配）
  requiredSubsidyPerTurn: number; // 落地后每回合索要的政策补贴
  jobCreation: number; // 创造就业（降该村返贫风险）
  taxRevenue: number; // 每回合税收贡献（进县财政）
  policyDependency: number; // 政策依赖度 0-100：补贴退坡时撤资风险
  isPresent: boolean; // 是否已落地
  settledRound?: number; // 落地回合（退坡风险与退坡时点联动）
  subsidyPaid: number; // 累计已支付补贴（复盘用）
}

/** 飞地抱团：薄弱村出钱入股强村项目——分红到手，但内生产业能力不涨（县域经济痛点） */
export interface EnclaveInvestment {
  id: string;
  sourceVillageId: string; // 薄弱村（出钱的）
  targetVillageId: string; // 强村/产业村（出地出项目的）
  investedCapital: number; // 投入本金（锁定，不可挪回）
  annualDividendRate: number; // 承诺年化分红率（如 0.10 = 10%）
  investedRound: number; // 入股回合
  dividendsPaid: number; // 累计已分红（复盘用）
}

/** 村级飞地持仓快照（挂在源村上，纯函数 calculateEnclaveImpact 的数据源） */
export interface EnclaveHolding {
  investedCapital: number;
  annualDividendRate: number;
  targetVillageId: string;
}

/** 契约化分红条款：把「分多少、怎么分、出事了归谁」写进纸面 */
export interface DistributionContract {
  guaranteedPrice: boolean; // 保底收购价：农户安心，但补贴依赖 +
  premiumSharingToFarmer: number; // 溢价分成给农户的比例 0-100
  collectiveServiceFee: number; // 村集体抽取的管理服务费
  propertyRightsToVillage: boolean; // 产权确权给村集体：极难，但抗风险极强
}

/** 物理基础设施与数字化错位：建了不等于用上了 */
export interface PhysicalInfrastructure {
  coldChainCapacity: number; // 冷链容量（承接能力，单位=项目当量）
  coldChainIdleRate: number; // 冷库空置率 0-1（容量远超实际用量时上升）
  hasSmartAgriApp: boolean; // 是否上线智慧农业 APP
  appAdoptionRate: number; // 村民实际使用率 0-1（低=无效投资）
}

/** 本回合草稿：跨视图累积（UI 层填写，核心层一次性结算） */
export interface DraftState {
  slots: { party?: SlotDraft; industry?: SlotDraft; livelihood?: SlotDraft };
  targetingLevel: TargetingLevel;
  fiscal: number;
  coop: number;
  commitment: CommitmentLevel;
  dispatch: { villageId: string; unitId: string }[];
  householdMeasures: { groupId: string; measureId: MeasureId }[];
  assessment: { density: number; thirdParty: number; directReport: number };
  investigate: string[];
  repair: { projectId: string; mode: 'stopLoss' | 'restructure' | 'changeCarrier' | 'accountability' }[];
  acceptProposal: string[];
  resettle: { groupId: string; siteId: string }[];
  coopChoose: { villageId: string; coopType: CoopType }[];
  skills: string[];
  cadreAssignments: { cadreId: string; villageId: string | null }[];
  surveyVillages: string[];
  eventDecisions: { fileId: string; optionId: 'A' | 'B' | 'C' }[];
  nodeActions: { nodeId: string; actionId: string }[];
  staminaSpent: number; // 本回合已排程的个人精力（UI 只读）
  paperStacksCleared: number; // 迎检文件堆：本回合已清堆数（每堆 1 精力）
  zoning: ZoningAction[]; // 规划画区：本回合框选规划的动作列表
  negotiations: { groupId: string; hands: string[] }[]; // 谈判博弈：钉子户攻坚（每户一场）
  techUnlocks: string[]; // 机制树：本回合解锁的节点 id（耗政治资本）
  wonderInvest: { wonderId: string; amount: number }[]; // 超级工程：本回合财政投入
  heroAssign: { heroId: string; villageId: string }[]; // 人才：本回合派驻调整
  recruitChoices: { heroId: string; accepted: boolean }[]; // 人才两难：本回合抉择（v7 起）
  mentorship: string[]; // §10：本回合指派「传帮带」的村 id
  buildNodes: { nodeId: string; villageId: string }[]; // §15：本回合自建产业设施
  chainInvites: string[]; // §16：本回合邀请落地的链主 id
  enclaveInvest: EnclaveInvestment[]; // §16：本回合新签的飞地入股（本金由源村财政出）
  contractUpdates: Record<string, DistributionContract>; // §16：本回合更新的村分红契约
}

// ===== 干部（主体性实体：精力 / 士气 / 疲劳） =====
export type CadreTitle = '第一书记' | '工作队员' | '机关干部';
export type CadreSpecialty = 'massWork' | 'projectOps' | 'orgBuilding';
export interface Cadre {
  id: string;
  name: string;
  title: CadreTitle;
  homeUnitId: string; // 派出单位
  villageId: string | null; // 当前驻村（null=在县机关待命）
  energy: number; // 精力 0-10
  morale: number; // 士气 0-100
  fatigue: number; // 疲劳度 0-100（>80 过劳）
  specialty: CadreSpecialty;
  skillLevel: 1 | 2 | 3;
  traits: string[]; // 特质 id（擅长调解/填表大师/水土不服…；疲劳极高会新增负面特质）
}

// ===== 瞒报记录（第三方抽查依据） =====
export interface FraudRecord {
  fileId: string;
  round: Round;
}

// ===== 县级 =====
export interface CountyState {
  year: Year;
  quarter: Quarter;
  round: Round;
  phase: PhaseId;
  fiscalFund: number; // 财政资金
  cooperationFund: number; // 协作资金
  cadrePower: number; // 干部行动力（每回合行动资源）
  trust: number; // 群众信任 0-100
  politicalCapital: number; // 政治资本 0-100
  commitment: CommitmentLevel;
  commitmentRound: Round;
  infoAccuracy: number; // 县整体信息精度 0-100
  adminBurden: number; // 行政负担
  debtRisk: number; // 债务风险 0-100
  ecology: number; // 生态 0-100
  orgDensity: number; // 组织密度 0-100
  assessmentDensity: number; // 考核密度 0-100（旋钮一）
  thirdPartyCoverage: number; // 第三方比例 0-100（旋钮二）
  directReport: number; // 群众直报 0-100（旋钮三）
  eastWillingness: number; // 东部意愿 0-100（隐藏值，UI 不直显）
  orgCostRatio: number; // 组织成本比率（派生）
  // 考核反噬（一拍延迟：本回合写入，下回合生效）
  backlash: { inspectionBurden: number; fakeProb: number; outputMul: number };
  // 运行期派生与负担细分
  cadrePerRound: number; // 每回合行动力补充
  formality: number; // 形式主义负担（留痕/做证明）
  meetingBurden: number; // 会议负担
  tableBurden: number; // 填表负担
  inspectionBurden: number; // 迎检负担（当回合）
  pressure: number; // 压力传导值
  formalityPeak: number; // 形式主义峰值（终局记账）
  canHoldIndex: number; // 县级接得住指数（派生）
  relativeMonitor: boolean; // 是否建立相对贫困监测（E 阶段「标签消失」前提）
  lastTargeting: TargetingLevel; // 本回合瞄准等级（行动层写入）
  skillPoints: number; // G3 干部技能树：治理经验点（里程碑回合获得）
  fatigueEvents: number; // 干部过劳事件累计次数（终局记账）
  playerStamina: number; // 组长个人精力（双层视图：批复/节点交互的回合内资源）
  logisticsStation: boolean; // 物流站（产业链闭环的「销路」环节，节点行动修建）
  organizationalResilience: number; // §10 组织韧性（当前值，组织度伤害缓冲池）
  maxResilience: number; // §10 韧性上限（初始 50，老支书 +30）
}

// ===== 村级 =====
export interface VillageState {
  id: string;
  name: string;
  environment: EnvironmentTraits; // §12 地块环境特征（地形/灾害风险/宗族/传统观念）
  infoAccuracy: number; // 0-100
  externalEmbed: number; // 外部嵌入 0-100
  internalGovernance: number; // 内生治理 0-100
  industryBase: number; // 产业基础 0-100
  industryChannel: number; // 渠道强度 0-100
  industryChain: number; // 产业链完整度 0-100
  subsidyDependence: number; // 补贴依赖度 0-100
  returnRisk: number; // 返贫风险 0-100
  collectiveEconomy: number; // 集体经济 0-100
  coopType: CoopType | null;
  dualBindStability: number; // 双绑稳定度（派生）
  canHoldIndex: number; // 接得住指数（派生）
  dispatchedUnitId: string | null;
  participation: number; // 群众参与 0-100
  surveyed: boolean; // 是否已入户摸排（揭开信息迷雾）
  households: HouseholdGroup[];
  projects: string[]; // 项目 id
  industryOutputMul: number; // §10 产业产出乘数（传帮带当回合 =0.7，结算后复位 1）
  governanceShield: number; // §11 治理护盾：按驻村干部数每回合生成，负面事件优先扣护盾
  synergyTitles: string[]; // §14 已解锁的融合配方 id（如 recipe_se_agri）；头衔=配方.unlockVillageTitle
  enclaveInvestments: EnclaveHolding[]; // §17 本村持有的飞地入股（拿分红、损内生）
}

// ===== 户群 =====
export interface HouseholdGroup {
  id: string;
  villageId: string;
  name: string; // 户群代表称呼（虚构），如「老李家」
  tag: PovertyTag;
  population: number;
  laborAbility: number; // 0-1
  exitWillingness: number; // 0-100，隐藏值
  covered: boolean; // 兜底覆盖
  measureId: MeasureId | null; // 已匹配措施
  agency: number; // 主动性隐藏值 0-100
  registered: boolean; // 是否建档立卡
  uncoveredRounds?: number; // 缺劳力户群"已建档未兜底"持续回合（底线计时）
}

// ===== 安置点 =====
export interface ResettlementSite {
  id: string;
  name: string;
  population: number;
  governanceDensity: number; // 治理密度
  livelihoodSelfReliance: number; // 生计自立度 0-100
  orgLayers: number;
  serviceCost: number;
  households: string[]; // 迁入户群 id
  communityCohesion: number; // 社区凝聚力 0-100（融入系统：配套不足会流失）
  facilities: string[]; // 已建配套设施 id（文化广场/就业车间）
}

// ===== 派出单位 =====
export interface DispatchedUnit {
  id: string;
  name: string;
  resourcePool: number; // 资源池
  politicalCredit: number;
  businessPressure: number; // 业务压力 0-100
}

// ===== 项目（P3 烂尾循环） =====
export interface ProjectState {
  id: string;
  name: string;
  villageId: string;
  measureId: MeasureId;
  status: 'active' | 'stalled' | 'broken' | 'recovered';
  subsidyDependence: number; // 0-100
  channelStrength: number; // 0-100
  chainCompleteness: number; // 0-100
  effectBase: number;
  invested: number;
  roundsActive: number;
  failureRound?: Round;
}

// ===== 关系网络 =====
export interface Relationship {
  id: string;
  a: string; // 关键角色/组织 id
  b: string;
  value: number; // -100..100
  label: string; // 如「工作队↔村支书」
}

// ===== 奖励与成就（配置层） =====
export type RewardType = 'micro' | 'milestone' | 'achievement' | 'badge' | 'combo' | 'story';
export interface RewardConfig {
  id: string;
  type: RewardType;
  trigger: string; // 判定键
  effect: string; // 效果键（解锁/加成/叙事）
  isTrap: boolean;
  trapCost?: string;
}
export interface AchievementConfig {
  id: string;
  name: string;
  category: 'governance' | 'tradeoff' | 'mirror' | 'narrative';
  condition: string; // 判定键
  desc: string;
  isNegative: boolean;
}

// ===== 故事线 =====
export interface StoryStage {
  trigger: string;
  textId: string;
  effect?: string;
}
export interface StoryLineConfig {
  id: 'laoli' | 'xiaoyang' | 'xiaowang';
  householdId: string;
  title: string;
  stages: StoryStage[];
}

// ===== 事件文件（公文批阅两难抉择） =====
export type EventOptionTone = 'prudent' | 'costly' | 'fraud';
export interface EventFileTrigger {
  minRound?: Round;
  maxRound?: Round;
  villageId?: string;
  phase?: PhaseId;
}
export interface EventEffectSpec {
  kind: string; // 效果键（由 events.ts 解释）
  value: number;
}
export interface EventOptionSpec {
  id: 'A' | 'B' | 'C';
  label: string; // 批复要点（如「应急资金补偿」）
  desc: string; // 批复内容正文
  effects: EventEffectSpec[];
  tone: EventOptionTone;
  risk?: { kind: 'thirdPartyAudit' | 'trustCrisis' | 'cadreBurnout'; consequence: string };
}
export interface EventFileSpec {
  id: string;
  title: string;
  sender: string;
  urgency: '急' | '平';
  body: string;
  trigger: EventFileTrigger;
  deadlineRounds: number;
  autoWorst: 'A' | 'B' | 'C'; // 逾期未批 → 按此选项自动结算（禁用 C 防 AI 拖死）
  options: EventOptionSpec[];
}

// ===== 事件 =====
export type RiskKind = 'trust' | 'debt' | 'return' | 'org';
export interface VillagerInitiativeEvent {
  type: 'villagerInitiative';
  round: Round;
  source: string; // 村/户群 id
  textId: string;
  proposal?: string; // 村民提的方案（玩家可采纳）
  effectOnAccept?: string;
}
export interface FuzzySignalEvent {
  type: 'fuzzySignal';
  round: Round;
  textId: string;
  riskKind: RiskKind;
  investigated: boolean; // 玩家是否追查过
}
export interface ReturnRiskWarningEvent {
  type: 'returnRiskWarning';
  round: Round;
  villageId: string;
  window: 1 | 2;
}
export interface ProjectFailureEvent {
  type: 'projectFailure';
  round: Round;
  projectId: string;
}
export interface CanHoldEvent {
  type: 'canHoldEvent';
  round: Round;
  villageId: string;
}
export interface CheckpointEvent {
  type: 'checkpoint';
  round: Round;
  checkpointId: CheckpointId;
}
export interface StoryStageEvent {
  type: 'storyStage';
  round: Round;
  storyId: string;
  stageIndex: number;
}
export interface MilestoneEvent {
  type: 'milestone';
  round: Round;
  milestoneId: string;
}
export interface AchievementEvent {
  type: 'achievement';
  round: Round;
  achievementId: string;
  isNegative: boolean;
}
export interface PhaseChangeEvent {
  type: 'phaseChange';
  round: Round;
  phase: PhaseId;
  textId: string;
}
export interface EventFileResolvedEvent {
  type: 'eventFileResolved';
  round: Round;
  fileId: string;
  optionId: 'A' | 'B' | 'C';
}
export interface EventFileExpiredEvent {
  type: 'eventFileExpired';
  round: Round;
  fileId: string;
  optionId: 'A' | 'B' | 'C';
}
export interface CadreBurnoutEvent {
  type: 'cadreBurnout';
  round: Round;
  cadreId: string;
  textId: string;
}
export interface FogRevealedEvent {
  type: 'fogRevealed';
  round: Round;
  villageId: string;
}
export interface FraudCaughtEvent {
  type: 'fraudCaught';
  round: Round;
  textId: string;
}
export type GameEvent =
  | VillagerInitiativeEvent
  | FuzzySignalEvent
  | ReturnRiskWarningEvent
  | ProjectFailureEvent
  | CanHoldEvent
  | CheckpointEvent
  | StoryStageEvent
  | MilestoneEvent
  | AchievementEvent
  | PhaseChangeEvent
  | EventFileResolvedEvent
  | EventFileExpiredEvent
  | CadreBurnoutEvent
  | FogRevealedEvent
  | FraudCaughtEvent
  | CohesionRiotEvent
  | CohesionCrisisEvent
  | ChainStallEvent
  | NegotiationEvent
  | NegTraitEvent
  | TechUnlockEvent
  | WonderCompletedEvent
  | HeroAwakenedEvent
  | RecruitOfferedEvent
  | RecruitAcceptedEvent
  | RecruitDeclinedEvent
  | HeroSickEvent
  | TabooAuditEvent
  | IndustryDisasterEvent
  | CadreSlackEvent
  | FloorDefenseEvent
  | ResilienceAbsorbedEvent
  | GovernanceShieldAbsorbedEvent
  | SynergyUnlockedEvent
  | ChainWithdrawEvent
  | EnclaveDividendEvent
  | InfraWasteEvent;

export interface CohesionRiotEvent {
  type: 'cohesionRiot';
  round: Round;
  textId: string;
}
export interface CohesionCrisisEvent {
  type: 'cohesionCrisis';
  round: Round;
  textId: string;
}
export interface ChainStallEvent {
  type: 'chainStall';
  round: Round;
  textId: string;
  projectId: string;
  missing: ('supply' | 'road' | 'logistics')[];
}
export interface NegotiationEvent {
  type: 'negotiation';
  round: Round;
  textId: string;
  groupId: string;
  won: boolean;
}
export interface NegTraitEvent {
  type: 'negTrait';
  round: Round;
  textId: string;
  cadreId: string;
}
export interface TechUnlockEvent {
  type: 'techUnlock';
  round: Round;
  nodeId: string;
}
export interface WonderCompletedEvent {
  type: 'wonderCompleted';
  round: Round;
  wonderId: string;
}
export interface HeroAwakenedEvent {
  type: 'heroAwakened';
  round: Round;
  heroId: string;
  villageId: string;
}
export interface RecruitOfferedEvent {
  type: 'recruitOffered';
  round: Round;
  heroId: string;
}
export interface RecruitAcceptedEvent {
  type: 'recruitAccepted';
  round: Round;
  heroId: string;
}
export interface RecruitDeclinedEvent {
  type: 'recruitDeclined';
  round: Round;
  heroId: string;
}
export interface HeroSickEvent {
  type: 'heroSick';
  round: Round;
  heroId: string;
}
export interface TabooAuditEvent {
  type: 'tabooAudit';
  round: Round;
  nodeId: string;
}
export interface IndustryDisasterEvent {
  type: 'industryDisaster';
  round: Round;
  textId: string;
}
export interface CadreSlackEvent {
  type: 'cadreSlack';
  round: Round;
  textId: string;
}
export interface FloorDefenseEvent {
  type: 'floorDefense'; // §10 底线防御触发（全屏红头）
  round: Round;
  villageId: string;
  textId: string;
}
export interface ResilienceAbsorbedEvent {
  type: 'resilienceAbsorbed'; // §10 组织韧性吸收伤害（日志+护盾动画）
  round: Round;
  amount: number;
  textId: string;
}
export interface GovernanceShieldAbsorbedEvent {
  type: 'governanceShieldAbsorbed'; // §11 村治理护盾吸收负面事件冲击
  round: Round;
  villageId: string;
  amount: number;
}
export interface SynergyUnlockedEvent {
  type: 'synergyUnlocked'; // §14 涌现式产业融合：村庄炼出流派配方
  round: Round;
  villageId: string;
  recipeId: string;
}
export interface ChainWithdrawEvent {
  type: 'chainWithdraw'; // §16 链主撤资：补贴退坡撞上政策依赖
  round: Round;
  chainId: string;
  villageId: string;
}
export interface EnclaveDividendEvent {
  type: 'enclaveDividend'; // §16 飞地分红：源村拿到钱，但内生产业没长
  round: Round;
  enclaveId: string;
  amount: number;
}
export interface InfraWasteEvent {
  type: 'infraWaste'; // §16 物理漏损：冷库空转 / APP 没人用
  round: Round;
  textId: string;
}

// ===== 大考 / 失败 / 结局 =====
export type CheckpointId =
  | 'r4_commitmentReview'
  | 'r12_midterm'
  | 'r20_supervision'
  | 'r32_acceptance'
  | 'r35_subsidy'
  | 'r38_subsidy'
  | 'r41_subsidy'
  | 'r41_withdrawal'
  | 'r50_final';
export interface CheckpointResult {
  id: CheckpointId;
  passed: boolean;
  pressureDelta: number;
  politicalCapitalDelta: number;
  report: string; // 文案键
}

export type FailureType =
  | 'bottomLineBreach' // 无劳动能力未兜底
  | 'returnWave' // 规模性返贫失控
  | 'debtCollapse' // 债务生态暴雷
  | 'trustCollapse' // 信任崩盘
  | 'politicalLoss' // 政治资本 <20 且宽限期未挽回
  | 'canHoldCollapse'; // 过渡期接不住村比例 >50%

export type EndingId =
  | 'tagsGone' // S：标签消失
  | 'canHold' // A：接得住
  | 'waveEbb' // B：运动退潮
  | 'formalismIdle' // C：形式主义空转
  | 'debtBurst' // D：债务生态暴雷
  | 'bottomLine' // F：底线失守
  | 'temperature'; // 隐藏：温度结局

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'; // F 仅用于结局「底线失守」
export interface FiveRatings {
  achievement: Grade;
  cost: Grade;
  organization: Grade;
  transition: Grade;
  temperature: Grade;
}

// ===== 四本账 =====
export type LedgerKind = 'achievement' | 'cost' | 'org' | 'transition';
export interface LedgerEntry {
  round: Round;
  kind: LedgerKind;
  key: string;
  value: number;
  note: string;
}
export interface LedgerState {
  entries: LedgerEntry[];
}
export interface LedgerSummary {
  achievement: number;
  cost: number;
  org: number;
  transition: number;
  trapEntries: { rewardId: string; round: Round; cost: number }[];
}

// ===== 行动 / 结算 / 根状态 =====
export interface RoundActions {
  cards: string[]; // 本轮打出的政策卡（旧式：无卡槽；与 slots 取并集）
  slots?: { party?: SlotDraft; industry?: SlotDraft; livelihood?: SlotDraft }; // 政策卡槽（每槽至多 1 张，可指派到村）
  targetingLevel: TargetingLevel;
  fiscal: number; // 本轮财政投入
  coop: number; // 本轮协作资金投入
  commitment?: CommitmentLevel;
  dispatch: { villageId: string; unitId: string }[];
  householdMeasures: { groupId: string; measureId: MeasureId }[];
  assessment?: { density: number; thirdParty: number; directReport: number };
  investigate?: string[]; // P5 追查：信号 textId 或村 id
  repair?: { projectId: string; mode: 'stopLoss' | 'restructure' | 'changeCarrier' | 'accountability' }[];
  acceptProposal?: string[]; // 采纳村民方案（事件 id）
  resettle?: { groupId: string; siteId: string }[]; // 搬迁安置
  coopChoose?: { villageId: string; coopType: CoopType }[]; // 选合作社载体
  skills?: string[]; // G3 干部技能树：本回合解锁的技能 id
  cadreAssignments?: { cadreId: string; villageId: string | null }[]; // 干部驻村 / 召回
  surveyVillages?: string[]; // 入户摸排（揭开迷雾）的村
  eventDecisions?: { fileId: string; optionId: 'A' | 'B' | 'C' }[]; // 公文批复
  nodeActions?: string[]; // 大地图节点交互（县政府交材料/跑财政/调度会/视察安置点）
  abandonUrgent?: boolean; // 急件未批复就收工（放弃批复 → 压力+5、成本账）
  paperStacksCleared?: number; // 迎检文件堆：本回合已清空的堆数（每堆耗 1 个人精力）
  zoning?: ZoningAction[]; // 规划画区：本回合框选规划的用途（结算后并入 state.zoning）
  negotiations?: { groupId: string; hands: string[] }[]; // 谈判博弈：钉子户攻坚
  techUnlocks?: string[]; // 机制树：本回合解锁节点
  wonderInvest?: { wonderId: string; amount: number }[]; // 超级工程：本回合财政投入
  heroAssign?: { heroId: string; villageId: string }[]; // 人才派驻调整
  recruitChoices?: { heroId: string; accepted: boolean }[]; // 人才两难抉择（v7 起）
  mentorship?: string[]; // §10：本回合指派「传帮带」的村 id
  buildNodes?: { nodeId: string; villageId: string }[]; // §15：本回合自建产业设施
  chainInvites?: string[]; // §16：本回合邀请落地的链主 id
  enclaveInvest?: EnclaveInvestment[]; // §16：本回合新签飞地入股
  contractUpdates?: Record<string, DistributionContract>; // §16：本回合更新分红契约
  skip?: boolean; // 跳过部分操作（空转回合）
}

export interface MicroFeedback {
  round: Round;
  rewardId: string;
  textId: string;
}

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface RoundOutcome {
  round: Round;
  state: GameState; // 结算后全量状态
  events: GameEvent[];
  microFeedbacks: MicroFeedback[]; // ≤2
  stars: StarRating;
  checkpoints: CheckpointResult[];
  failures: FailureType[];
  ledgerDelta: LedgerEntry[];
  gameStatus: 'running' | 'ended';
}

export type ComboKind = 'precision' | 'solid' | 'guarantee' | 'endogenous' | 'decay';

export interface GameState {
  version: number; // 存档结构版本
  seed: number;
  status: 'running' | 'ended';
  anchor: PlayerAnchor;
  county: CountyState;
  villages: VillageState[];
  sites: ResettlementSite[];
  units: DispatchedUnit[];
  projects: ProjectState[];
  relationships: Relationship[];
  ledger: LedgerState;
  unlocked: {
    policies: string[];
    achievements: string[];
    milestones: string[];
    skills: string[];
  };
  storylines: { id: string; stageIndex: number }[];
  combo: { streak: number; lastKind: ComboKind | null };
  history: RoundRecord[];
  ending?: EndingId;
  // 运行期内部量
  pcLowRounds: number; // 政治资本 <20 已持续回合数（宽限期计时）
  missedReturnWarnings: number; // 错过的返贫预警窗口数
  trapRewards: { rewardId: string; round: Round; cost: number }[]; // 陷阱奖励记录
  signals: { id: string; round: Round; textId: string; riskKind: RiskKind; investigated: boolean }[];
  pendingProposals: { id: string; round: Round; source: string; textId: string; effectOnAccept?: string }[];
  projectsRepaired: string[];
  projectFailures: { projectId: string; round: Round }[];
  accurateMatches: number; // 标签匹配施策次数（成就计数）
  repairModes: { projectId: string; mode: string }[]; // 修复方式记录（成就计数）
  cadres: Cadre[]; // 干部（重构：主体性实体）
  eventInbox: { fileId: string; deadline: Round }[]; // 待批阅事件文件
  eventFilesSeen: string[]; // 已发过/已结算的事件文件（不再重复发牌）
  fraudRecords: FraudRecord[]; // 瞒报记录（第三方抽查依据）
  zoning: ZoningCell[]; // 沙盘规划画区（长期空间决策，v4 起）
  extraRoads: { x: number; y: number }[]; // 修路行动新增的道路格（v5 起）
  techUnlocked: string[]; // 已解锁机制树节点（v6 起）
  wonders: WonderProgress[]; // 超级工程建设进度（v6 起）
  heroes: HeroState[]; // 已招募人才及其派驻村（v6 起）
  eventHistory: string[]; // 事件链史（v7 起，第九节因果律引擎用，只存事件类型）
  streaks: {
    fraudClean: number; // 连续无造假回合数
    cutCorners: number; // 连续敷衍（选 C）回合数
    rank: number; // 连续考核夺魁回合数
    villageStall: Record<string, number>; // 各村内生治理停滞回合数
  };
  pendingRecruits: { heroId: string; question: string }[]; // 待抉择的人才两难（v7 起）
  declinedRecruits: string[]; // 已拒绝的人才（declineCloses 后不再触发）
  builtNodes: BuiltNode[]; // §15 玩家自建产业设施（沙盘自由组合）
  chainMasters: ChainMaster[]; // §16 链主企业（落地/撤资状态）
  enclaves: EnclaveInvestment[]; // §16 飞地抱团入股（跨村资本）
  distributionContracts: Record<string, DistributionContract>; // §16 各村分红契约
  physicalInfra: PhysicalInfrastructure; // §16 冷链与数字化错位
}

export interface RoundRecord {
  round: Round;
  outcome: Omit<RoundOutcome, 'state'>;
  stateSnapshot: GameState;
}

// ===== 随机 =====
export type Rng = () => number; // [0,1)

// ===== 配置 =====
export interface FormulasConfig {
  projectEffect: {
    infoFactorPer10: number; // 信息精度每 10 点对效果的加成
    diminishing: number; // 边际递减系数（连续投资）
    riskPenaltyPer10: number; // 返贫风险惩罚
  };
  adminCost: {
    targetingMultiplier: Record<TargetingLevel, number>;
    infoFactorDiv: number; // 1 + 精度/200
  };
  dualBind: {
    enterprise: number; // 0.4
    coop: number; // 0.3
    farmer: number; // 0.2
    party: number; // 0.1
    subsidy: number; // 0.5
  };
  canHold: {
    governance: number; // 0.4
    industry: number; // 0.3
    collective: number; // 0.2
    participation: number; // 0.1
    subsidy: number; // 0.4
    threshold: number; // 40
  };
  assessment: {
    backlashThreshold: number; // 60
    burdenPerPoint: number; // 0.8
    fakeProbPerPoint: number; // 1.5
    outputMul: number; // 0.95
  };
  orgCost: { floor: number }; // max(1, 产出)
  trust: {
    formalismPenalty: number; // 0.5
    forcedExitPenalty: number; // 强制退出的信任惩罚
    saturationFloor: number; // 信任接近 100 时的保底增长倍率
  };
  pressure: {
    perLayer: number; // 1.1
    infoDecay: number; // 0.95
    windowMinus: number; // 1
    baseline: number; // 压力基线，高于它才会被消解
    reliefRate: number; // 高出基线部分每回合回落比例
  };
  cadre: {
    maxEnergy: number; // 精力上限 10
    baseRegen: number; // 每回合基础恢复
    fatigueRegenPenalty: number; // 每 40 疲劳少恢复 1 点
    lowMoraleThreshold: number; // 士气低于此值再少恢复 1 点
    baseFatiguePerRound: number; // 每回合基础疲劳积累
    burnoutThreshold: number; // 疲劳超过此值触发过劳
    burnoutMoralePenalty: number; // 过劳后士气损失
    burnoutFatigueRelief: number; // 过劳后疲劳回落
    burnoutTrustHit: number; // 过劳对信任的冲击
    moveEnergyCost: number; // 干部换岗耗精力
    surveyEnergyCost: number; // 有驻村干部的村摸排耗精力
    surveyEnergyCostNoCadre: number; // 无驻村干部的村摸排耗精力
    surveyFatigue: number; // 摸排带来的疲劳
    surveyInfoGain: number; // 首次摸排信息精度提升
    surveyInfoGainRepeat: number; // 重复摸排信息精度提升
    fogRevealThreshold: number; // 精度≥此值揭雾（致贫标签显现）
    fogPreciseThreshold: number; // 精度≥此值完全清晰（数值精确）
    blindMeasureMul: number; // 全盲施策效果倍率
    halfBlindMeasureMul: number; // 半盲施策效果倍率
  };
}

export interface PhaseSpec {
  id: PhaseId;
  name: string;
  rounds: [Round, Round];
  roundSpan: RoundSpan;
  orgDensityTarget: [number, number]; // [起, 止]
  orgDensityMode: 'auto' | 'band'; // auto=按曲线走；band=维持区间
  onEnterTextId: string;
}

export interface CheckpointSpec {
  id: CheckpointId;
  round: Round;
  name: string;
  desc: string;
}

export interface MeasureSpec {
  id: MeasureId;
  name: string;
  short: string;
  desc: string;
  matchTags: PovertyTag[]; // 匹配的致贫标签
  cost: number; // 行政/资金成本
  effectBase: number; // 基础效果
}

export interface PolicyCardSpec {
  id: string;
  name: string;
  phase: PhaseId;
  slot: SlotKind; // 政策卡槽：党建/产业/民生
  curse?: boolean; // 补贴诅咒牌：先给分后吸钱，退坡时暴雷
  desc: string;
  cost: { cadre: number; fiscal: number; coop: number };
  effects: { kind: string; target?: string; value: number }[]; // 由 reducer 解释
  combo?: string[]; // 组合技伙伴
}

export interface SkillSpec {
  id: string;
  name: string;
  line: 'massWork' | 'projectOps' | 'orgBuilding';
  level: number; // 1-3
  desc: string;
  effect: { kind: string; value: number };
  cost: number; // 治理经验点
}

/** 大地图节点交互（双层视图：县政府/安置点的个人精力动作） */
export interface NodeActionSpec {
  id: string;
  name: string;
  nodeKind: 'county' | 'site';
  cost: number; // 消耗个人精力
  desc: string;
  effects: { kind: string; value: number; facilityId?: string }[];
}

export interface EndingSpec {
  id: EndingId;
  name: string;
  grade: Grade;
  desc: string;
  hidden?: boolean;
}

export interface Config {
  formulas: FormulasConfig;
  phases: PhaseSpec[];
  checkpoints: CheckpointSpec[];
  measures: MeasureSpec[];
  policies: PolicyCardSpec[];
  skills: SkillSpec[]; // G3 干部技能树
  traits: TraitSpec[]; // 干部特质（正面+负面）
  negotiationHands: NegotiationHandSpec[]; // 谈判博弈手牌
  nodeActions: NodeActionSpec[]; // 大地图节点交互
  techTree: TechNodeSpec[]; // 机制树（主控提示词第八节）
  wonders: WonderSpec[]; // 超级工程（主控提示词第八节）
  heroes: HeroSpec[]; // 人才库（主控提示词第八节）
  eventFiles: EventFileSpec[]; // 公文批阅事件文件库
  achievements: AchievementConfig[];
  rewards: RewardConfig[];
  storylines: StoryLineConfig[];
  endings: EndingSpec[];
  balance: BalanceConfig;
  text: Record<string, string>;
  timeLabels: string[]; // 50 个回合时间标签
}

export interface BalanceConfig {
  cadrePowerPerRound: number;
  fiscalPerRound: number;
  coopPerRound: number;
  initial: {
    fiscalFund: number;
    coopFund: number;
    trust: number;
    politicalCapital: number;
    infoAccuracy: number;
    adminBurden: number;
    debtRisk: number;
    ecology: number;
    orgDensity: number;
    assessmentDensity: number;
    thirdPartyCoverage: number;
    directReport: number;
    eastWillingness: number;
  };
  hardFail: {
    trustFloor: number; // 信任崩盘阈值
    debtCeiling: number; // 债务暴雷阈值
    pcFloor: number; // 20
    pcGraceRounds: number; // 宽限期
    canHoldRatioCeiling: number; // 0.5
    returnRiskFloor: number; // 返贫失控的村风险阈值
    returnWaveMissed: number; // 错过预警窗口数
  };
  subsidyWaves: { round: Round; cut: number }[]; // 退坡三波：每波削减的补贴依赖度
  orgDensity: {
    forcedDropPerRound: number; // D 阶段每回合 −5
    bandMin: number; // 40
    bandMax: number; // 60
  };
  milestoneRounds: Round[];
  stars: { thresholds: [number, number, number, number] };
  villagerEventsPerRound: [number, number]; // [1,3]
  signalsPerRound: [number, number]; // [1,2]
  proposalChance: number;
  playerStaminaMax: number; // 组长个人精力上限
  fileOptionStamina: Record<'A' | 'B' | 'C', number>; // 批复 A/B/C 消耗的个人精力
  paperStackClearCost: number; // 清一堆迎检文件耗的个人精力
  paperStackPressure: number; // 每堆未清文件计入的考核压力
  cohesion: {
    drift: number; // 凝聚力每回合自然流失
    perFacility: number; // 每座配套设施提供的支撑
    riotThreshold: number; // 低于此值触发「聚众闹事」
    crisisThreshold: number; // 低于此值触发「返贫危机」
  };
  heroSpawnChance: number; // 摸排走访触发「人才觉醒」的概率
  tabooAuditChance: number; // 禁忌节点暗访：每回合直接失败概率
  heroSickCycle: number; // 病倒周期（sickCycle 人才每 N 回合病倒一轮）
  industryDisasterChance: number; // industryFragile 天灾：每回合全盘停滞概率
  resilience: {
    initialMax: number; // §10 韧性上限初始值 50
    regenPerRound: number; // 每回合基础恢复 5
    visitBonus: number; // 本回合有入户走访/摸排 → 额外恢复 5
    floorDefenseCost: number; // 底线防御每次紧急干预扣财政 200
    floorDefenseThreshold: number; // 内生治理低于此值触发底线防御 20
  };
  governanceShield: {
    // §11 治理护盾（村级）：按驻村干部数每回合生成，负面事件优先扣盾
    perCadrePerRound: number; // 每名驻村干部每回合生成的护盾值
    max: number; // 单村护盾上限
  };
  economy: {
    // §16 产业深度模拟
    chainWithdrawChance: number; // 政策依赖≥60 且补贴退坡轮次后，每回合撤资概率
    chainWithdrawTrustHit: number; // 撤资对信任的冲击
    enclaveDividendInterval: number; // 飞地每 N 回合分红一次
    coldChainUsagePerProject: number; // 每个 active/recovered 项目占用的冷链容量
    idleRatePenaltyThreshold: number; // 空置率超此值=无效投资（代价账+生态）
    appAdoptionThreshold: number; // APP 使用率低于此值=无效投资
    appAdoptionGrowth: number; // 参与度高时使用率每回合自然增长
    guaranteedPriceSubsidy: number; // 保底收购价带来的补贴依赖（每回合）
    propertyRightsDualBind: number; // 产权确权给村集体→双绑稳定度加成
    premiumTrustPer10: number; // 溢价分成每 10% 带来的信任
    serviceFeeCollectivePerPoint: number; // 服务费每 1 点带来的集体经济
  };
}
