import type { IndustryNode, IndustryTag, ProjectState, SynergyRecipe } from '../core/types';

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
 * 融合配方（化合反应）。地形/资源/产业标签三方满足即质变。
 * 配方 A 特色农业 / B 农旅融合 / C 光伏农业 / D 电商淘宝村 / E 高山特色药业
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
];
