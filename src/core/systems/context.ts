import type {
  CheckpointResult,
  ComboKind,
  FailureType,
  GameEvent,
  GameState,
  LedgerEntry,
  LedgerKind,
  MicroFeedback,
  Rng,
  Round,
} from '../types';

// ============================================================
// 回合上下文：系统间共享的结算管道状态
// 系统函数只通过 ctx 输出，不互相 import。
// ============================================================

export interface TurnCtx {
  round: Round;
  rng: Rng;
  state: GameState; // 工作副本（reducer 持有的可变状态）
  events: GameEvent[];
  microFeedbacks: MicroFeedback[];
  checkpoints: CheckpointResult[];
  ledgerDelta: LedgerEntry[];
  failures: FailureType[];
  ended: boolean;
  combo: { streak: number; lastKind: ComboKind | null };
  starScore: number;
  pushEvent: (e: GameEvent) => void;
  pushFeedback: (rewardId: string, textId: string) => void;
  pushCheckpoint: (r: CheckpointResult) => void;
  pushLedger: (kind: LedgerKind, key: string, value: number, note: string) => void;
  addStars: (points: number) => void;
  noteCombo: (kind: ComboKind | null) => void;
  fail: (f: FailureType) => void;
}

export function createTurnCtx(state: GameState, rng: Rng, round: Round): TurnCtx {
  const ctx: TurnCtx = {
    round,
    rng,
    state,
    events: [],
    microFeedbacks: [],
    checkpoints: [],
    ledgerDelta: [],
    failures: [],
    ended: false,
    combo: { ...state.combo },
    starScore: 0,
    pushEvent(e) {
      this.events.push(e);
    },
    pushFeedback(rewardId, textId) {
      if (this.microFeedbacks.length < 2) {
        this.microFeedbacks.push({ round: this.round, rewardId, textId });
      }
    },
    pushCheckpoint(r) {
      this.checkpoints.push(r);
    },
    pushLedger(kind, key, value, note) {
      this.ledgerDelta.push({ round: this.round, kind, key, value, note });
    },
    addStars(points) {
      this.starScore += points;
    },
    noteCombo(kind) {
      // G1：只连行为不连数字。同类型连续 +streak，换类型归零重来。
      if (kind === null) {
        this.combo = { streak: 0, lastKind: null };
      } else if (this.combo.lastKind === kind) {
        this.combo.streak += 1;
      } else {
        this.combo = { streak: 1, lastKind: kind };
      }
    },
    fail(f) {
      if (!this.failures.includes(f)) {
        this.failures.push(f);
        this.ended = true;
      }
    },
  };
  return ctx;
}

/** 取所有村（含安置点）的户群遍历辅助 */
export function allHouseholds(state: GameState) {
  return state.villages.flatMap((v) => v.households);
}
