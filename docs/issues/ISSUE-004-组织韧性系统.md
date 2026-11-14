# ISSUE-004 · 组织韧性系统（Resilience）

> 分支建议：`feature/org-resilience`
> 状态：接口与伪代码待用户确认（确认后再改前端，核心层与 UI 同步落地）

## 背景

玩家反馈：组织度（组织密度/内生治理力）下降过快，容易引发死亡螺旋，缺乏策略操作的缓冲空间。

## 目标

1. 引入 **组织韧性（Resilience）** 作为组织度的伤害缓冲池，所有「组织度扣减」先扣韧性。
2. 重写 **挤出效应公式**：驻村工作队对内生治理的影响从「无脑挤出」改为「传帮带指令二选一」。
3. 机制树组织分支新增 **底线防御** 科技：自动止损（财政换底线）。
4. 人才池新增 **老支书**：组织度下降减速 + 韧性上限提升，毒点=耗行政精力。
5. UI：韧性吸收伤害时「青色护盾破碎」动画 + 日志；底线防御触发时全屏红头文件。

---

## 一、数据结构（Zustand 接口定义）

### 1. types.ts（core 真源）

```typescript
// CountyState 新增（韧性是县一级的缓冲池，随县走；故放 county 而非 GameState 顶层）
organizationalResilience: number; // 当前韧性，clamp 0..maxResilience
maxResilience: number;            // 韧性上限，初始 50

// RoundActions 新增
mentorship?: string[];            // 本回合指派「传帮带」的村庄 id 列表

// DraftState 新增
mentorship: string[];             // UI 草稿：勾选传帮带的村

// GameEvent union 新增
| { type: 'floorDefense'; round: number; villageId: string; textId: string }   // 底线防御触发（全屏红头）
| { type: 'resilienceAbsorbed'; round: number; amount: number; textId: string } // 韧性吸收（日志）

// TechEffectKind 新增
| 'floorDefense'     // 底线防御：值=锁定阈值（20）

// HeroTalentKind 新增
| 'orgSlow'          // 组织度下降减速：扣减 ×(1−value)
| 'resilienceMax'    // 韧性上限提升：maxResilience 基础 +value

// HeroFlawKind 新增
| 'staminaCap'       // 行政精力：玩家个人精力上限 −value

// BalanceConfig 新增
resilience: {
  initialMax: 50;         // 初始韧性上限
  regenPerRound: 5;       // 每回合基础恢复
  visitBonus: 5;          // 本回合有「入户走访/摸排」额外恢复
  floorDefenseCost: 200;  // 底线防御每次紧急干预扣财政
  floorDefenseThreshold: 20; // 内生治理触发阈值
};
```

### 2. store.ts（Zustand，只加 UI 草稿）

```typescript
// 草稿（draft）内新增
mentorship: string[];                        // 传帮带指令勾选（村 id）
// actions 新增
toggleMentorship(villageId: string): void;   // 勾选/取消
// selector（派生，不改 core）
resilienceRatio(): number;                   // organizationalResilience / maxResilience（护盾条宽度）
```

---

## 二、结算纯函数伪代码（core）

### 1. 韧性结算 `settleResilience(state, ctx)`（每回合末，settleOrganization 之后）

```
function settleResilience(state, ctx):
  c = state.county
  c.organizationalResilience = clamp(0, c.maxResilience,
      c.organizationalResilience + config.balance.resilience.regenPerRound)
  if 本回合有入户走访（actions.cards 含 'a_visit' 或 actions.surveyVillages 非空）:
      c.organizationalResilience = clamp(0, c.maxResilience,
          c.organizationalResilience + config.balance.resilience.visitBonus)

  // 人才「老支书」：韧性上限提升（动态，不写入 maxResilience 存值）
  c.maxResilience = config.balance.resilience.initialMax
                    + heroSumAll(state, 'resilienceMax') * 30
```

### 2. 伤害缓冲 `applyOrgDamage(state, amount, ctx): { absorbed, real }`（纯函数，组织度扣减的唯一入口）

