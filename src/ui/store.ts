// ============================================================
// 《触达：一本扶贫台账的三十年》Zustand 游戏状态仓
// 双层视图重构：县域大地图（节点+玩家棋子）⇄ 村庄控制台
// 纯函数逻辑（core）与 UI 状态分离：本仓只做薄封装。
// ============================================================
import { create } from 'zustand';
import type {
  CommitmentLevel,
  CoopType,
  DraftState,
  GameState,
  MeasureId,
  PlayerAnchor,
  Round,
  RoundActions,
  RoundOutcome,
  SlotDraft,
  SlotKind,
  TargetingLevel,
  ZoningKind,
} from '../core/types';
import { createInitialState } from '../core/state/initialState';
import { playRound } from '../core/reducer';
import { clearSave, deserialize, loadFromLocal, saveToLocal, serialize, SHORT_GAME_ROUNDS } from '../core/save';
import { canDrop, type DragPayload, type DropTarget } from '../core/sandbox/dropRules';
import type { InfoViewId } from '../core/sandbox/infoViews';
import { config } from '../config';

export type GameLength = 'short' | 'full';
export type ViewId = 'map' | 'village' | 'site';

export type MapNodeId = 'n_county' | 'n_yunxi' | 'n_wuling' | 'n_qingshi' | 'n_xinping';

export interface MapNode {
  id: MapNodeId;
  kind: 'county' | 'village' | 'site';
  refId: string; // villages[].id / sites[].id（n_county 为 ''）
  label: string;
  pos: { x: number; y: number };
}

export const MAP_NODES: MapNode[] = [
  { id: 'n_county', kind: 'county', refId: '', label: '县政府', pos: { x: 260, y: 148 } },
  { id: 'n_yunxi', kind: 'village', refId: 'v_yunxi', label: '云溪村', pos: { x: 130, y: 90 } },
  { id: 'n_wuling', kind: 'village', refId: 'v_wuling', label: '雾岭村', pos: { x: 330, y: 150 } },
  { id: 'n_qingshi', kind: 'village', refId: 'v_qingshi', label: '青石村', pos: { x: 210, y: 220 } },
  { id: 'n_xinping', kind: 'site', refId: 's_xinping', label: '新坪安置点', pos: { x: 430, y: 80 } },
];

export type RepairMode = 'stopLoss' | 'restructure' | 'changeCarrier' | 'accountability';
export type FileOptionId = 'A' | 'B' | 'C';

export interface NodeActionDraft {
  nodeId: MapNodeId;
  actionId: string;
}

// 本回合草稿定义已上移至 core/types.ts（沙盘纯函数需要它，保持 core 不依赖 UI）
export type { DraftState } from '../core/types';

function defaultDraft(state: GameState | null): DraftState {
  return {
    slots: {},
    targetingLevel: 'village',
    fiscal: 0,
    coop: 0,
    commitment: state?.county.commitment ?? 'standard',
    dispatch: [],
    householdMeasures: [],
    assessment: {
      density: state?.county.assessmentDensity ?? 30,
      thirdParty: state?.county.thirdPartyCoverage ?? 10,
      directReport: state?.county.directReport ?? 10,
    },
    investigate: [],
    repair: [],
    acceptProposal: [],
    resettle: [],
    coopChoose: [],
    skills: [],
    cadreAssignments: [],
    surveyVillages: [],
    eventDecisions: [],
    nodeActions: [],
    staminaSpent: 0,
    paperStacksCleared: 0,
    zoning: [],
    negotiations: [],
    techUnlocks: [],
    wonderInvest: [],
    heroAssign: [],
    recruitChoices: [],
    mentorship: [],
    buildNodes: [], // §15 自建产业设施（村庄沙盘蓝图落子）
  };
}

const META_KEY = 'chuda.meta.v1';

interface GameStore {
  state: GameState | null;
  maxRounds: Round;
  report: RoundOutcome | null;
  hasSave: boolean;

  // 双层视图
  currentView: ViewId;
  activeVillageId: string | null;
  activeSiteId: string | null;
  playerPos: MapNodeId;

  // 本回合草稿
  draft: DraftState;

  // 等距沙盘：拖拽与抽屉/覆盖层（UI 态，不进核心）
  drag: DragPayload | null;
  dragGhost: { x: number; y: number } | null;
  dropTarget: DropTarget | null;
  drawerVillageId: string | null; // 非空 = 底部村庄档案抽屉展开
  openDocumentId: string | null; // 非空 = 全屏公文
  clearStackQueued: boolean; // 迎检堆「盖章处理」按钮已排队（防连点）

