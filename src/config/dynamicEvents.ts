import type { GameEventConfig, VillageTitle } from '../core/types';

// ============================================================
// §13 动态事件池配置表（条件驱动 + 权重随机；策划只填 JSON）
// 新增事件 = 往这个数组加一条配置，调度器自动按条件与权重抽取。
// ============================================================

export const dynamicEvents: GameEventConfig[] = [
  {
    // 财政吃紧：钱快花光了，干部集体降薪还是硬扛？
    id: 'ev_fiscal_crunch',
    title: '账上快见底了',
    description: '财政所老鲁把账本摊在桌上：下个月工资都发不出来。是压减开支过日子，还是先借钱扛过去？',
    category: 'crisis',
    conditions: [{ target: 'global', metric: 'fiscalFund', operator: '<=', value: 15 }],
    weight: 40,
    cooldownTurns: 4,
    effectsOnAccept: { fiscalFund: 10, trust: -5, formality: -5 },
    effectsOnDecline: { debtRisk: 12, politicalCapital: -6 },
  },
  {
    // 干部过劳：平均疲劳 > 80 才入池。玩家一直双休，这事永远不会发生。
    id: 'ev_burnout_wave',
    title: '办公室的灯连着亮了七宿',
    description: '几名驻村干部在办公桌前趴着睡着了，材料散了一地。县医院来电话：再这么熬，要出人命。',
    category: 'crisis',
    conditions: [{ target: 'cadre', metric: 'avgFatigue', operator: '>', value: 80 }],
    weight: 45,
    cooldownTurns: 6,
    effectsOnAccept: { fatigueAll: -20, moraleAll: 8, fiscalFund: -8 }, // 强制轮休+加班补贴
    effectsOnDecline: { fatigueAll: 10, trust: -5, fatigueEvents: 1 },
  },
  {
    // 宗族宴请：任一村宗族势力 > 60 才入池（村庄目标事件）。
    id: 'ev_clan_banquet',
    title: '族老摆了三桌',
    description: '村里德高望重的几位老人摆酒，请工作队上座。席间话里话外：村里的工程，能不能让本家子弟先干？',
    category: 'opportunity',
    conditions: [{ target: 'village', metric: 'clanPower', operator: '>', value: 60 }],
    weight: 30,
    cooldownTurns: 8,
    targetVillage: true,
    effectsOnAccept: { participation: 8, trust: 4, politicalCapital: 2 }, // 借势动员，公事公办
    effectsOnDecline: { trust: -3, participation: -2 }, // 拂了族老面子
  },
  {
    // 黑天鹅：舆情发酵（权重低，一旦触发伤害高）
    id: 'ev_swan_rumor',
    title: '一条短视频在县里传开了',
    description: '有人把安置点旧房照片配上「扶贫房漏雨」的标题发到网上，评论区已经炸锅。',
    category: 'black_swan',
    conditions: [{ target: 'global', metric: 'fakeProb', operator: '>', value: 30 }],
    weight: 8,
    cooldownTurns: 12,
    effectsOnAccept: { fakeProb: -20, politicalCapital: -4, fiscalFund: -10 }, // 主动核查公开回应
    effectsOnDecline: { fakeProb: 12, trust: -6 },
    delayedEventOnDecline: 'ev_swan_audit', // 瞒着不处理 → 注入暗访组事件
  },
  {
    // 例行：丰收助销
    id: 'ev_routine_harvest',
    title: '山货下来了',
    description: '今年雨水好，各村的山货堆满了院子。收购商压价到往年一半，村支书打电话来讨主意。',
    category: 'routine',
    conditions: [{ target: 'global', metric: 'ecology', operator: '>', value: 60 }],
    weight: 25,
    cooldownTurns: 5,
    effectsOnAccept: { fiscalFund: 5, industryChannel: 4, trust: 2 }, // 组织消费帮扶
    effectsOnDecline: { returnRisk: 3 }, // 山货烂在手里
  },
  {
    // §14 头衔联动（农旅融合）：机遇——百万粉博主打卡
    id: 'ev_influencer_visit',
    title: '百万粉博主进村了',
    description: '一位旅游博主扛着相机进村拍「宝藏古村」，视频还没剪完，评论区已经有人在问路线了。',
    category: 'opportunity',
    conditions: [],
    weight: 35,
    cooldownTurns: 10,
    targetVillage: true,
    requiredSynergyTitle: 'recipe_agri_tourism',
    effectsOnAccept: { fiscalFund: 20, trust: 8, industryChannel: 10 }, // 借势宣传，客流变现
    effectsOnDecline: { trust: -2 }, // 把博主请走了，村民议论纷纷
  },
  {
    // §14 头衔联动（农旅融合）：危机——垃圾围村
    id: 'ev_garbage_crisis',
    title: '游客走后，垃圾围了村',
    description: '人流带来生意，也带来满地包装袋。村口的垃圾池三天就满了，苍蝇乱飞，老人坐在门口直叹气。',
    category: 'crisis',
    conditions: [],
    weight: 30,
    cooldownTurns: 12,
    targetVillage: true,
    requiredSynergyTitle: 'recipe_agri_tourism',
    effectsOnAccept: { fiscalFund: -15, ecology: 10, trust: 4 }, // 紧急建环保设施
    effectsOnDecline: { trust: -8, returnRisk: 6 }, // 视而不见，口碑崩坏
  },
  {
    // §15 头衔联动（春茶名村）：机遇——茶商包山头
    id: 'ev_tea_order',
    title: '茶商来包山头了',
    description: '外地的茶商揣着定金进村，要包下整片茶园。合同递到村委会桌上，村支书拿不定主意。',
    category: 'opportunity',
    conditions: [],
    weight: 32,
    cooldownTurns: 10,
    targetVillage: true,
    requiredSynergyTitle: 'recipe_selenium_tea',
    effectsOnAccept: { fiscalFund: 18, industryChannel: 8, trust: 6 }, // 订单落地，茶价翻着跟头涨
    effectsOnDecline: { trust: -2, returnRisk: 4 }, // 拒绝了定金，明年行情没人说得准
  },
  {
    // §15 头衔联动（直播助农村）：危机——直播翻车
    id: 'ev_live_breakdown',
    title: '直播翻车了',
    description: '昨天那场直播，评论区炸了：有人翻出了三年前的旧账，说村里摆拍。订单退了一半，主播红了眼眶。',
    category: 'crisis',
    conditions: [],
    weight: 28,
    cooldownTurns: 12,
    targetVillage: true,
    requiredSynergyTitle: 'recipe_live_shop',
    effectsOnAccept: { fiscalFund: -10, trust: 5, fakeProb: -8 }, // 连夜发声明+补货，把口碑捞回来
    effectsOnDecline: { trust: -7, returnRisk: 6, industryChannel: -6 }, // 装没看见，直播间凉了
  },
];

