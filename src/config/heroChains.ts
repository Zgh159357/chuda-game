// ============================================================
// §18 人才多阶段招募链（config/heroChains.ts）
// 26 名人才每人一条 HeroRecruitChain：触发条件 + 多阶段选项 + 隐性代价。
// 通用人才由旧式 recruit 数据合成 2 阶段链；
// 招牌人才（沈书记/老赵头/李默/赵长耕/表格战神/老支书）手工深写 3 阶段链。
// 运行时系统只认 heroChains，不再读 hero.recruit。
// ============================================================

import type { HeroRecruitChain, HeroRecruitConfig, RecruitOption } from '../core/types';
import { heroes } from './content';

/** 通用寒暄阶段：三条进门路，成本与失败概率各异 */
const OPENING_OPTIONS: RecruitOption[] = [
  {
    label: '正门自报家门',
    cost: { politicalCapital: 1 },
    failChance: 0.15,
    successEffectDesc: '对方愿意坐下来谈。',
    failEffectDesc: '对方说「县里来的人见多了」，谈话没下文。',
  },
  {
    label: '摆一桌人情饭',
    cost: { funds: 2 },
    failChance: 0.05,
    successEffectDesc: '酒过三巡，话匣子打开。',
    failEffectDesc: '饭吃了，正事没提成。',
  },
  {
    label: '请乡贤引路',
    cost: { targetVillageGovernance: 1 },
    failChance: 0.25,
    successEffectDesc: '有乡贤作保，对方态度松动。',
    failEffectDesc: '乡贤面子不够，反倒欠了人情。',
  },
];

/** 从旧式 recruit 配置合成摊牌阶段选项 */
function bargainOptions(r: HeroRecruitConfig): RecruitOption[] {
  const opts: RecruitOption[] = [
    {
      label: '痛快答应他的条件',
      cost: {
        funds: r.acceptCosts?.fiscal,
        politicalCapital: r.acceptCosts?.politicalCapital,
        trust: r.acceptCosts?.trust,
      },
      failChance: 0.1,
      successEffectDesc: r.acceptEffect,
      failEffectDesc: '条件答应了，对方还要再想想。',
    },
  ];
  if (r.acceptCosts?.fiscal) {
    opts.push({
      label: '讨价还价（出六成）',
      cost: { funds: Math.round((r.acceptCosts.fiscal * 0.6) * 10) / 10 },
      failChance: 0.35,
      successEffectDesc: '对方松了口：六成就六成。',
      failEffectDesc: '对方觉得县里抠门，拂袖而去。',
    });
  }
  opts.push({
    label: '先晾着他，看他急不急',
    cost: {},
    failChance: 0.5,
    successEffectDesc: '对方反而不踏实，主动找了回来。',
    failEffectDesc: '这一晾，对方彻底冷了心。',
  });
  return opts;
}

function triggerOf(r: HeroRecruitConfig) {
  const c = r.conditions?.requiredState;
  return {
    requiredEventFlags: r.triggerEvents.length > 0 ? r.triggerEvents : undefined,
    minRound: c?.minRound,
    minFatigue: c?.minFatigue,
  };
}

/** 通用两阶段链（26 人中 20 人用） */
function genericChain(heroId: string, r: HeroRecruitConfig): HeroRecruitChain {
  return {
    heroId,
    triggerConditions: triggerOf(r),
    recruitSteps: [
      { stepId: 0, promptText: `有人提起${heroName(heroId)}。想请动他，得先过第一关。`, options: OPENING_OPTIONS },
      { stepId: 1, promptText: r.question, options: bargainOptions(r) },
    ],
    declinePenalty: r.declinePenalty,
    declineCloses: r.declineCloses,
  };
}

function heroName(id: string): string {
  return heroes.find((h) => h.id === id)?.name ?? id;
}

// ---- 招牌人才手工深写 ----

