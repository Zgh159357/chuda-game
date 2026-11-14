import type { GameState, StarRating } from '../types';
import { config } from '../../config';

// ============================================================
// 回合星级（G5）：节奏提示，不直接给资源
// ============================================================

export function computeStars(score: number): StarRating {
  const [t2, t3, t4, t5] = config.balance.stars.thresholds;
  if (score >= t5) return 5;
  if (score >= t4) return 4;
  if (score >= t3) return 3;
  if (score >= t2) return 2;
  return 1;
}

/** 星级语义：仅作节奏提示文案 */
export function starLabel(stars: StarRating): string {
  switch (stars) {
    case 5:
      return '井井有条，张弛有度。';
    case 4:
      return '干得实在，小有纰漏。';
    case 3:
      return '平平过线，暗流未消。';
    case 2:
      return '左支右绌，账面上过得去。';
    default:
      return '这一回合，日子比台账难。';
  }
}
