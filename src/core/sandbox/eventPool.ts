// ============================================================
// §13 动态事件池调度器（高内聚纯函数层）
// - 条件驱动：事件由玩家行为（财政、疲劳、宗族…）决定是否入池
// - 权重随机：轮盘赌算法（Weighted Random）
// - 连锁事件：特殊选择不立刻扣分，向未来卡池注入 delayedEvent
// ============================================================
import type { EventCondition, GameEventConfig, GameState, RolledEvent } from '../types';

export type RngFn = () => number;

/** 事件池运行时状态（批次 2 接入 GameState 持久化；此处先做纯函数契约） */
export interface PoolState {
  cooldowns: Record<string, number>; // eventId → 最近触发回合
  delayed: { eventId: string; dueRound: number }[]; // 连锁事件队列
}

// ------------------------------------------------------------
// 状态指标解析：把 EventCondition 的 (target, metric) 映射到具体数值
// ------------------------------------------------------------
export function resolveMetric(state: GameState, target: string, metric: string, villageId?: string): number {
  const c = state.county;
  if (target === 'global') {
    switch (metric) {
      case 'fiscalFund': return c.fiscalFund;
      case 'trust': return c.trust;
      case 'politicalCapital': return c.politicalCapital;
      case 'debtRisk': return c.debtRisk;
      case 'pressure': return c.pressure;
      case 'formality': return c.formality;
      case 'ecology': return c.ecology;
      case 'fakeProb': return c.backlash.fakeProb;
      case 'orgDensity': return c.orgDensity;
      case 'infoAccuracy': {
        const n = state.villages.length || 1;
        return state.villages.reduce((s, v) => s + v.infoAccuracy, 0) / n;
      }
      case 'returnRisk': {
        const n = state.villages.length || 1;
        return state.villages.reduce((s, v) => s + v.returnRisk, 0) / n;
      }
      case 'avgFatigue': {
        const n = state.cadres.length || 1;
        return state.cadres.reduce((s, x) => s + x.fatigue, 0) / n;
      }
      case 'avgMorale': {
        const n = state.cadres.length || 1;
        return state.cadres.reduce((s, x) => s + x.morale, 0) / n;
      }
      default: return 0;
    }
  }
  if (target === 'cadre') {
    // 干部聚合指标（策划视角与 global 同名指标等价）
    return resolveMetric(state, 'global', metric, villageId);
  }
  // target === 'village'
  const v = state.villages.find((x) => x.id === villageId);
  if (!v) return 0;
  switch (metric) {
    case 'clanPower': return v.environment.clanPower;
    case 'traditionalIdeology': return v.environment.traditionalIdeology;
    case 'disasterRisk': return v.environment.disasterRisk;
    case 'returnRisk': return v.returnRisk;
    case 'industryBase': return v.industryBase;
    case 'internalGovernance': return v.internalGovernance;
    case 'participation': return v.participation;
    case 'subsidyDependence': return v.subsidyDependence;
    case 'infoAccuracy': return v.infoAccuracy;
    case 'canHoldIndex': return v.canHoldIndex;
    default: return 0;
  }
}

function compare(actual: number, operator: EventCondition['operator'], expected: number): boolean {
  switch (operator) {
    case '<': return actual < expected;
    case '>': return actual > expected;
    case '==': return Math.abs(actual - expected) < 0.001;
    case '<=': return actual <= expected;
    case '>=': return actual >= expected;
  }
}

function condMet(state: GameState, cond: EventCondition, villageId?: string): boolean {
  return compare(resolveMetric(state, cond.target, cond.metric, villageId), cond.operator, cond.value);
}

/**
 * 事件条件判定：
 * - global/cadre：全条件同时满足
 * - village：任一村庄满足全部村庄条件即可，并返回命中村 id
 */