/** 连锁事件（延迟爆发）：由 ev_swan_rumor 拒绝时注入 */
export const delayedEvents: GameEventConfig[] = [
  {
    id: 'ev_swan_audit',
    title: '上级暗访组下沉',
    description: '那条视频惊动了市里。暗访组不打招呼，明天就到。',
    category: 'crisis',
    conditions: [],
    weight: 100, // 注入事件必抽（权重 100 且仅此一件时必然命中）
    effectsOnAccept: { politicalCapital: -8, fakeProb: -15 }, // 主动认领问题
    effectsOnDecline: { politicalCapital: -15, trust: -8 }, // 嘴硬到底
  },
];

/** 村庄动态头衔示例（建设组合自动生成） */
export const villageTitles: VillageTitle[] = [
  {
    id: 'title_agri_tourism',
    name: '农旅融合村',
    condition: 'farm>=1 & market>=1 & terrain=深山',
    globalBuff: { outputMul: 0.1, trust: 3 }, // 全县产业产出 +10%、信任 +3
  },
  {
    id: 'title_buyer_route',
    name: '买办中转村',
    condition: 'factory>=2 & logistics>=1 & farm=0',
    globalBuff: { fiscalPerRound: 3, returnRisk: 4 }, // 来钱快，但风险转移进村
  },
];
