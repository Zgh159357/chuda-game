import { describe, it, expect } from 'vitest';
import { calculateSynergy, calculateBottleneck, normalizeTags } from '../src/core/sandbox/industryEngine';
import { synergyRecipes, industryNodes, deriveIndustryNodes, PROJECT_TAG_MAP } from '../src/config/industry';
import { createInitialState } from '../src/core/state/initialState';
import { deriveTiles } from '../src/core/sandbox/logistics';
import type { IndustryNode, SynergyRecipe, Tile } from '../src/core/types';

function tile(over: Partial<Tile>): Tile {
  return {
    id: '1,1',
    x: 1,
    y: 1,
    villageId: 'v_yunxi',
    environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: [] },
    building: null,
    infoAccuracy: 100,
    road: true,
    logisticsCovered: false,
    zoningKind: null,
    ...over,
  } as Tile;
}

const nodes = (tags: IndustryNode['tags']): IndustryNode[] =>
  tags.map((t, i) => ({ id: `n${i}`, name: `节点${i}`, tags: [t], baseOutput: 10, cost: 10 }));

describe('§14 产业融合引擎', () => {
  it('normalizeTags：去重保持顺序', () => {
    expect(normalizeTags(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('配方 A 特色农业：富硒土壤 + 种植 + 物流 → 命中', () => {
    const t = tile({ environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: ['rich_selenium'] } });
    const r = calculateSynergy(t, nodes(['primary_agri', 'logistics']), synergyRecipes);
    expect(r?.id).toBe('recipe_se_agri');
    expect(r?.outputMultiplier).toBe(2.0);
  });

  it('配方 B 农旅融合：非遗 + 闲置农房 + 服务 + 加工 → 命中', () => {
    const t = tile({ environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 65, resources: ['non_heritage', 'idle_houses'] } });
    const r = calculateSynergy(t, nodes(['service', 'processing']), synergyRecipes);
    expect(r?.id).toBe('recipe_agri_tourism');
    expect(r?.unlockVillageTitle).toBe('网红打卡地');
  });

  it('配方 C 光伏农业：充足日照 + 光伏 + 种植 → 命中', () => {
    const t = tile({ environment: { terrain: '石漠化', disasterRisk: 55, clanPower: 35, traditionalIdeology: 50, resources: ['sunlight'] } });
    const r = calculateSynergy(t, nodes(['energy', 'primary_agri']), synergyRecipes);
    expect(r?.id).toBe('recipe_pv_agri');
  });

  it('配方 D 电商淘宝村：闲置农房 + 物流 + 服务 → 命中', () => {
    const t = tile({ environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: ['idle_houses'] } });
    const r = calculateSynergy(t, nodes(['logistics', 'service']), synergyRecipes);
    expect(r?.id).toBe('recipe_ecom_village');
  });

  it('配方 E 高山特色药业：限定深山地形，平原则不命中', () => {
    const deep = tile({ environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 65, resources: [] } });
    expect(calculateSynergy(deep, nodes(['primary_agri', 'processing']), synergyRecipes)?.id).toBe('recipe_herb_mountain');
    const plain = tile({ environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: [] } });
    expect(calculateSynergy(plain, nodes(['primary_agri', 'processing']), synergyRecipes)).toBeNull();
  });

  it('标签不齐不命中；资源标签重复也不影响（去重比对）', () => {
    const t = tile({ environment: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: ['rich_selenium', 'rich_selenium'] } });
    expect(calculateSynergy(t, nodes(['primary_agri']), synergyRecipes)).toBeNull(); // 缺物流
    expect(calculateSynergy(t, nodes(['primary_agri', 'logistics']), synergyRecipes)?.id).toBe('recipe_se_agri');
  });

  it('calculateBottleneck：完美匹配 1.2 / 供给过剩 / 工厂饿死 / 无链不惩罚', () => {
    expect(calculateBottleneck([{ type: 'primary_agri', capacity: 100 }, { type: 'processing', capacity: 100 }])).toBe(1.2);
    expect(calculateBottleneck([{ type: 'primary_agri', capacity: 200 }, { type: 'processing', capacity: 100 }])).toBeLessThan(1);
    expect(calculateBottleneck([{ type: 'primary_agri', capacity: 10 }, { type: 'processing', capacity: 100 }])).toBeLessThan(0.9);
    expect(calculateBottleneck([{ type: 'primary_agri', capacity: 500 }, { type: 'processing', capacity: 100 }])).toBe(0.5);
    expect(calculateBottleneck([{ type: 'processing', capacity: 100 }])).toBe(0.5); // 只有工厂
    expect(calculateBottleneck([])).toBe(1);
  });

  it('配置自洽：4+1 个配方、5 个蓝图节点、6 个项目标签映射', () => {
    expect(synergyRecipes.length).toBe(5);
    expect(industryNodes.length).toBe(5);
    expect(Object.keys(PROJECT_TAG_MAP).length).toBe(6);
    for (const r of synergyRecipes) {
      expect(r.outputMultiplier).toBeGreaterThan(1);
      expect(r.unlockVillageTitle.length).toBeGreaterThan(0);
    }
  });

  it('与沙盘联动：雾岭村地块+光伏电站+电商站 → 可炼出配方（村庄真实配置）', () => {
    const s0 = createInitialState(1, 'local');
    const tiles = deriveTiles(s0);
    const wuling = tiles.find((t) => t.villageId === 'v_wuling' && t.x === 4 && t.y === 2)!;
    expect(wuling.environment.resources).toEqual(['non_heritage', 'idle_houses']);
    const derived = deriveIndustryNodes(s0.projects);
    // 全县项目标签并集：primary_agri+processing+energy+logistics+service
    // 雾岭资源=非遗+闲置房 → 农旅融合（service+processing）在表序中先于电商命中
    const r = calculateSynergy(wuling, derived, synergyRecipes);
    expect(r?.id).toBe('recipe_agri_tourism');
  });
});
