// ============================================================
// 迎检文件堆：纯函数（核心层与 UI 共用同一来源，防止漂移）
// ============================================================
import type { GameState } from '../types';

/** 迎检负担 >0 时屏幕四周生长文件堆：1~4 堆 */
export function paperStackCount(state: GameState): number {
  const burden = state.county.inspectionBurden;
  if (burden <= 0) return 0;
  return Math.min(4, 1 + Math.floor(burden / 20));
}