const chainShen: HeroRecruitChain = {
  heroId: 'hero_shen',
  triggerConditions: {
    requiredEventFlags: ['villagerInitiative'],
    minVillageStall: 3,
    requiredVillageTrait: 'clan',
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '沈书记是邻县出了名的强人，县城里已经传开：他想换个地方施展。',
      options: [
        { label: '托人带话，先探口风', cost: {}, failChance: 0.2, successEffectDesc: '他回话：云岭县不是不能来。', failEffectDesc: '带话的人不牢靠，风声走了样。' },
        { label: '亲自登门拜访', cost: { politicalCapital: 2 }, failChance: 0.05, successEffectDesc: '他说：你肯亲自来，事情成了一半。', failEffectDesc: '门都没让进。' },
      ],
    },
    {
      stepId: 1,
      promptText: '沈书记开条件了：现任村支书要免，到村资金他要一半的支配权。',
      options: [
        { label: '免村支书，资金权限给一半', cost: { politicalCapital: 4, targetVillageGovernance: 3 }, failChance: 0.2, successEffectDesc: '他点了头，说三天后到岗。', failEffectDesc: '消息走漏，村两委闹翻了天。' },
        { label: '只免村支书，钱不能动', cost: { politicalCapital: 4 }, failChance: 0.45, successEffectDesc: '他勉强答应，但脸色不好看。', failEffectDesc: '他当场翻脸：没权的书记不如不当。' },
      ],
    },
    {
      stepId: 2,
      promptText: '交接那天，他要你当面把话说死：村里的事，县里少插嘴。',
      options: [
        { label: '当众立规矩，互相留余地', cost: { trust: 2 }, failChance: 0.15, successEffectDesc: '沈书记入队。该村内生治理每回合大涨，但政治资本被把持。', failEffectDesc: '他嫌你话没说死，扬长而去。' },
        { label: '嘴上应着，账上盯着', cost: {}, failChance: 0.4, successEffectDesc: '他看出你的算盘，反而敬你三分。', failEffectDesc: '他冷笑：跟我耍心眼，走了。' },
      ],
    },
  ],
  passiveDebuff: { metric: 'politicalCapital', value: 0.3, desc: '沈书记把持村务，县里每回合隐性消耗政治资本 0.3' },
  declinePenalty: '他去了邻县，临走放话「云岭没救了」',
  declineCosts: { trust: 2 },
  declineCloses: true,
};

const chainZhao: HeroRecruitChain = {
  heroId: 'hero_zhao',
  triggerConditions: {
    requiredEventFlags: ['projectFailure'],
    minRound: 8,
    requiredVillageTrait: 'hollow',
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '老赵头蹲在烂尾大棚门口抽旱烟。现代农业项目黄了，他心里堵着一口气。',
      options: [
        { label: '蹲下来，陪他抽一袋', cost: {}, failChance: 0.25, successEffectDesc: '他开口了：年轻人瞎搞，把好地都糟蹋了。', failEffectDesc: '他摆摆手：跟你没话说。' },
        { label: '叫上村主任一起去道歉', cost: { politicalCapital: 1 }, failChance: 0.1, successEffectDesc: '他脸色缓了：领导能认错，少见。', failEffectDesc: '村主任路上说漏了嘴，更糟了。' },
      ],
    },
    {
      stepId: 1,
      promptText: '老赵头开出条件：推平大棚，赔 100 万给各家，县里当面作检讨。',
      options: [
        { label: '照单全收', cost: { funds: 100, trust: 1 }, failChance: 0.1, successEffectDesc: '推土机进场那天，老赵头到场，说「行，我看你是干实事的」。', failEffectDesc: '钱给了，他还不信，说要再看一季。' },
        { label: '只推大棚，赔偿打对折', cost: { funds: 50 }, failChance: 0.5, successEffectDesc: '他哼了一声：也罢。', failEffectDesc: '他扭头就走：一分不能少。' },
      ],
    },
    {
      stepId: 2,
      promptText: '最后一关：他要县里承诺，他带的地不搞「高科技」，只按土法子种。',
      options: [
        { label: '答应，土法子也是法子', cost: {}, failChance: 0.15, successEffectDesc: '老赵头入队：农业产量翻倍，但该村拒绝现代农业改造。', failEffectDesc: '他嫌你应得不痛快。' },
        { label: '劝他试试新技术', cost: { politicalCapital: 2 }, failChance: 0.6, successEffectDesc: '他被说服了，同意边种边看。', failEffectDesc: '他摔了烟袋：又来这一套！' },
      ],
    },
  ],
  passiveDebuff: { metric: 'trust', value: 0.2, desc: '老赵头盯着县里的每一个承诺，每回合隐性消耗信任 0.2' },
  declinePenalty: '他闭门谢客，村里再没人提复耕',
  declineCloses: true,
};