  // 规划画区（Zoning）与数据图层透视（Info Views）—— UI 态
  zoningMode: ZoningKind | null; // 非空 = 框选画区模式（农业/产业/安置）
  zoningStart: { x: number; y: number } | null; // 框选起点（地面格）
  zoningSel: { x: number; y: number }[]; // 当前框选中的格
  infoView: InfoViewId; // 图层：none / poverty / governance / logistics

  // 谈判博弈（主控提示词第七节）—— UI 态
  openNegotiationGroupId: string | null; // 非空 = 谈判弹层打开（目标户群）
  pickedNegotiationHands: string[]; // 已选谈判手牌（≤2）

  // 核心驱动力（主控提示词第八节）—— 解锁光环提示（UI 态）
  unlockFlash: string | null; // 'tech' | 'wonder' | 'hero' | 'recruit' | null

  // 因果律（主控提示词第九节）—— 人才两难招募（UI 态）
  openRecruitId: string | null; // 非空 = 两难抉择弹层打开（pendingRecruits 里的 heroId）

  // 组织韧性（主控提示词第十节）—— UI 态
  floorDefenseFlash: { villageId: string } | null; // 底线防御触发后，报告关闭后闪红头文件
  synergyFlash: { villageId: string; recipeId: string } | null; // §14 流派解锁后闪金线+牌匾（报告关闭后）

  // 存档导入/导出（部署任务）—— UI 态
  importError: string | null; // 导入失败时的错误文案（StartScene 显示）
  exportSave: () => boolean; // 序列化当前状态并下载 .json
  importSave: (text: string) => boolean; // 解析并载入 .json（自动走版本迁移链）
  clearImportError: () => void;

  startNew: (anchor: PlayerAnchor, length: GameLength) => void;
  continueGame: () => void;
  moveTo: (nodeId: MapNodeId) => void;
  openVillage: (villageId: string) => void;
  openSite: (siteId: string) => void;
  backToMap: () => void;
  openDrawer: (villageId: string) => void;
  closeDrawer: () => void;
  openDocument: (fileId: string) => void;
  closeDocument: () => void;
  beginDrag: (payload: DragPayload) => void;
  moveDrag: (x: number, y: number) => void;
  setDropTarget: (target: DropTarget | null) => void;
  endDrag: (target: DropTarget | null) => void;

  remainingStamina: () => number;
  tryQueueNodeAction: (nodeId: MapNodeId, actionId: string) => boolean;
  tryDecideFile: (fileId: string, optionId: FileOptionId) => boolean;
  tryToggleCard: (slot: SlotKind, cardId: string, villageId?: string) => void;
  tryClearPaperStack: () => boolean;
  updateDraft: (patch: Partial<DraftState>) => void;

  setZoningMode: (kind: ZoningKind | null) => void;
  beginZoneSelect: (x: number, y: number) => void;
  extendZoneSelect: (x: number, y: number) => void;
  commitZoneSelect: () => boolean; // true=本回合新增一条规划动作
  cancelZoneSelect: () => void;
  setInfoView: (view: InfoViewId) => void;

  openNegotiation: (groupId: string) => void;
  closeNegotiation: () => void;
  toggleNegotiationHand: (handId: string) => void; // 最多选 2 张
  confirmNegotiation: () => void; // 写入 draft.negotiations 并关闭弹层

  toggleTechUnlock: (nodeId: string) => void;
  setWonderInvest: (wonderId: string, amount: number) => void;
  setHeroAssign: (heroId: string, villageId: string) => void;
  clearUnlockFlash: () => void;

  openRecruit: (heroId: string) => void;
  closeRecruit: () => void;
  answerRecruit: (heroId: string, accepted: boolean) => void; // 写入 draft.recruitChoices

  toggleMentorship: (villageId: string) => void;
  toggleBuildNode: (nodeId: string, villageId: string) => void; // 传帮带指令：勾选/取消本回合驻村村
  clearFloorDefenseFlash: () => void;
  clearSynergyFlash: () => void;

