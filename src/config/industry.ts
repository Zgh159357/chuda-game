import type { IndustryNode, IndustryTag, ProjectState, SynergyCatalyst, SynergyRecipe } from '../core/types';

// ============================================================
// §14 产业融合引擎 · 配置表
// 程序员只维护「标签 + 配方」，玩家靠自由组合自己炼出流派。
// ============================================================

/** 基础产业设施蓝图（未来村庄沙盘放置用） */
export const industryNodes: IndustryNode[] = [
  { id: 'node_herb', name: '富硒水稻田', tags: ['primary_agri'], baseOutput: 10, cost: 12 },
  { id: 'node_factory', name: '农产品加工厂', tags: ['processing'], baseOutput: 14, cost: 16 },
  { id: 'node_guesthouse', name: '康养民宿', tags: ['service'], baseOutput: 12, cost: 15 },
  { id: 'node_coldchain', name: '冷链物流站', tags: ['logistics'], baseOutput: 8, cost: 14 },
  { id: 'node_pv', name: '光伏板阵列', tags: ['energy'], baseOutput: 6, cost: 18 },
];

/** 已有项目 → 产业标签（沙盘派生 IndustryNode 用） */
export const PROJECT_TAG_MAP: Record<string, IndustryTag[]> = {
  p_yunxi_herb: ['primary_agri'], // 云溪中药材基地
  p_wuling_chicken: ['primary_agri'], // 雾岭土鸡养殖
  p_qingshi_fruit: ['processing'], // 青石果品加工线
  p_xinping_workshop: ['processing'], // 新坪就业车间
  p_wuling_solar: ['energy'], // 雾岭光伏电站
  p_county_ecom: ['logistics', 'service'], // 县电商服务站
};

/** 由项目派生周边产业节点（含产能字段，供瓶颈计算） */
export function deriveIndustryNodes(projects: ProjectState[]): (IndustryNode & { capacity: number })[] {
  return projects
    .filter((p) => PROJECT_TAG_MAP[p.id])
    .map((p) => {
      const spec = industryNodes.find((n) => n.id === PROJECT_TAG_MAP[p.id][0]);
      return {
        id: p.id,
        name: p.name,
        tags: PROJECT_TAG_MAP[p.id],
        baseOutput: spec?.baseOutput ?? 10,
        cost: spec?.cost ?? 12,
        capacity: 20 + Math.round(p.invested * 2), // 产能随投入增长
      };
    });
}

/**
 * §15 本回合商机（催化剂）：让特定配方限时解锁的「天时」。
 * 每回合开局由 rng 抽一张（无商机=抽空）。
 */
export const synergyCatalysts: SynergyCatalyst[] = [
  { id: 'cat_spring', name: '春茶季', matchTag: 'rich_selenium', desc: '明前茶行情来了，富硒地块的限时机会', weight: 1 },
  { id: 'cat_rain', name: '雨季', matchTag: 'non_heritage', desc: '几场透雨，山里的菌子一夜冒头', weight: 1 },
  { id: 'cat_fair', name: '赶集直播节', matchTag: 'idle_houses', desc: '平台大促，闲置老屋变身直播间', weight: 1 },
  { id: 'cat_harvest', name: '秋收开秤', matchTag: 'primary_agri', desc: '粮价走稳，一产地块生意好做', weight: 2 },
];

/**
 * 融合配方（化合反应）。地形/资源/产业标签三方满足即质变。
 * 配方 A 特色农业 / B 农旅融合 / C 光伏农业 / D 电商淘宝村 / E 高山特色药业
 * §15 增补：进化配方（tier 2）、人才联动、商机限时、反面配方。
 */
