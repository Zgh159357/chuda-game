// ============================================================
// §20 产业网格沙盒与基础设施网络（第一批：数据结构与派生）
// ============================================================
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state/initialState';
import { playRound } from '../src/core/reducer';
import { serialize, deserialize, SAVE_VERSION } from '../src/core/save';
import { buildIndustryState, primaryFacilityOf, ownerIdOf } from '../src/core/sandbox/industryGrid';
import { terrainToType, typeToTerrain, TERRAIN_CN_TO_TYPE } from '../src/types/game';
import type { FacilityType } from '../src/types/game';

function fresh() {
  return createInitialState(42, 'local');
}

describe('产业网格沙盒（§20 第一批）', () => {
  it('地形映射：中文 ↔ 英文双向一致', () => {
    for (const [cn, en] of Object.entries(TERRAIN_CN_TO_TYPE)) {
      expect(terrainToType(cn as keyof typeof TERRAIN_CN_TO_TYPE)).toBe(en);
      expect(typeToTerrain(en as 'plain' | 'mountain' | 'rocky' | 'hilly')).toBe(cn);
    }
  });

  it('buildIndustryState：36 块网格全铺满', () => {
    const s = fresh();
    const grid = buildIndustryState(s);
    expect(grid.tiles.length).toBe(36);
    expect(grid.tiles.every((t) => t.environment.terrain.length > 0)).toBe(true);
  });

  it('村格携带主产业设施，县格无产业', () => {
    const s = fresh();
    const grid = buildIndustryState(s);
    const yunxi = grid.tiles.find((t) => t.villageId === 'v_yunxi');
    expect(yunxi).toBeDefined();
    expect(yunxi!.facility).not.toBeNull();
    expect(yunxi!.facility!.type).toBe('farm'); // 云溪中药材基地 → primary_agri
    const county = grid.tiles.find((t) => t.villageId === 'county');
    expect(county).toBeDefined();
    expect(county!.facility).toBeNull();
  });

  it('设施污染符合口径：农田负、工厂高', () => {
    const s = fresh();
    const grid = buildIndustryState(s);
    const farm = grid.tiles.find((t) => t.villageId === 'v_yunxi')!.facility!;
    const factory = grid.tiles.find((t) => t.villageId === 'v_qingshi')!.facility!;
    expect(farm.pollutionDelta).toBeLessThan(0);
    expect(factory.pollutionDelta).toBeGreaterThan(0);
    expect(factory.type).toBe('factory');
  });

  it('道路连通边：相邻路格成边', () => {
    const s = fresh();
    const before = buildIndustryState(s).connectedEdges.length;
    // 修一条路（extraRoads 加县治旁空地）
    s.extraRoads = [{ x: 2, y: 3 }];
    const after = buildIndustryState(s).connectedEdges.length;
    expect(after).toBeGreaterThanOrEqual(before);
    // 路网是连通的基础格（村/县/安置点都在路网里）
    const grid = buildIndustryState(s);
    expect(grid.tiles.find((t) => t.villageId === 'county')!.infra?.type).toBe('cold_chain');
    expect(grid.connectedEdges.every((e) => e.type === 'road' && !e.isBlocked)).toBe(true);
  });

  it('县格冷链中枢：空置率反推利用率', () => {
    const s = fresh();
    s.physicalInfra.coldChainIdleRate = 0.5;
    const grid = buildIndustryState(s);
    const county = grid.tiles.find((t) => t.villageId === 'county')!;
    expect(county.infra?.type).toBe('cold_chain');
    expect(county.infra!.utilizationRate).toBe(50);
  });

  it('5G 基站落在村格：APP 使用率即利用率', () => {
    const s = fresh();
    s.physicalInfra.hasSmartAgriApp = true;
    s.physicalInfra.appAdoptionRate = 0.2;
    const grid = buildIndustryState(s);
    const v = grid.tiles.find((t) => t.villageId === 'v_wuling')!;
    expect(v.infra?.type).toBe('5g_base');
    expect(v.infra!.utilizationRate).toBe(20);
  });

  it('总维护费与利息：基建吞金兽', () => {
    const s = fresh();
    s.physicalInfra.coldChainIdleRate = 0.3;
    const grid = buildIndustryState(s);
    expect(grid.totalMaintenanceCost).toBeGreaterThan(0);
    // 债务利息随债务风险上升
    const low = grid.totalDebtInterest;
    s.county.debtRisk = 70;
    const high = buildIndustryState(s).totalDebtInterest;
    expect(high).toBeGreaterThan(low);
  });

  it('ownerIdOf：村/县/安置点归属', () => {
    expect(ownerIdOf(1, 2)).toBe('v_yunxi');
    expect(ownerIdOf(3, 3)).toBe('county');
    expect(ownerIdOf(4, 4)).toBe('site:s_xinping');
    expect(ownerIdOf(0, 0)).toBe('');
  });

  it('回合管线后网格同步重建（含新设施）', () => {
    const s = fresh();
    const out = playRound(s, {});
    expect(out.state.industryGrid.tiles.length).toBe(36);
    // 云溪主设施仍派生自项目
    expect(primaryFacilityOf(out.state, 'v_yunxi')).not.toBeNull();
  });

  it('存档 v18 往返：industryGrid 保留', () => {
    const s = fresh();
    const back = deserialize(serialize(s));
    expect(back.version).toBe(18);
    expect(SAVE_VERSION).toBe(18);
    expect(back.industryGrid.tiles.length).toBe(36);
    expect(back.industryGrid.totalMaintenanceCost).toBe(s.industryGrid.totalMaintenanceCost);
  });
});