  getBlockingFileId: () => string | null;
  endTurn: () => void;
  closeReport: () => void;
  restart: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  maxRounds: 50,
  report: null,
  hasSave: loadFromLocal() !== null,
  currentView: 'map',
  activeVillageId: null,
  activeSiteId: null,
  playerPos: 'n_county',
  draft: defaultDraft(null),
  drag: null,
  dragGhost: null,
  dropTarget: null,
  drawerVillageId: null,
  openDocumentId: null,
  clearStackQueued: false,
  zoningMode: null,
  zoningStart: null,
  zoningSel: [],
  infoView: 'none',
  openNegotiationGroupId: null,
  pickedNegotiationHands: [],
  unlockFlash: null,
  openRecruitId: null,
  floorDefenseFlash: null,
  synergyFlash: null,
  importError: null,

  startNew: (anchor, length) => {
    clearSave();
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const maxRounds = length === 'short' ? SHORT_GAME_ROUNDS : 50;
    const state = createInitialState(seed, anchor);
    localStorage.setItem(META_KEY, JSON.stringify({ maxRounds }));
    set({
      state,
      maxRounds,
      report: null,
      hasSave: false,
      currentView: 'map',
      activeVillageId: null,
      activeSiteId: null,
      playerPos: 'n_county',
      draft: defaultDraft(state),
      zoningMode: null,
      zoningStart: null,
      zoningSel: [],
      infoView: 'none',
      openNegotiationGroupId: null,
      pickedNegotiationHands: [],
      unlockFlash: null,
      openRecruitId: null,
      floorDefenseFlash: null,
      synergyFlash: null,
    });
  },

  continueGame: () => {
    const saved = loadFromLocal();
    if (!saved) return;
    let maxRounds = 50;
    try {
      const meta = JSON.parse(localStorage.getItem(META_KEY) ?? '{}');
      maxRounds = meta.maxRounds ?? 50;
    } catch {
      /* 元数据损坏则默认长局 */
    }
    set({
      state: saved,
      maxRounds,
      report: null,
      hasSave: true,
      currentView: 'map',
      activeVillageId: null,
      activeSiteId: null,
      playerPos: 'n_county',
      draft: defaultDraft(saved),
      zoningMode: null,
      zoningStart: null,
      zoningSel: [],
      infoView: 'none',
      openNegotiationGroupId: null,
      pickedNegotiationHands: [],
      unlockFlash: null,
      openRecruitId: null,
      floorDefenseFlash: null,
      synergyFlash: null,
    });
  },

  moveTo: (nodeId) => set({ playerPos: nodeId }),

  openVillage: (villageId) => {
    const node = MAP_NODES.find((n) => n.refId === villageId);
    set({
      currentView: 'village',
      activeVillageId: villageId,
      activeSiteId: null,
      playerPos: node ? node.id : 'n_county',
    });
  },

  openSite: (siteId) => {
    const node = MAP_NODES.find((n) => n.refId === siteId);
    set({
      currentView: 'site',
      activeSiteId: siteId,
      activeVillageId: null,
      playerPos: node ? node.id : 'n_county',
    });
  },

  backToMap: () =>
    set({ currentView: 'map', activeVillageId: null, activeSiteId: null }),

  openDrawer: (villageId) => set({ drawerVillageId: villageId }),
  closeDrawer: () => set({ drawerVillageId: null }),

  openDocument: (fileId) => set({ openDocumentId: fileId }),
  closeDocument: () => set({ openDocumentId: null }),

  beginDrag: (payload) => set({ drag: payload, dragGhost: null, dropTarget: null }),
  moveDrag: (x, y) => set({ dragGhost: { x, y } }),
  setDropTarget: (target) => set({ dropTarget: target }),
  endDrag: (target) => {
    const { drag, state, draft } = get();
    if (!drag || !state) {
      set({ drag: null, dragGhost: null, dropTarget: null });
      return;
    }
    if (target && canDrop(drag, target, state).ok) {
      if (drag.kind === 'card') {
        const next: DraftState['slots'] = { ...draft.slots };
        next[drag.slot] = target.kind === 'village' ? { cardId: drag.cardId, villageId: target.refId ?? undefined } : { cardId: drag.cardId };
        set({ drag: null, dragGhost: null, dropTarget: null, draft: { ...draft, slots: next } });
      } else {
        // 干部拖拽：驻村 / 召回县机关
        const villageId = target.kind === 'village' ? target.refId : null;
        const rest = draft.cadreAssignments.filter((a) => a.cadreId !== drag.cadreId);
        set({
          drag: null,
          dragGhost: null,
          dropTarget: null,
          draft: { ...draft, cadreAssignments: [...rest, { cadreId: drag.cadreId, villageId }] },
        });
      }
      return;
    }
    set({ drag: null, dragGhost: null, dropTarget: null });
  },

