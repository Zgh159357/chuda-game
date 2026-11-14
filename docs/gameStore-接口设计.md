# gameStore.ts — Zustand 接口设计

> 对应主控提示词【五、当前启动任务】第 2 项。
> 实际文件：`src/ui/store.ts`（Zustand 5.1.0，`create<GameStore>()`）。本文件为接口契约文档，与代码同步维护。

## 设计原则

1. **薄封装**：本仓不做数值计算。所有结算在 `src/core/reducer.ts`（`playRound` 纯函数），沙盘派生在 `src/core/sandbox/`。store 只做：草稿编排 → 调 `playRound` → 落盘（`saveToLocal`）。
2. **核心态 / UI 态分离**：`state: GameState` 进存档；`draft`/`currentView`/`drag`/`drawerVillageId`/`openDocumentId` 等是 UI 态，不进存档、不参与结算。
3. **精力闸门**：所有 `try*` 动作先验精力（`remainingStamina()`），不足返回 `false`、不写草稿；核心层在 `actions.ts` 再防御性扣一次，防止 UI 绕过。

## 核心状态（对应提示词的五个关键字段）

| 提示词字段 | 实际来源 | 说明 |
|---|---|---|
| `turnCount` | `state.county.round` | 回合数（1–50/18），存档于 GameState |
| `playerStamina` | `state.county.playerStamina − draft.staminaSpent` | 个人精力（上限 6），结算时恢复满额 |
| `mapGrid` | 纯函数派生，无持久字段 | 6×6 地块由 `src/core/sandbox/sandboxObjects.ts`（GRID/VILLAGE_CELLS/cellOwner）派生，永远可由纯 state 重绘 |
| `cadres` | `state.cadres: Cadre[]` | 干部状态（精力/士气/疲劳/驻村/特长），结算在 `src/core/systems/cadres.ts` |
| `policies` | `draft.slots: {party?,industry?,livelihood?}` | 本回合「施政方针」三槽（SlotDraft{cardId,villageId?}），可拖拽落子到村庄 |

## 接口全貌

```ts
type GameLength = 'short' | 'full';        // 短局 18 / 长局 50
type ViewId = 'map' | 'village' | 'site';   // 遗留：等距版用抽屉替代 village/site 整屏切换

type MapNodeId = 'n_county' | 'n_yunxi' | 'n_wuling' | 'n_qingshi' | 'n_xinping';
type FileOptionId = 'A' | 'B' | 'C';        // 公文三批复：稳重 / 代价 / 瞒报

interface GameStore {
  // —— 核心态 ——
  state: GameState | null;      // 存档真源（version 3）
  maxRounds: Round;             // 18 | 50
  report: RoundOutcome | null;  // 结算报告覆盖层
  hasSave: boolean;

  // —— 视图与草稿（UI 态）——
  currentView: ViewId;
  activeVillageId: string | null;
  activeSiteId: string | null;
  playerPos: MapNodeId;         // 玩家棋子在沙盘的位置
  draft: DraftState;            // 本回合草稿（见 core/types.ts）

  // —— 等距沙盘交互（UI 态）——
  drag: DragPayload | null;                 // {kind:'card',slot,cardId} | {kind:'cadre',cadreId}
  dragGhost: { x: number; y: number } | null;
  dropTarget: DropTarget | null;            // {kind:'village'|'site'|'county',refId}
  drawerVillageId: string | null;           // 非空=底部村庄档案抽屉展开
  openDocumentId: string | null;            // 非空=全屏公文
  clearStackQueued: boolean;

  // —— 生命周期 ——
  startNew(anchor: PlayerAnchor, length: GameLength): void;
  continueGame(): void;
  restart(): void;

  // —— 视图/抽屉/覆盖层 ——
  moveTo(nodeId: MapNodeId): void;          // 棋子移动，不耗精力
  openVillage(villageId: string): void;     // 遗留：整屏村庄视图
  openSite(siteId: string): void;
  backToMap(): void;
  openDrawer(villageId: string): void;      // 等距版：村庄档案抽屉
  closeDrawer(): void;
  openDocument(fileId: string): void;
  closeDocument(): void;

  // —— 拖拽 ——
  beginDrag(payload: DragPayload): void;
  moveDrag(x: number, y: number): void;
  setDropTarget(target: DropTarget | null): void;
  endDrag(target: DropTarget | null): void; // canDrop 通过才落草稿

  // —— 精力闸门（全部 try*，不足返回 false 不写草稿）——
  remainingStamina(): number;                              // playerStamina − staminaSpent
  tryQueueNodeAction(nodeId, actionId): boolean;           // 节点交互（交材料/跑财政/调度会/视察）
  tryDecideFile(fileId, optionId): boolean;                // 批复公文（A/B=2 精力，C=1 精力；重批退旧扣）
  tryToggleCard(slot, cardId, villageId?): void;           // 点选入槽（与拖拽并存）
  tryClearPaperStack(): boolean;                           // 迎检堆「盖章处理」耗 1 精力
  updateDraft(patch: Partial<DraftState>): void;

  // —— 回合推进 ——
  getBlockingFileId(): string | null;     // 未批复急件按 deadline 升序取第一
  endTurn(): void;                        // 组装 RoundActions → playRound → save → 重置草稿/视图 → report
  closeReport(): void;
}
```

## 关键实现契约

- **DraftState 上移**：`DraftState` 定义在 `core/types.ts`（沙盘纯函数要消费它），`store.ts` 只 re-export。字段：`slots/targetingLevel/fiscal/coop/commitment/dispatch/householdMeasures/assessment/investigate/repair/acceptProposal/resettle/coopChoose/skills/cadreAssignments/surveyVillages/eventDecisions/nodeActions/staminaSpent/paperStacksCleared`。
- **endTurn 组装**：`slots` 原样传；`nodeActions` 只传 `actionId`；`abandonUrgent = getBlockingFileId() !== null`（急件弃批→压力+5）；`paperStacksCleared` 直传。
- **存档**：`saveToLocal` key `chuda.save.v3`；元数据（局长度）key `chuda.meta.v1`；`loadFromLocal` 遍历 v3→v2→v1 链式迁移。
- **沙盘重绘铁律**：落卡只改 `draft.slots`，结算后由 `state.projects`/`state.villages` 派生永久建筑（`deriveSandboxObjects`）；**沙盘永远可由纯 state 重绘**，不依赖任何 UI 缓存。