const chainReturner: HeroRecruitChain = {
  heroId: 'hero_returner',
  triggerConditions: {
    requiredEventFlags: ['villagerInitiative'],
    minRound: 4,
    requiredVillageTrait: 'hollow',
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '李默回村了。朋友圈里发了一张老屋照片：想回来做点事，就怕没人接。',
      options: [
        { label: '让驻村队上门聊聊', cost: {}, failChance: 0.2, successEffectDesc: '他打开话匣子：货运平台能通到县里，这事能干。', failEffectDesc: '工作队扑了空，他去镇上看货了。' },
        { label: '拉上他同学一起劝', cost: { funds: 1 }, failChance: 0.1, successEffectDesc: '同学一顿酒，把他心里那点犹豫浇没了。', failEffectDesc: '酒喝了，人还是没松口。' },
      ],
    },
    {
      stepId: 1,
      promptText: '李默说：小店能开，要 15 万启动资金，赚了钱村里分红，赔了他自己认。',
      options: [
        { label: '批 15 万，签对赌协议', cost: { funds: 15 }, failChance: 0.1, successEffectDesc: '李默入队：派驻村产业项目效果 +20%。', failEffectDesc: '他到县里办手续，被窗口卡了一天，心气泄了。' },
        { label: '先给 8 万试水', cost: { funds: 8 }, failChance: 0.4, successEffectDesc: '他咬着牙应了。', failEffectDesc: '他说：要么不做，要做就做像样。' },
      ],
    },
  ],
  declinePenalty: '李默收拾行李又走了，村里年轻人更少了',
  declineCloses: true,
};

const chainAgronomist: HeroRecruitChain = {
  heroId: 'hero_agronomist',
  triggerConditions: {
    requiredEventFlags: ['fogRevealed'],
    minRound: 6,
    minTraffic: 6,
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '赵长耕是县农科所退下来的老把式，现在给邻县当顾问。想请他，得跑一趟。',
      options: [
        { label: '带上一沓问题去请教', cost: {}, failChance: 0.15, successEffectDesc: '他翻着问题清单，眼睛亮了。', failEffectDesc: '他推了推眼镜：没空。' },
        { label: '许一个「技术顾问」的名分', cost: { politicalCapital: 2 }, failChance: 0.05, successEffectDesc: '名分这东西，老同志认。', failEffectDesc: '他摆摆手：虚的不要。' },
      ],
    },
    {
      stepId: 1,
      promptText: '老赵的条件：10 万农技服务经费，成立个服务站，他带着徒弟们干。',
      options: [
        { label: '批 10 万，服务站挂牌', cost: { funds: 10 }, failChance: 0.1, successEffectDesc: '赵长耕入队：摸排多揭 3 点雾，派驻村信息精度每回合 +0.5。', failEffectDesc: '挂牌那天他病了，事情搁下。' },
        { label: '经费分两年给', cost: { funds: 5 }, failChance: 0.45, successEffectDesc: '他叹口气：先干起来吧。', failEffectDesc: '他说经费都抠，还谈什么技术。' },
      ],
    },
  ],
  declinePenalty: '老赵不再接县里的电话',
  declineCloses: true,
};

