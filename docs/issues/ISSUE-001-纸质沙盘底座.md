# [Feature] 搭建纸质档案质感的基础UI与网格沙盘底座

> 对应主控提示词【五、当前启动任务】第 1 项。
> 注意：本项目非零起步，截至 2026-11-12 已有一版可玩 MVP。本 Issue 按「把底座补齐到主控提示词验收标准」撰写，现状与差距如实标注。

## 任务目标

在等距沙盘（`src/ui/MapSandbox.tsx`）上补齐「俯视网格化空间规划」的两块缺失能力，并把沙盘视觉统一到纸质档案美学基线：

1. **规划画区（Zoning）**：玩家可拖拽框选地块，将网格规划为【农业区】【产业区】【易地搬迁安置区】。
2. **数据图层透视（Info Views）**：顶部图层切换器，查看热力分布——【致贫原因层】（红：因病，黄：缺产业）、【内生治理层】（工作队覆盖半径与村两委力量）。

## 验收标准

- [ ] 沙盘上按住拖拽可框选多个地块，出现矩形选择框（手绘红色虚线风格，非现代半透明蓝）。
- [ ] 框选后可指定用途（农业/产业/搬迁安置），地块填色与用途匹配，且**结算后**由纯 state 派生（`src/core/sandbox/` 新增 `zoning.ts`），UI 不存派生数据。
- [ ] 顶部出现图层切换按钮组（纸质标签页样式）；致贫原因层按户群标签给地块着色（disease 红 / noLabor 深红 / remote 黄 / noSkill 土黄 / education 靛 / ecoConstraint 绿）；内生治理层显示驻村工作队覆盖半径与村两委（internalGovernance）强弱色阶。
- [ ] 切换图层仅影响渲染，不影响任何数值计算（纯 UI 状态）。
- [ ] 未摸排村仍被档案纸遮罩覆盖，图层热力不泄露迷雾（遮罩内一律「？？？」）。
- [ ] 新增 `tests/zoning.test.ts`：框选→规划→重绘派生至少 2 个用例。

## 现状（已具备，本 Issue 不重复造）

- 等距投影与逆投影：`src/core/sandbox/iso.ts`（`iso`/`unproject`/`extrude`）。
- 6×6 地块与建筑派生：`src/core/sandbox/sandboxObjects.ts`（`deriveSandboxObjects`）。
- 迷雾档案纸遮罩、风险村干裂泛红、产业建筑图标：`src/ui/MapSandbox.tsx` 已实现。
- 拖拽落子（政策卡/干部卡）：`src/ui/store.ts` 的 `beginDrag/moveDrag/endDrag` + `src/core/sandbox/dropRules.ts` 的 `canDrop`。

## 涉及技术点

- 指针事件驱动的框选（Pointer Capture，复用现有拖拽管线；框选与落子拖拽需互斥判定）。
- `iso.ts` 增加地面格矩形选择框的投影绘制（等距下矩形选区是平行四边形）。
- Zustand 扩展：`zoningMode: 'agri'|'industry'|'resettle'|null`、`infoView: 'poverty'|'governance'|'none'`、`zoningDraft: {cells: [x,y][]; kind}[]`。
- 纯函数 `src/core/sandbox/zoning.ts`：`deriveZoning(state)`、`applyZoning(state, draft)`；`src/core/sandbox/infoViews.ts`：`povertyHeat(village, household)`、`governanceHeat(state)`。

## 分支建议

```text
feature/grid-sandbox-zoning-info-views
```

## 接口先行（草案，确认后再写实现）

```ts
// core/types.ts 新增
export type ZoningKind = 'agri' | 'industry' | 'resettle';
export interface ZoningCell { x: number; y: number; kind: ZoningKind; villageId: string | null }
export type InfoViewId = 'none' | 'poverty' | 'governance';

// ui/store.ts 新增 UI 态（不进 GameState、不参与存档）
zoningMode: ZoningKind | null;          // null=未进入规划模式
zoningDraft: { x: number; y: number }[]; // 当前框选中的地块
infoView: InfoViewId;
// actions
beginZoneSelection(): void;             // 进入框选模式
updateZoneSelection(cells: {x:number;y:number}[]): void;
commitZone(kind: ZoningKind): void;     // 写入草稿，结算后落 state
cancelZone(): void;
setInfoView(view: InfoViewId): void;
```

## 备注

- 规划区是**长期空间决策**：安置区建在无产业村庄旁会推高返贫风险（设计上预留，数值绑定放后续 Issue）。
- 图层热力是**辅助决策视图**，不改变任何结算公式；防「图层即真相」的作弊感（信息迷雾优先）。