```
function applyOrgDamage(state, amount, ctx):
  c = state.county
  available = c.organizationalResilience
  absorbed  = min(available, amount)
  real      = amount - absorbed
  c.organizationalResilience -= absorbed
  if absorbed > 0:
      ctx.pushEvent({ type: 'resilienceAbsorbed', amount: absorbed })
      ctx.pushFeedback('resilience_absorb', absorbed)   // 日志：「组织韧性抵挡了 X 点治理力损耗」
  return { absorbed, real }
```

调用方改造（只改扣减路径，不改增长路径）：

| 扣减来源 | 现状（代码核对） | 新行为 |
|---|---|---|
| 外部嵌入挤出（驻村队，organization.ts:21-43） | 有队：内生 `+0.5×(1−externalEmbed/100)`（被挤出）；无队：−1 embed / +0.8 内生 | 见下方挤出新公式（都走 applyOrgDamage） |
| 接不住预警（organization.ts:63-71） | 只加 returnRisk+2 与台账，**不扣内生** | 保持不扣（预警不是伤害） |
| 成本超支（organization.ts:89-91） | orgCostRatio>2 仅记台账，无组织度扣减 | **新增**：orgCostRatio>2 → `applyOrgDamage(2)`，real 部分扣 county.orgDensity |
| 组织密度曲线 D 阶段 −5/回合（phaseMachine） | 政策性退坡 | **不走韧性**（退坡是有意为之的转型成本，被缓冲即消解「运动式不可持续」主题） |

> **口径说明（已定）**：韧性只缓冲「非自愿/意外伤害」（挤出、成本超支、天灾类），不缓冲「政策性退坡」（D 阶段密度 −5、撤队交接）。否则过渡期的代价被护盾吃掉，主题就没了。

### 3. 挤出效应新公式（替换 organization.ts 原挤出段）

```
function settleEmbedding(state, village, ctx):
  hasTeam = village.dispatchedUnitId !== null
  if not hasTeam: return            # 无驻村队：不挤出（原 +0.8 内生增长保留不变）

  if village.id in actions.mentorship:        # 指派了「传帮带」
      village.internalGovernance = min(100, village.internalGovernance + 1)   # 不降反升
      village.industryOutputMul = 0.7          # 该村本回合产业产出 −30%（settleIndustry 乘算）
      ctx.pushFeedback('mentorship_on', village.id)
  else:                                        # 未指派
      { absorbed, real } = applyOrgDamage(state, 2, ctx)
      village.internalGovernance = max(0, village.internalGovernance - real)  # 先扣韧性
```

### 4. 底线防御 `settleFloorDefense(state, ctx)`（settleOrganization 之后，每回合至多 1 次）

```
function settleFloorDefense(state, ctx):
  if techSum(state, 'floorDefense') <= 0: return    # 未解锁「底线防御」
  threshold = config.balance.resilience.floorDefenseThreshold  # 20
  candidates = state.villages.filter(v => v.internalGovernance < threshold)
  if candidates.empty: return

  # 优先干预内生治理最低的村
  v = minBy(candidates, internalGovernance)
  if state.county.fiscalFund >= config.balance.resilience.floorDefenseCost:  # 200
      state.county.fiscalFund -= 200
      v.internalGovernance = max(v.internalGovernance, threshold)  # 锁 20
      ctx.pushEvent({ type: 'floorDefense', villageId: v.id })      # → UI 全屏红头文件
      ctx.pushLedger('org', 'floorDefense', -8, '紧急维稳拨款：买回底线')
      ctx.addStars(-5)                                              # 花钱保底不是胜利
  else:
      # 财政枯竭：底线干预失败，仅记录（真实扣减仍由其他系统执行）
      ctx.pushEvent({ type: 'floorDefense', villageId: v.id, textId: 'floor_defense_fail' })
```

### 5. 人才「老支书」配置

