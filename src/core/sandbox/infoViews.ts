// ============================================================
// 数据图层透视（Info Views）纯函数 —— 主控提示词：热力分布视图
// 纯 UI 态：只影响渲染，不改变任何数值；热力不得穿透信息迷雾。
// ============================================================
import type { GameState } from '../types';
import { cellOwner } from './sandboxObjects';
import { deriveRoadSet, logisticsCoveredAt } from './logistics';

export type InfoViewId = 'none' | 'poverty' | 'governance' | 'logistics';

export const INFO_VIEW_LABELS: Record<InfoViewId, string> = {
  none: '无',
  poverty: '致贫原因',
  governance: '内生治理',
  logistics: '物流/产业链',
};

export interface HeatCell {
  x: number;
  y: number;
  /** 热力色键：poverty 层为户群标签色；governance 层为强弱档 */
  heat: string | null;
  /** 该格有驻村工作队覆盖 */
  covered: boolean;
}

const TAG_COLORS: Record<string, string> = {
  disease: '#B33A2B', // 因病：印章红
  noLabor: '#7A3024', // 缺劳力：深红
  remote: '#C49A5A', // 偏远：土黄
  noSkill: '#D0B16A', // 缺技能：浅土黄
  education: '#3E5C76', // 因学：靛蓝
  ecoConstraint: '#6B7F4E', // 生态约束：田野绿
};

/**
 * 致贫原因层：取该格所属村庄户群的最主要标签（按人数加权取第一）。
 * 未摸排村（!surveyed）一律返回 null —— 迷雾优先，热力不泄露。
 */
export function povertyHeat(state: GameState, x: number, y: number): string | null {
  const owner = cellOwner(x, y);
  if (owner.kind !== 'village') return null;
  const village = state.villages.find((v) => v.id === owner.refId);
  if (!village || !village.surveyed) return null;
  const byTag = new Map<string, number>();
  for (const h of village.households) {
    byTag.set(h.tag, (byTag.get(h.tag) ?? 0) + h.population);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [tag, n] of byTag) {
    if (n > bestN) {
      bestN = n;
      best = tag;
    }
  }
  return best ? TAG_COLORS[best] ?? '#7A7268' : null;
}

/**
 * 内生治理层：村两委力量（internalGovernance）弱→红、强→绿；
 * covered = 该村有驻村工作队（externalEmbed > 0）。未摸排村返回 null。
 */
export function governanceHeat(state: GameState, x: number, y: number): HeatCell {
  const owner = cellOwner(x, y);
  if (owner.kind !== 'village') return { x, y, heat: null, covered: false };
  const village = state.villages.find((v) => v.id === owner.refId);
  if (!village || !village.surveyed) return { x, y, heat: null, covered: false };
  const g = village.internalGovernance;
  let heat: string;
  if (g < 30) heat = '#B33A2B';
  else if (g < 50) heat = '#D07A2E';
  else if (g < 70) heat = '#C49A5A';
  else heat = '#6B7F4E';
  return { x, y, heat, covered: village.externalEmbed > 0 };
}

/** 整层派生：poverty 层颜色表（按格） */
export function derivePovertyLayer(state: GameState): Map<string, string> {
  const out = new Map<string, string>();
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const c = povertyHeat(state, x, y);
      if (c) out.set(`${x},${y}`, c);
    }
  }
  return out;
}

/** 整层派生：governance 层（格 → 强弱色 + 是否被工作队覆盖） */
export function deriveGovernanceLayer(state: GameState): HeatCell[] {
  const out: HeatCell[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const c = governanceHeat(state, x, y);
      if (c.heat) out.push(c);
    }
  }
  return out;
}

export interface LogisticsCell {
  x: number;
  y: number;
  /** 已通公路 */
  road: boolean;
  /** 物流覆盖（公路 × 县物流站） */
  covered: boolean;
}

/** 物流图层：道路连通性 + 物流覆盖（纯派生，无迷雾门——路是看得见的东西） */
export function logisticsHeat(state: GameState, x: number, y: number): LogisticsCell {
  const road = deriveRoadSet(state).has(`${x},${y}`);
  return { x, y, road, covered: road && logisticsCoveredAt(state, x, y) };
}

/** 整层派生：logistics 层 */
export function deriveLogisticsLayer(state: GameState): LogisticsCell[] {
  const out: LogisticsCell[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const c = logisticsHeat(state, x, y);
      if (c.road) out.push(c);
    }
  }
  return out;
}