export function conditionsMet(
  state: GameState,
  ev: GameEventConfig,
  villageId?: string
): { ok: boolean; villageId?: string } {
  if (ev.conditions.length === 0) return { ok: true, villageId };
  const villageConds = ev.conditions.filter((c) => c.target === 'village');
  const restConds = ev.conditions.filter((c) => c.target !== 'village');
  if (!restConds.every((c) => condMet(state, c))) return { ok: false };
  if (villageConds.length === 0) return { ok: true, villageId };
  if (villageId) {
    const v = state.villages.find((x) => x.id === villageId);
    if (!v) return { ok: false };
    return villageConds.every((c) => condMet(state, c, villageId)) ? { ok: true, villageId } : { ok: false };
  }
  for (const v of state.villages) {
    if (villageConds.every((c) => condMet(state, c, v.id))) return { ok: true, villageId: v.id };
  }
  return { ok: false };
}

// ------------------------------------------------------------
// 轮盘赌算法（加权随机）
// ------------------------------------------------------------
export function weightedPick<T>(items: T[], weights: number[], rng: RngFn): T | null {
  if (items.length === 0) return null;
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// ------------------------------------------------------------
// 动态事件池调度器（替代固定回合触发）
// ------------------------------------------------------------
export interface RollOptions {
  rng?: RngFn;
  round?: number;
  cooldowns?: Record<string, number>;
  max?: number; // 每回合最多抽几个（默认 3）
}

/**
 * 本回合抽奖：筛选合法池 → 轮盘赌抽 1-3 个（不重复）。
 * 完全由 state + 配置驱动；无任何 `if (turn === N)` 硬编码。
 */
export function rollEventsThisTurn(
  state: GameState,
  allEvents: GameEventConfig[],
  options: RollOptions = {}
): GameEventConfig[] {
  return rollEventsDetailed(state, allEvents, options).map((r) => r.config);
}

/** 带村庄信息的抽奖结果（UI 渲染村庄事件用） */
export function rollEventsDetailed(
  state: GameState,
  allEvents: GameEventConfig[],
  options: RollOptions = {}
): RolledEvent[] {
  const rng: RngFn = options.rng ?? Math.random;
  const round = options.round ?? state.county.round;
  const cooldowns = options.cooldowns ?? {};

  // 合法池：冷却结束 + 条件满足（村庄事件解析到命中村）
  const pool: RolledEvent[] = [];
  for (const ev of allEvents) {
    const last = cooldowns[ev.id];
    if (last !== undefined && ev.cooldownTurns && round - last < ev.cooldownTurns) continue;
    const hit = conditionsMet(state, ev);
    if (hit.ok) pool.push({ config: ev, villageId: hit.villageId });
  }
  if (pool.length === 0) return [];

  // 抽 1-3 个（期望 ~1.8 个）
  let count = 1;
  if (rng() < 0.5) count += 1;
  if (rng() < 0.3) count += 1;
  const max = Math.min(options.max ?? 3, pool.length);
  count = Math.min(count, max);

  const result: RolledEvent[] = [];
  const remain = [...pool];
  for (let i = 0; i < count; i++) {
    const weights = remain.map((r) => r.config.weight);
    const picked = weightedPick(remain, weights, rng);
    if (!picked) break;
    result.push(picked);
    remain.splice(remain.indexOf(picked), 1);
  }
  return result;
}

// ------------------------------------------------------------
// 连锁事件（因果律）：特殊选择 → 注入未来卡池
// ------------------------------------------------------------
/**
 * 处理一次事件选择。不立刻结算效果（效果结算由结算层按 effectsOnAccept/Decline 执行），
 * 只负责因果律：若配置了 delayedEvent，则在后续 3 回合内随机注入对应事件。
 */
export function processEventChoice(
  pool: PoolState,
  event: GameEventConfig,
  isAccepted: boolean,
  round: number,
  rng: RngFn
): PoolState {
  const injectedId = isAccepted ? event.delayedEventOnAccept : event.delayedEventOnDecline;
  if (!injectedId) return pool;
  const dueRound = round + 1 + Math.floor(rng() * 3); // 后续 3 回合内随机爆发
  return {
    ...pool,
    delayed: [...pool.delayed, { eventId: injectedId, dueRound }],
  };
}

/** 到期的连锁事件出队（批次 2 由 reducer 在回合初调用并入池） */
export function dueDelayedEvents(pool: PoolState, round: number): string[] {
  const due = pool.delayed.filter((d) => d.dueRound <= round).map((d) => d.eventId);
  return due;
}
