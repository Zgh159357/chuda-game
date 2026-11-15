import type { GameState, IndustryNode, IndustryTag, ResourceTag, SynergyRecipe, Tile } from '../types';
import { deriveIndustryNodes, synergyRecipes } from '../../config/industry';
import { deriveTiles } from './logistics';

// ============================================================
// §14 产业融合引擎（要素标签化 + 涌现式玩法）
// 纯函数：玩家自由组合 → 标签交叉比对 → 配方命中
// ============================================================

/** 数组去重（配方交叉比对前的标签归一化） */
export function normalizeTags<T extends string>(tags: T[]): T[] {
  return Array.from(new Set(tags));
}

/** 集合包含判断：required 全部出现在 owned 中 */
function hasAll<T>(owned: T[], required: T[]): boolean {
  return required.every((r) => owned.includes(r));
}

/** 单配方命中判定（calculateSynergy 与 detectVillageSynergies 共用） */
function matchesRecipe(
  tile: Tile,
  industryTags: IndustryTag[],
  recipe: SynergyRecipe
): boolean {
  const tileResources: ResourceTag[] = normalizeTags(tile.environment.resources ?? []);
  const resourceOk = hasAll(tileResources, recipe.requiredResourceTags);
  const industryOk = hasAll(industryTags, recipe.requiredIndustryTags);
  const terrainOk = !recipe.requiredTerrain || tile.environment.terrain === recipe.requiredTerrain;
  return resourceOk && industryOk && terrainOk;
}

/**
 * 涌现式产业融合计算。
 * - 地块资源：tile.environment.resources
 * - 周边产业：surroundingNodes 的 tags 并集（去重）
 * - 遍历配方表：资源 + 产业 + 地形（可选）全满足 → 返回第一个命中的配方
 */
export function calculateSynergy(
  tile: Tile,
  surroundingNodes: IndustryNode[],
  recipes: SynergyRecipe[]
): SynergyRecipe | null {
  const industryTags: IndustryTag[] = normalizeTags(
    surroundingNodes.flatMap((n) => n.tags)
  );
  for (const recipe of recipes) {
    if (matchesRecipe(tile, industryTags, recipe)) return recipe;
  }
  return null;
}

/**
 * 村庄涌现式融合检测：该村地块（资源标签）+ 本村运营中的产业项目（产业标签）。
 * 返回所有命中的配方（可同时解锁多条流派）。
 */
export function detectVillageSynergies(state: GameState, villageId: string): SynergyRecipe[] {
  const tile = deriveTiles(state).find((t) => t.villageId === villageId);
  if (!tile) return [];
  const villageProjects = state.projects.filter(
    (p) => p.villageId === villageId && (p.status === 'active' || p.status === 'recovered')
  );
  if (villageProjects.length === 0) return [];
  const nodes = deriveIndustryNodes(villageProjects);
  const industryTags: IndustryTag[] = normalizeTags(nodes.flatMap((n) => n.tags));
  return synergyRecipes.filter((r) => matchesRecipe(tile, industryTags, r));
}

/**
 * 产能瓶颈计算（0.5 – 1.2）。
 * - 上游供给=一产（primary_agri）产能和；下游需求=二产（processing）产能和
 * - 完美匹配（供需差 ≤10%）→ 1.2 高效运转加成
 * - 严重不匹配（差 2 倍以上）→ 0.5（原料腐烂 / 产能闲置）
 */
export function calculateBottleneck(
  linkedNodes: { type: IndustryTag; capacity: number }[]
): number {
  const supply = linkedNodes
    .filter((n) => n.type === 'primary_agri')
    .reduce((s, n) => s + n.capacity, 0);
  const demand = linkedNodes
    .filter((n) => n.type === 'processing')
    .reduce((s, n) => s + n.capacity, 0);

  if (supply === 0 && demand === 0) return 1; // 无上下游，不惩罚
  if (demand === 0) return 0.5; // 有原料没加工：烂在地里
  if (supply === 0) return 0.5; // 有工厂没原料：产能闲置

  const ratio = supply / demand;
  const diff = Math.abs(ratio - 1);
  if (diff <= 0.1) return 1.2; // 供需平衡：高效运转
  // 线性衰减到 0.5 封底：diff=0.1→~1.14，diff=1→0.75，diff≥2→0.5
  const factor = Math.max(0.5, 1.2 - 0.4 * Math.min(diff, 1.75));
  return Math.round(factor * 100) / 100;
}