const chainLiu: HeroRecruitChain = {
  heroId: 'hero_liu',
  triggerConditions: {
    requiredEventFlags: ['fogRevealed'],
    minFatigue: 50,
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '表格战神小刘在全县出名了：迎检那套他闭着眼睛都能填。想挖他，先得让他点头。',
      options: [
        { label: '跟他说：来就是主力', cost: {}, failChance: 0.3, successEffectDesc: '他挠挠头：主力？有意思。', failEffectDesc: '他说：别画饼。' },
        { label: '拿兄弟单位来激他', cost: { politicalCapital: 1 }, failChance: 0.15, successEffectDesc: '他拍桌子：他们那水平也配？我去！', failEffectDesc: '激将法不管用。' },
      ],
    },
    {
      stepId: 1,
      promptText: '小刘明说：表他来填，下乡别找他。每月补助 8 万。',
      options: [
        { label: '答应：迎检归他，摸排归别人', cost: { funds: 8 }, failChance: 0.05, successEffectDesc: '小刘入队：免除迎检惩罚；但摸排效率极低。', failEffectDesc: '他嫌办公桌没靠窗。' },
        { label: '要求他每月下乡两天', cost: { funds: 6 }, failChance: 0.55, successEffectDesc: '他咬牙应了：两天，多一分钟都不行。', failEffectDesc: '他说：那另请高明。' },
      ],
    },
  ],
  passiveDebuff: { metric: 'fiscalFund', value: 0.5, desc: '小刘的耗材报账，每回合隐性消耗财政 0.5' },
  declinePenalty: '没有影响，但迎检的烂摊子还得自己收拾',
  declineCloses: false,
};

const chainOldSecretary: HeroRecruitChain = {
  heroId: 'hero_oldsecretary',
  triggerConditions: {
    requiredEventFlags: ['canHoldEvent'],
    minRound: 12,
    requiredVillageTrait: 'clan',
  },
  recruitSteps: [
    {
      stepId: 0,
      promptText: '老支书在家晒太阳。村里的事他门儿清，就是不肯再出山。',
      options: [
        { label: '提一壶酒上门', cost: { funds: 1 }, failChance: 0.1, successEffectDesc: '他呷了一口：说吧，又碰上什么难事了。', failEffectDesc: '他说：酒放下，人走。' },
        { label: '请村小学的老同事来劝', cost: { targetVillageGovernance: 1 }, failChance: 0.25, successEffectDesc: '老同事一开口，他口气松了。', failEffectDesc: '劝岔了路，他更倔了。' },
      ],
    },
    {
      stepId: 1,
      promptText: '老支书提条件：回村带班子可以，但县里的事他也要过问——你手里能用的劲就少了。',
      options: [
        { label: '应下：村里归他，县里商量着来', cost: { politicalCapital: 3 }, failChance: 0.15, successEffectDesc: '他拍板：就这么定。', failEffectDesc: '他嫌你「商量着来」是敷衍。' },
        { label: '只让他管一摊', cost: { politicalCapital: 1 }, failChance: 0.5, successEffectDesc: '他勉强同意先管一摊。', failEffectDesc: '他摆摆手：半截子的事不做。' },
      ],
    },
    {
      stepId: 2,
      promptText: '最后一关：他要 10 万给村里修族谱祠堂，说是「人心聚起来，比什么都管用」。',
      options: [
        { label: '批了，就当修的是人心', cost: { funds: 10, trust: 1 }, failChance: 0.1, successEffectDesc: '老支书入队：派驻村组织度下降减半、全县韧性上限 +30，但个人精力上限 −1。', failEffectDesc: '祠堂款被截了一截，他查出后大怒。' },
        { label: '劝他把钱投到产业上', cost: { funds: 5 }, failChance: 0.55, successEffectDesc: '他叹气：年轻人不懂。但答应了。', failEffectDesc: '他说：祖宗的账都算不清，还谈产业。' },
      ],
    },
  ],
  passiveDebuff: { metric: 'politicalCapital', value: 0.2, desc: '老支书凡事过问，每回合隐性消耗政治资本 0.2' },
  declinePenalty: '那村内生治理 −5（老支书寒了心）',
  declineCloses: true,
};

// ---- 组装 ----

const SIGNATURE: Record<string, HeroRecruitChain> = {
  hero_shen: chainShen,
  hero_zhao: chainZhao,
  hero_returner: chainReturner,
  hero_agronomist: chainAgronomist,
  hero_liu: chainLiu,
  hero_oldsecretary: chainOldSecretary,
};

/** 26 条招募链（运行时唯一入口） */
export const heroChains: HeroRecruitChain[] = heroes.map((h) => {
  if (SIGNATURE[h.id]) return SIGNATURE[h.id];
  if (!h.recruit) return { heroId: h.id, triggerConditions: {}, recruitSteps: [] };
  return genericChain(h.id, h.recruit);
});

export function chainOf(heroId: string): HeroRecruitChain | undefined {
  return heroChains.find((c) => c.heroId === heroId);
}
