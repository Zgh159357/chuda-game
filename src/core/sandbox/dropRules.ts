// ============================================================
// 拖拽落子校验：纯函数（store 的 canDrop 与 UI 高亮共用）
// ============================================================
import type { GameState, SlotKind } from '../types';

export type DragPayload =
  | { kind: 'card'; slot: SlotKind; cardId: string }
  | { kind: 'cadre'; cadreId: string };

export interface DropTarget {
  kind: 'village' | 'site' | 'county' | 'ground';
  refId: string | null;
}

export interface DropRuleResult {
  ok: boolean;
  reason?: string;
}

/** 政策卡落子规则：
 *  - 必须已解锁；
 *  - party（党建）卡：可落县（全县方针）或任意村；
 *  - industry / livelihood 卡：必须落到具体村庄；
 *  - 干部头像：可拖到村（驻村）或县治（召回待命）。
 */
export function canDrop(payload: DragPayload, target: DropTarget, state: GameState): DropRuleResult {
  if (payload.kind === 'cadre') {
    const cadre = state.cadres.find((c) => c.id === payload.cadreId);
    if (!cadre) return { ok: false, reason: '干部不在名册' };
    if (target.kind === 'village') {
      const v = state.villages.find((x) => x.id === target.refId);
      if (!v) return { ok: false, reason: '村庄不存在' };
      return { ok: true };
    }
    if (target.kind === 'county') return { ok: true }; // 召回县机关待命
    return { ok: false, reason: '只能驻进村庄或召回县机关' };
  }

  // 政策卡
  const card = state.unlocked.policies.includes(payload.cardId) ? payload.cardId : null;
  if (!card) return { ok: false, reason: '该卡尚未解锁' };
  if (target.kind === 'county') {
    return payload.slot === 'party' ? { ok: true } : { ok: false, reason: '产业与民生卡要落到具体村庄' };
  }
  if (target.kind === 'village') {
    const v = state.villages.find((x) => x.id === target.refId);
    if (!v) return { ok: false, reason: '村庄不存在' };
    return { ok: true };
  }
  return { ok: false, reason: '落点必须是村庄或县治' };
}
