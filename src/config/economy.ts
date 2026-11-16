import type { ChainMaster, DistributionContract, PhysicalInfrastructure } from '../core/types';

// ============================================================
// §16 产业深度模拟配置：链主企业目录 / 默认契约 / 初始基础设施
// 所有企业与数据均为虚构，只映射县域经济结构痛点。
// ============================================================

/** 可引进的链主企业目录（id → 静态档案；落地状态存 GameState.chainMasters） */
export const chainMasterCatalog: Omit<ChainMaster, 'isPresent' | 'subsidyPaid'>[] = [
  {
    id: 'chain_milk',
    name: '云岭乳业链主',
    targetVillageId: 'v_wuling', // 雾岭土鸡养殖 → 乳业联营（虚构）
    requiredSubsidyPerTurn: 12, // 每回合索要的配套补贴
    jobCreation: 18, // 就业岗位
    taxRevenue: 8, // 税收贡献
    policyDependency: 75, // 高依赖：退坡就翻脸
  },
  {
    id: 'chain_veg',
    name: '通海高原蔬菜链主',
    targetVillageId: 'v_yunxi', // 云溪中药材/耕地 → 蔬菜订单
    requiredSubsidyPerTurn: 8,
    jobCreation: 12,
    taxRevenue: 6,
    policyDependency: 55,
  },
  {
    id: 'chain_fruit',
    name: '冷链果品链主',
    targetVillageId: 'v_qingshi', // 青石果品加工线
    requiredSubsidyPerTurn: 10,
    jobCreation: 15,
    taxRevenue: 7,
    policyDependency: 65,
  },
];

/** 默认分红契约（未签约为「口头约定」：全 0 / 无保底 / 无确权） */
export const DEFAULT_CONTRACT: DistributionContract = {
  guaranteedPrice: false,
  premiumSharingToFarmer: 0,
  collectiveServiceFee: 0,
  propertyRightsToVillage: false,
};

/** 初始物理基础设施：冷链 2 容量空置 50%，无智慧农业 APP */
export const INITIAL_INFRA: PhysicalInfrastructure = {
  coldChainCapacity: 2,
  coldChainIdleRate: 0.5,
  hasSmartAgriApp: false,
  appAdoptionRate: 0,
};

/** 契约条款中文标签（UI 用） */
export const CONTRACT_LABELS: Record<keyof DistributionContract, string> = {
  guaranteedPrice: '保底收购价',
  premiumSharingToFarmer: '溢价分成给农户（%）',
  collectiveServiceFee: '村集体服务费',
  propertyRightsToVillage: '产权确权给村集体',
};