export const synergyRecipes: SynergyRecipe[] = [
  {
    id: 'recipe_se_agri',
    name: '特色农业',
    requiredResourceTags: ['rich_selenium'],
    requiredIndustryTags: ['primary_agri', 'logistics'],
    outputMultiplier: 2.0,
    specialEffectDesc: '富硒产品产出翻倍，且退坡不再削弱（市场认牌子不认补贴）',
    unlockVillageTitle: '富硒之乡',
  },
  {
    id: 'recipe_agri_tourism',
    name: '农旅融合',
    requiredResourceTags: ['non_heritage', 'idle_houses'],
    requiredIndustryTags: ['service', 'processing'],
    outputMultiplier: 1.8,
    specialEffectDesc: '游客自己走进来：无需公路也能产生收益；但极度害怕泥石流（灾害风险×1.5）',
    unlockVillageTitle: '网红打卡地',
  },
  {
    id: 'recipe_pv_agri',
    name: '光伏农业',
    requiredResourceTags: ['sunlight'],
    requiredIndustryTags: ['energy', 'primary_agri'],
    outputMultiplier: 1.6,
    specialEffectDesc: '一份地赚两份钱（板上发电、板下种药）；前期投入极高',
    unlockVillageTitle: '光伏农业示范村',
  },
  {
    id: 'recipe_ecom_village',
    name: '电商淘宝村',
    requiredResourceTags: ['idle_houses'],
    requiredIndustryTags: ['logistics', 'service'],
    outputMultiplier: 1.5,
    specialEffectDesc: '彻底消除物流距离惩罚；受市场波动影响极大（大起大落）',
    unlockVillageTitle: '电商淘宝村',
  },
  {
    id: 'recipe_herb_mountain',
    name: '高山特色药业',
    requiredResourceTags: [],
    requiredIndustryTags: ['primary_agri', 'processing'],
    requiredTerrain: '深山',
    outputMultiplier: 1.7,
    specialEffectDesc: '喜阴道地药材品质加成：深山里的一产+二产闭环',
    unlockVillageTitle: '高山药谷',
  },

  // ===== §15 进化配方（tier 2：需先炼出基础流派） =====
  {
    id: 'recipe_se_chain',
    name: '富硒产业链',
    requiredResourceTags: ['rich_selenium'],
    requiredIndustryTags: ['primary_agri', 'processing', 'logistics'],
    requiredTitles: ['recipe_se_agri'],
    outputMultiplier: 2.5,
    specialEffectDesc: '从田头到货架全程自有：补贴依赖每回合 −3，市场彻底认牌子',
    unlockVillageTitle: '富硒产业闭环村',
    tier: 2,
    effects: [{ kind: 'subsidyDependence', value: -3, desc: '每回合补贴依赖 −3' }],
  },
  {
    id: 'recipe_cultural_town',
    name: '文旅示范村',
    requiredResourceTags: ['non_heritage', 'idle_houses'],
    requiredIndustryTags: ['service', 'processing', 'logistics'],
    requiredTitles: ['recipe_agri_tourism'],
    outputMultiplier: 2.3,
    specialEffectDesc: '留得住过夜客：游客参与每回合 +1，人气开始反哺村务',
    unlockVillageTitle: '文旅示范村',
    tier: 2,
    effects: [{ kind: 'participation', value: 1, desc: '每回合群众参与 +1' }],
  },

  // ===== §15 人才联动配方 =====
  {
    id: 'recipe_live_shop',
    name: '直播助农',
    requiredResourceTags: ['idle_houses'],
    requiredIndustryTags: ['logistics', 'service'],
    requiredHeroId: 'hero_returner',
    catalystId: 'cat_fair',
    outputMultiplier: 1.9,
    specialEffectDesc: '李默架起手机，老屋变直播间：大促期间收益暴涨（本回合商机「赶集直播节」限时）',
    unlockVillageTitle: '直播助农村',
  },
  {
    id: 'recipe_selenium_tea',
    name: '富硒春茶',
    requiredResourceTags: ['rich_selenium'],
    requiredIndustryTags: ['primary_agri'],
    catalystId: 'cat_spring',
    outputMultiplier: 1.6,
    specialEffectDesc: '明前茶赶上行情节：只在本回合商机「春茶季」能炼出',
    unlockVillageTitle: '春茶名村',
  },
  {
    id: 'recipe_mushroom',
    name: '林下菌业',
    requiredResourceTags: ['non_heritage'],
    requiredIndustryTags: ['primary_agri'],
    requiredTerrain: '深山',
    catalystId: 'cat_rain',
    outputMultiplier: 1.5,
    specialEffectDesc: '雨后的菌子一夜冒头：本回合商机「雨季」限时',
    unlockVillageTitle: '山菌之乡',
  },

  // ===== §15 常规新配方 =====
  {
    id: 'recipe_fertile_processing',
    name: '沃土加工带',
    requiredResourceTags: ['fertile_soil'],
    requiredIndustryTags: ['primary_agri', 'processing'],
    outputMultiplier: 1.5,
    specialEffectDesc: '土肥粮多，加工跟着落地：稳稳的基本盘',
    unlockVillageTitle: '产粮加工村',
    tier: 1,
  },
  {
    id: 'recipe_solar_base',
    name: '光伏治沙',
    requiredResourceTags: ['sunlight'],
    requiredIndustryTags: ['energy'],
    requiredTerrain: '石漠化',
    outputMultiplier: 1.4,
    specialEffectDesc: '板上发电、板下固土：生态每回合 +0.5',
    unlockVillageTitle: '光伏治沙示范村',
    tier: 1,
    effects: [{ kind: 'ecology', value: 0.5, desc: '每回合生态 +0.5' }],
  },

  // ===== §15 反面配方（烂点子成真，警醒玩法） =====
  {
    id: 'recipe_desert_greenhouse',
    name: '石漠化大棚',
    requiredResourceTags: [],
    requiredIndustryTags: ['primary_agri'],
    requiredTerrain: '石漠化',
    outputMultiplier: 0.5,
    specialEffectDesc: '大棚种在石头上，水都渗光：产出腰斩，每回合补贴依赖 +2',
    unlockVillageTitle: '硬种大棚',
    anti: true,
    effects: [{ kind: 'subsidyDependence', value: 2, desc: '每回合补贴依赖 +2' }],
  },
  {
    id: 'recipe_guesthouse_isolated',
    name: '没路的民宿',
    requiredResourceTags: ['non_heritage'],
    requiredIndustryTags: ['service'],
    forbiddenIndustryTags: ['logistics'],
    outputMultiplier: 0.6,
    specialEffectDesc: '老屋好看，客人进不来：没有物流配套的民宿就是空置房',
    unlockVillageTitle: '空置民宿',
    anti: true,
    effects: [{ kind: 'participation', value: -0.5, desc: '每回合群众参与 −0.5' }],
  },
];