  remainingStamina: () => {
    const { state, draft } = get();
    if (!state) return 0;
    return Math.max(0, state.county.playerStamina - draft.staminaSpent);
  },

  tryQueueNodeAction: (nodeId, actionId) => {
    const { state, draft, remainingStamina } = get();
    if (!state) return false;
    const spec = config.nodeActions.find((n) => n.id === actionId);
    if (!spec) return false;
    if (remainingStamina() < spec.cost) return false;
    set({
      draft: {
        ...draft,
        nodeActions: [...draft.nodeActions, { nodeId, actionId }],
        staminaSpent: draft.staminaSpent + spec.cost,
      },
    });
    return true;
  },

  tryDecideFile: (fileId, optionId) => {
    const { state, draft, remainingStamina } = get();
    if (!state) return false;
    const inInbox = state.eventInbox.some((e) => e.fileId === fileId);
    if (!inInbox) return false;
    const cost = config.balance.fileOptionStamina[optionId] ?? 0;
    // 重批同一文件：先退回旧批复占用的精力
    const prev = draft.eventDecisions.find((d) => d.fileId === fileId);
    const prevCost = prev ? config.balance.fileOptionStamina[prev.optionId] ?? 0 : 0;
    if (remainingStamina() + prevCost < cost) return false;
    set({
      draft: {
        ...draft,
        eventDecisions: [...draft.eventDecisions.filter((d) => d.fileId !== fileId), { fileId, optionId }],
        staminaSpent: draft.staminaSpent - prevCost + cost,
      },
    });
    return true;
  },

  tryToggleCard: (slot, cardId, villageId) => {
    const { state, draft } = get();
    if (!state) return;
    const cur = draft.slots[slot];
    // 同一槽位：再点已选卡=取消；否则换卡
    const next: SlotDraft | undefined = cur && cur.cardId === cardId ? undefined : { cardId, villageId };
    set({ draft: { ...draft, slots: { ...draft.slots, [slot]: next } } });
  },

  updateDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),

  setZoningMode: (kind) =>
    set({
      zoningMode: kind,
      zoningStart: null,
      zoningSel: [],
    }),

  beginZoneSelect: (x, y) => set({ zoningStart: { x, y }, zoningSel: [{ x, y }] }),

  extendZoneSelect: (x, y) => {
    const { zoningStart } = get();
    if (!zoningStart) return;
    const x0 = Math.min(zoningStart.x, x);
    const x1 = Math.max(zoningStart.x, x);
    const y0 = Math.min(zoningStart.y, y);
    const y1 = Math.max(zoningStart.y, y);
    const cells: { x: number; y: number }[] = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        if (cx >= 0 && cx < 6 && cy >= 0 && cy < 6) cells.push({ x: cx, y: cy });
      }
    }
    set({ zoningSel: cells });
  },

  commitZoneSelect: () => {
    const { zoningMode, zoningSel, draft } = get();
    if (!zoningMode || zoningSel.length === 0) return false;
    set({
      draft: { ...draft, zoning: [...draft.zoning, { kind: zoningMode, cells: zoningSel }] },
      zoningStart: null,
      zoningSel: [],
    });
    return true;
  },

  cancelZoneSelect: () => set({ zoningStart: null, zoningSel: [] }),

  setInfoView: (view) => set({ infoView: view }),

  openNegotiation: (groupId) => set({ openNegotiationGroupId: groupId, pickedNegotiationHands: [] }),
  closeNegotiation: () => set({ openNegotiationGroupId: null, pickedNegotiationHands: [] }),
  toggleNegotiationHand: (handId) => {
    const { pickedNegotiationHands } = get();
    if (pickedNegotiationHands.includes(handId)) {
      set({ pickedNegotiationHands: pickedNegotiationHands.filter((x) => x !== handId) });
    } else if (pickedNegotiationHands.length < 2) {
      set({ pickedNegotiationHands: [...pickedNegotiationHands, handId] });
    }
  },
  confirmNegotiation: () => {
    const { openNegotiationGroupId, pickedNegotiationHands, draft } = get();
    if (!openNegotiationGroupId || pickedNegotiationHands.length === 0) return;
    const rest = draft.negotiations.filter((n) => n.groupId !== openNegotiationGroupId);
    set({
      draft: {
        ...draft,
        negotiations: [...rest, { groupId: openNegotiationGroupId, hands: pickedNegotiationHands }],
      },
      openNegotiationGroupId: null,
      pickedNegotiationHands: [],
    });
  },

  toggleTechUnlock: (nodeId) => {
    const { draft, state } = get();
    if (!state) return;
    const spec = config.techTree.find((t) => t.id === nodeId);
    if (!spec) return;
    // 本回合草稿或本局已解锁 → 再点取消（草稿内）
    const inDraft = draft.techUnlocks.includes(nodeId);
    if (state.techUnlocked.includes(nodeId)) return; // 已永久解锁
    set({
      draft: {
        ...draft,
        techUnlocks: inDraft ? draft.techUnlocks.filter((x) => x !== nodeId) : [...draft.techUnlocks, nodeId],
      },
    });
  },

  setWonderInvest: (wonderId, amount) => {
    const { draft } = get();
    const rest = draft.wonderInvest.filter((w) => w.wonderId !== wonderId);
    set({ draft: { ...draft, wonderInvest: amount > 0 ? [...rest, { wonderId, amount }] : rest } });
  },

  setHeroAssign: (heroId, villageId) => {
    const { draft } = get();
    const rest = draft.heroAssign.filter((h) => h.heroId !== heroId);
    set({ draft: { ...draft, heroAssign: [...rest, { heroId, villageId }] } });
  },

  clearUnlockFlash: () => set({ unlockFlash: null }),

  openRecruit: (heroId) => set({ openRecruitId: heroId }),
  closeRecruit: () => set({ openRecruitId: null }),
  answerRecruit: (heroId, accepted) => {
    const { draft } = get();
    const rest = draft.recruitChoices.filter((r) => r.heroId !== heroId);
    set({
      draft: { ...draft, recruitChoices: [...rest, { heroId, accepted }] },
      openRecruitId: null,
    });
  },

  toggleMentorship: (villageId) => {
    const { draft } = get();
    const has = draft.mentorship.includes(villageId);
    set({
      draft: {
        ...draft,
        mentorship: has
          ? draft.mentorship.filter((v) => v !== villageId)
          : [...draft.mentorship, villageId],
      },
    });
  },

  toggleBuildNode: (nodeId, villageId) => {
    const { draft } = get();
    const has = draft.buildNodes.some((b) => b.nodeId === nodeId && b.villageId === villageId);
    set({
      draft: {
        ...draft,
        buildNodes: has
          ? draft.buildNodes.filter((b) => !(b.nodeId === nodeId && b.villageId === villageId))
          : [...draft.buildNodes, { nodeId, villageId }],
      },
    });
  },

  clearFloorDefenseFlash: () => set({ floorDefenseFlash: null }),
  clearSynergyFlash: () => set({ synergyFlash: null }),

  exportSave: () => {
    const { state } = get();
    if (!state) return false;
    try {
      const json = serialize(state);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      a.download = `chuda-save-r${state.county.round}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      set({ importError: '导出失败：浏览器不允许下载文件' });
      return false;
    }
  },

  importSave: (text) => {
    try {
      const data = deserialize(text);
      if (!data || typeof data.version !== 'number' || !data.county || !Array.isArray(data.villages)) {
        set({ importError: '文件内容不是有效的《触达》存档' });
        return false;
      }
      const maxRounds = 50;
      saveToLocal(data);
      localStorage.setItem(META_KEY, JSON.stringify({ maxRounds }));
      set({
        state: data,
        maxRounds,
        report: null,
        hasSave: true,
        currentView: 'map',
        activeVillageId: null,
        activeSiteId: null,
        playerPos: 'n_county',
        draft: defaultDraft(data),
        zoningMode: null,
        zoningStart: null,
        zoningSel: [],
        infoView: 'none',
        openNegotiationGroupId: null,
        pickedNegotiationHands: [],
        unlockFlash: null,
        openRecruitId: null,
        floorDefenseFlash: null,
        importError: null,
      });
      return true;
    } catch (e) {
      set({ importError: `导入失败：${e instanceof Error ? e.message : '文件格式错误'}` });
      return false;
    }
  },

  clearImportError: () => set({ importError: null }),

  tryClearPaperStack: () => {
    const { state, draft, remainingStamina } = get();
    if (!state) return false;
    if (remainingStamina() < config.balance.paperStackClearCost) return false;
    set({
      draft: {
        ...draft,
        paperStacksCleared: draft.paperStacksCleared + 1,
        staminaSpent: draft.staminaSpent + config.balance.paperStackClearCost,
      },
    });
    return true;
  },

  getBlockingFileId: () => {
    const { state, draft } = get();
    if (!state) return null;
    const decided = new Set(draft.eventDecisions.map((d) => d.fileId));
    const pending = state.eventInbox
      .filter((e) => !decided.has(e.fileId))
      .map((e) => ({ e, spec: config.eventFiles.find((f) => f.id === e.fileId) }))
      .filter((x) => x.spec?.urgency === '急')
      .sort((a, b) => a.e.deadline - b.e.deadline);
    return pending[0]?.e.fileId ?? null;
  },

  endTurn: () => {
    const { state, draft, maxRounds, getBlockingFileId } = get();
    if (!state || state.status === 'ended') return;
    const actions: RoundActions = {
      cards: [],
      slots: draft.slots,
      targetingLevel: draft.targetingLevel,
      fiscal: draft.fiscal,
      coop: draft.coop,
      commitment: draft.commitment,
      dispatch: draft.dispatch,
      householdMeasures: draft.householdMeasures,
      assessment: draft.assessment,
      investigate: draft.investigate,
      repair: draft.repair,
      acceptProposal: draft.acceptProposal,
      resettle: draft.resettle,
      coopChoose: draft.coopChoose,
      skills: draft.skills,
      cadreAssignments: draft.cadreAssignments,
      surveyVillages: draft.surveyVillages,
      eventDecisions: draft.eventDecisions,
      nodeActions: draft.nodeActions.map((n) => n.actionId),
      abandonUrgent: getBlockingFileId() !== null,
      paperStacksCleared: draft.paperStacksCleared,
      zoning: draft.zoning,
      negotiations: draft.negotiations,
      techUnlocks: draft.techUnlocks,
      wonderInvest: draft.wonderInvest,
      heroAssign: draft.heroAssign,
      recruitChoices: draft.recruitChoices,
      mentorship: draft.mentorship,
      buildNodes: draft.buildNodes,
    };
    const outcome = playRound(state, actions, maxRounds);
    saveToLocal(outcome.state);
    localStorage.setItem(META_KEY, JSON.stringify({ maxRounds }));
    // §8/§9 解锁光环：本回合有机制/工程/人才落定 → 报告关闭后闪一次
    let unlockFlash: string | null = null;
    if (outcome.events.some((e) => e.type === 'techUnlock')) unlockFlash = 'tech';
    else if (outcome.events.some((e) => e.type === 'wonderCompleted')) unlockFlash = 'wonder';
    else if (outcome.events.some((e) => e.type === 'heroAwakened' || e.type === 'recruitAccepted')) unlockFlash = 'hero';
    // §10 底线防御：本回合触发过 → 报告关闭后闪红头文件
    const fdEvent = outcome.events.find((e) => e.type === 'floorDefense');
    const floorDefenseFlash =
      fdEvent && 'villageId' in fdEvent ? { villageId: fdEvent.villageId } : null;
    // §14 流派解锁：本回合炼出新流派 → 报告关闭后闪金线+牌匾
    const syEvent = outcome.events.find((e) => e.type === 'synergyUnlocked');
    const synergyFlash =
      syEvent && 'villageId' in syEvent && 'recipeId' in syEvent
        ? { villageId: syEvent.villageId, recipeId: syEvent.recipeId }
        : null;
    set({
      state: outcome.state,
      report: outcome,
      hasSave: true,
      currentView: 'map',
      activeVillageId: null,
      activeSiteId: null,
      drawerVillageId: null,
      openDocumentId: null,
      drag: null,
      dragGhost: null,
      dropTarget: null,
      draft: defaultDraft(outcome.state),
      zoningMode: null,
      zoningStart: null,
      zoningSel: [],
      openNegotiationGroupId: null,
      pickedNegotiationHands: [],
      unlockFlash,
      openRecruitId: null,
      floorDefenseFlash,
      synergyFlash,
    });
  },

  closeReport: () => set({ report: null }),

  restart: () =>
    set({
      state: null,
      report: null,
      hasSave: loadFromLocal() !== null,
      currentView: 'map',
      activeVillageId: null,
      activeSiteId: null,
      playerPos: 'n_county',
      draft: defaultDraft(null),
      zoningMode: null,
      zoningStart: null,
      zoningSel: [],
      infoView: 'none',
      openNegotiationGroupId: null,
      pickedNegotiationHands: [],
      unlockFlash: null,
      openRecruitId: null,
      floorDefenseFlash: null,
      synergyFlash: null,
    }),
}));
