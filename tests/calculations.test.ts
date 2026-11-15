import { describe, it, expect } from 'vitest';
import { calculateProjectOutput, getActionCostModifier, originOf, DEFAULT_ENVIRONMENT } from '../src/core/calculations';
import type { EnvironmentTraits, Tile } from '../src/core/types';

function makeTile(over: Partial<Tile> & { environment: EnvironmentTraits }): Tile {
  return {
    id: '1,1',
    x: 1,
    y: 1,
    villageId: 'v_yunxi',
    building: null,
    infoAccuracy: 100,
    road: true,
    logisticsCovered: false,
    zoningKind: null,
    ...over,
  };
}

describe('§12 环境与人文阻力：calculations 纯函数', () => {
  it('originOf：锚点 → 三类初始身份', () => {
    expect(originOf('returningStudent')).toBe('origin_student');
    expect(originOf('local')).toBe('origin_veteran');
    expect(originOf('entrusted')).toBe('origin_airdrop');
  });

  it('calculateProjectOutput：平原荒地 = 基础产出', () => {
    const r = calculateProjectOutput(makeTile({ environment: DEFAULT_ENVIRONMENT }), 100);
    expect(r.output).toBe(100);
    expect(r.isFailed).toBe(false);
  });

  it('calculateProjectOutput：石漠化建大棚 → 系数 0.1 且极易烂尾', () => {
    const r = calculateProjectOutput(
      makeTile({ building: '大棚', environment: { terrain: '石漠化', disasterRisk: 55, clanPower: 30, traditionalIdeology: 40 } }),
      100
    );
    expect(r.output).toBe(10);
    expect(r.isFailed).toBe(true);
  });

  it('calculateProjectOutput：深山 → 系数 0.7', () => {
    const r = calculateProjectOutput(
      makeTile({ environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 40 } }),
      100
    );
    expect(r.output).toBe(70);
    expect(r.isFailed).toBe(false);
  });

  it('calculateProjectOutput：观念阻力 >70 排斥大棚/加工厂 → 系数 0.5', () => {
    const env: EnvironmentTraits = { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 75 };
    expect(calculateProjectOutput(makeTile({ building: '大棚', environment: env }), 100).output).toBe(50);
    expect(calculateProjectOutput(makeTile({ building: '加工厂', environment: env }), 100).output).toBe(50);
    // 茅草屋不受观念阻力影响
    expect(calculateProjectOutput(makeTile({ building: '茅草屋', environment: env }), 100).output).toBe(100);
  });

  it('calculateProjectOutput：深山 + 观念阻力 加工厂 = 0.7×0.5=35', () => {
    const r = calculateProjectOutput(
      makeTile({ building: '加工厂', environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 80 } }),
      100
    );
    expect(r.output).toBe(35);
  });

  it('getActionCostModifier：基础 visit/form 各 10 精力', () => {
    const t = makeTile({ environment: DEFAULT_ENVIRONMENT });
    expect(getActionCostModifier('visit', t, 'origin_student')).toBe(10);
    expect(getActionCostModifier('form', t, 'origin_veteran')).toBe(10);
  });

  it('getActionCostModifier：返乡大学生填表减半（5）', () => {
    const t = makeTile({ environment: DEFAULT_ENVIRONMENT });
    expect(getActionCostModifier('form', t, 'origin_student')).toBe(5);
  });

  it('getActionCostModifier：返乡大学生走访宗族 >60 的村翻 1.5 倍（15）', () => {
    const t = makeTile({ environment: { terrain: '平原', disasterRisk: 30, clanPower: 70, traditionalIdeology: 30 } });
    expect(getActionCostModifier('visit', t, 'origin_student')).toBe(15);
  });

  it('getActionCostModifier：退伍军人走访观念阻力 >50 的村直接成功（0）', () => {
    const t = makeTile({ environment: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 65 } });
    expect(getActionCostModifier('visit', t, 'origin_veteran')).toBe(0);
  });

  it('getActionCostModifier：空降干部走访翻倍（20）', () => {
    const t = makeTile({ environment: DEFAULT_ENVIRONMENT });
    expect(getActionCostModifier('visit', t, 'origin_airdrop')).toBe(20);
  });
});