```
hero_oldsecretary = {
  id: 'hero_oldsecretary', name: '老支书', role: '维稳/组织',
  talentKind: 'orgSlow', talentValue: 0.5,
  extraTalent: { kind: 'resilienceMax', value: 1 },   // maxResilience +30
  flawKind: 'staminaCap', flawValue: 1,               // 玩家个人精力上限 −1（见换算说明）
  recruit: {
    triggerEvents: ['canHoldEvent'],                  // 触发过「接不住预警」才来请
    conditions: { requiredState: { minRound: 12 } },
    question: '老支书想回村带一带班子，但他手把手把着，县里的事就没人替你分担了。',
    acceptCosts: { fiscalFund: 10 },
    acceptEffect: '入队；派驻村组织度下降减半；全县韧性上限 +30；个人精力上限 −1',
    declinePenalty: '那村内生治理 −5（老支书寒了心）',
  },
}
```

> **精力换算说明（待确认）**：玩家个人精力上限目前仅 6 点，「上限减少 10」会直接清空精力池（软锁）。建议换算为 **上限 −1（6→5）**；若坚持「减少 10」，则改为「每回合结算额外 −2 个人精力」。（推荐 −1）

---

## 三、UI 要求

1. **韧性条**：MapComponent 顶部县指标区新增「组织韧性」条（青蓝色 #4E8FA8），韧性归零时条体灰化。
2. **青色护盾破碎动画**：当 `resilienceAbsorbed` 事件出现在本回合 outcome 时，韧性条外层 `.resilience-shield` 播 `shield-break`（缩放+裂片 opacity）动画；RoundReport 事件流显示日志：「组织韧性抵挡了 X 点治理力损耗」。
3. **全屏红头文件**：`floorDefense` 事件 → `<FloorDefenseOverlay />`（复用 DocumentModal 红头排版，全屏、可点击关闭、非强制）：标题「紧急通知：县财政紧急下拨维稳资金，全力保住基层治理底线！」，正文含村庄名与 200 万拨款数额；财政不足版显示「拨款未成」红批。
4. **传帮带指令控件**：VillageSandbox 顶部/驻村工作队块新增每村「传帮带」勾选（`toggleMentorship`），勾选提示「内生治理 +1/回合，但本村产业产出 −30%」。

---

## 四、验收标准

1. 韧性初始 50；组织度扣减先扣韧性，韧性为 0 才扣内生治理/组织密度。
2. 每回合韧性 +5；含入户走访回合额外 +5；韧性不超过 maxResilience。
3. 无传帮带：有驻村队的村每回合内生治理 −2（先扣韧性）；有传帮带：+1 且该村产业产出 ×0.7。
4. 解锁「底线防御」（前置铁腕问责）后，村内生治理 <20 时自动扣 200 财政锁 20；财政不足则仅记录。
5. 老支书招募后：派驻村组织度扣减 ×0.5；全县 maxResilience +30；个人精力上限 −1（换算值，待确认）。
6. 韧性吸收产生 `resilienceAbsorbed` 事件与护盾动画；底线防御产生全屏红头文件。
7. 存档 v8：旧档迁移补 `organizationalResilience=maxResilience=50`、mentorship 缺省 []。
8. 测试：韧性吸收顺序/传帮带两分支/底线防御触发与财政不足/老支书两效果/存档 v8 往返。

---

## 五、实施顺序（确认后）

0. **已核对代码现状**（organization.ts 全文 93 行：挤出段 21-43、接得住指数 45-61、接不住事件 63-71、成本比率 73-91——上表口径已按真实代码校准）。
1. types.ts + balance.ts（§一） → 2. core/systems/resilience.ts（新：settleResilience/applyOrgDamage/settleFloorDefense/挤出新公式）→ 3. 接线（organization.ts 挤出与成本超支/industry.ts 传帮带产出 ×0.7/techTree 加 tech_floor_defense/heroes 加老支书/cadres.ts staminaCap 换算/reducer 管线）→ 4. initialState v8 + save v8 迁移 → 5. store.ts + UI（韧性条/护盾动画/FloorDefenseOverlay/传帮带勾选）→ 6. tests/resilience.test.ts → 7. tsc/vitest/build → 8. 重启 dev server 交付。
