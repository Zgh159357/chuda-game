import type { EndingId, FiveRatings, GameState, Grade } from '../types';
import { summarizeLedger } from './ledger';

// ============================================================
// 终局：五维评级 + 七种结局
// 成就/代价/组织/转换/温度，S/A/B/C/D
// ============================================================

function grade(value: number, good: boolean): Grade {
  // value 归一化到 0-100 后评级（good=false 时数值越小越好）
  const v = Math.max(0, Math.min(100, value));
  const score = good ? v : 100 - v;
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}

const gradeOrder: Record<Grade, number> = { S: 4, A: 3, B: 2, C: 1, D: 0, F: -1 };

export function computeFiveRatings(state: GameState): FiveRatings {
  const summary = summarizeLedger(state);
  const c = state.county;
  const households = state.villages.flatMap((v) => v.households);
  const coverage = households.length === 0 ? 0 : households.filter((h) => h.registered).length / households.length;
  const avgCanHold = state.villages.length === 0 ? 0 : state.villages.reduce((s, v) => s + v.canHoldIndex, 0) / state.villages.length;
  const avgSubsidy = state.villages.length === 0 ? 0 : state.villages.reduce((s, v) => s + v.subsidyDependence, 0) / state.villages.length;

  // 成就：产出 + 覆盖 + 项目健康
  const achievementScore = Math.min(100, coverage * 50 + Math.max(0, summary.achievement) * 0.4 + avgCanHold * 0.2);

  // 代价：行政负担/债务/透支（低者好）
  const costScore = Math.min(100, c.adminBurden * 1.2 + c.debtRisk * 0.6);

  // 组织：组织成本比率 + 形式主义峰值
  const orgScore = Math.min(100, c.orgCostRatio * 30 + c.formalityPeak * 0.5);

  // 转换：接得住 + 补贴依赖退坡 + 内生治理
  const transitionScore = Math.min(100, avgCanHold * 0.5 + (100 - avgSubsidy) * 0.3 + summary.transition * 0.4);

  // 温度：信任 + 故事线完成 + 采纳提案 + 无底线失守
  const storyDone = state.storylines.filter((s) => s.stageIndex >= 3).length;
  const proposals = state.pendingProposals.length + state.history.reduce((s, h) => s + h.outcome.events.filter((e) => e.type === 'villagerInitiative' && e.proposal).length, 0);
  const temperatureScore = Math.min(
    100,
    c.trust * 0.6 + storyDone * 15 + Math.min(20, proposals * 3) + (state.ending === 'bottomLine' ? 0 : 10)
  );

  return {
    achievement: grade(achievementScore, true),
    cost: grade(costScore, false),
    organization: grade(orgScore, false),
    transition: grade(transitionScore, true),
    temperature: grade(temperatureScore, true),
  };
}

/** 终局结局判定（r50 或硬失败后调用） */
export function decideEnding(state: GameState, ratings: FiveRatings, failures: string[]): EndingId {
  // 硬失败 → 对应结局
  if (failures.includes('bottomLineBreach')) return 'bottomLine';
  if (failures.includes('debtCollapse')) return 'debtBurst';
  if (failures.includes('returnWave')) return 'waveEbb';
  if (failures.includes('trustCollapse')) return 'formalismIdle';
  if (failures.includes('politicalLoss')) return 'waveEbb';
  if (failures.includes('canHoldCollapse')) return 'waveEbb';

  // 隐藏结局：五维温度 S 且其他不低于 A
  if (ratings.temperature === 'S' && gradeOrder[ratings.achievement] >= 3 && gradeOrder[ratings.cost] >= 3 && gradeOrder[ratings.organization] >= 3 && gradeOrder[ratings.transition] >= 3) {
    return 'temperature';
  }

  // 正常终局：按转换与组织维度
  const transition = ratings.transition;
  const org = ratings.organization;

  if (org === 'D') return 'formalismIdle';
  if (state.county.debtRisk >= 70) return 'debtBurst';
  if (transition === 'S') return 'tagsGone';
  if (transition === 'A') return 'canHold';
  if (transition === 'B') return 'waveEbb';
  if (transition === 'C') return 'formalismIdle';
  return 'waveEbb';
}
