import type { GameState, IndustryNode, IndustryTag, ResourceTag, SynergyCatalyst, SynergyRecipe, Tile } from '../types';
import { deriveIndustryNodes, synergyRecipes, synergyCatalysts, industryNodes } from '../../config/industry';
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
export function matchesRecipe(
  tile: Tile,
  industryTags: IndustryTag[],
  recipe: SynergyRecipe,
  catalyst?: SynergyCatalyst | null
): boolean {
  const tileResources: ResourceTag[] = normalizeTags(tile.environment.resources ?? []);
  const resourceOk = hasAll(tileResources, recipe.requiredResourceTags);
  const industryOk = hasAll(industryTags, recipe.requiredIndustryTags);
  const terrainOk = !recipe.requiredTerrain || tile.environment.terrain === recipe.requiredTerrain;
  // §15 反面配方：有禁用标签则成不了（民宿没路 → 有 logistics 就否决）
  const forbidden = recipe.forbiddenIndustryTags ?? [];
  const forbiddenOk = forbidden.every((t) => !industryTags.includes(t));
  // §15 商机限时：配方挂 catalyst 时，仅当本回合商机匹配才可炼出
  const catalystOk = !recipe.catalystId || catalyst?.id === recipe.catalystId;
  return resourceOk && industryOk && terrainOk && forbiddenOk && catalystOk;
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
  recipes: SynergyRecipe[],
  catalyst?: SynergyCatalyst | null
): SynergyRecipe | null {
  const industryTags: IndustryTag[] = normalizeTags(
    surroundingNodes.flatMap((n) => n.tags)
  );
  for (const recipe of recipes) {
    if (matchesRecipe(tile, industryTags, recipe, catalyst)) return recipe;
  }
  return null;
}

/**
 * §15 本回合商机抽签（每回合开局第一抽，UI「商机横幅」与结算共用同一 rng 序）。
 * 返回抽中的催化剂；null=本回合无商机。
 */
export function drawCatalyst(rng: { (): number }): SynergyCatalyst | null {
  const totalWeight = synergyCatalysts.reduce((s, c) => s + c.weight, 0);
  const emptyWeight = Math.max(0, 6 - totalWeight); // 无商机档：让天时不是天天有
  const roll = rng() * (totalWeight + emptyWeight);
  let acc = 0;
  for (const c of synergyCatalysts) {
    acc += c.weight;
    if (roll < acc) return c;
  }
  return null;
}

/**
 * 村庄涌现式融合检测：该村地块（资源标签）+ 本村运营中的产业项目与自建设施（产业标签）。
 * 返回所有命中的配方（可同时解锁多条流派）。
 * §15：内置进化前置（requiredTitles）、人才联动（requiredHeroId）、商机限时（catalystId）。
 */
export function detectVillageSynergies(
  state: GameState,
  villageId: string,
  catalyst?: SynergyCatalyst | null
): SynergyRecipe[] {
  const tile = deriveTiles(state).find((t) => t.villageId === villageId);
  if (!tile) return [];
  const villageProjects = state.projects.filter(
    (p) => p.villageId === villageId && (p.status === 'active' || p.status === 'recovered')
  );
  const built: (IndustryNode & { capacity: number })[] = (state.builtNodes ?? [])
    .filter((b) => b.villageId === villageId)
    .map((b) => {
      const spec = industryNodes.find((n) => n.id === b.nodeId);
      return {
        id: b.id,
        name: spec?.name ?? b.nodeId,
        tags: spec?.tags ?? [],
        baseOutput: spec?.baseOutput ?? 10,
        cost: 0,
        capacity: 0,
      };
    });
  if (villageProjects.length === 0 && built.length === 0) return [];
  const nodes = deriveIndustryNodes(villageProjects).concat(built);
  const industryTags: IndustryTag[] = normalizeTags(nodes.flatMap((n) => n.tags));
  const titles = state.villages.find((v) => v.id === villageId)?.synergyTitles ?? [];
  return synergyRecipes.filter((r) => {
    if (!matchesRecipe(tile, industryTags, r, catalyst)) return false;
    // §15 进化前置：配方需要已解锁的头衔
    if (r.requiredTitles && !r.requiredTitles.every((t) => titles.includes(t))) return false;
    // §15 人才联动：需要指定人才派驻本村
    if (r.requiredHeroId) {
      const hero = (state.heroes ?? []).find(
        (h) => h.heroId === r.requiredHeroId && h.villageId === villageId
      );
      if (!hero) return false;
    }
    return true;
  });
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
