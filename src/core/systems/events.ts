import type { EventFileSpec, EventOptionSpec, GameState, RoundActions } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { addCadreFatigue, spendCadreEnergy } from './cadres';

// ============================================================
// 公文批阅系统（重构）：事件文件发牌 / 批复结算 / 逾期自动结算
// 文件按 trigger 过滤，只发符合当前阶段且未发过的；
// 逾期未批按 autoWorst（禁用 C=造假）自动结算。
// ============================================================

const INBOX_CAP = 3;

function eligibleFiles(state: GameState, round: number): EventFileSpec[] {
  const c = state.county;
  return config.eventFiles.filter((f) => {
    if (state.eventFilesSeen.includes(f.id)) return false;
    if (state.eventInbox.some((e) => e.fileId === f.id)) return false;
    const t = f.trigger;
    if (t.minRound && round < t.minRound) return false;
    if (t.maxRound && round > t.maxRound) return false;
    if (t.phase && t.phase !== c.phase) return false;
    return true;
  });
}

/** 回合开始发牌：普通回合 1 份，大考回合 2 份（上限 3 份待批） */
export function drawEventFiles(state: GameState, ctx: TurnCtx): void {
  const isMilestone = config.balance.milestoneRounds.includes(ctx.round);
  const want = isMilestone ? 2 : 1;
  const room = Math.max(0, INBOX_CAP - state.eventInbox.length);
  const draw = Math.min(want, room);
  const pool = eligibleFiles(state, ctx.round);
  for (let i = 0; i < draw && pool.length > 0; i++) {
    // 确定性取件：按 id 序取第一份（种子化可复现）
    const file = pool.shift()!;
    state.eventInbox.push({ fileId: file.id, deadline: ctx.round + file.deadlineRounds });
    state.eventFilesSeen.push(file.id);
  }
}

/** 找文件作用的村：trigger 指定村，否则按效果类型就近取村 */
function targetVillage(state: GameState, file: EventFileSpec): GameState['villages'][number] | null {
  if (file.trigger.villageId) {
    return state.villages.find((v) => v.id === file.trigger.villageId) ?? state.villages[0] ?? null;
  }
  return state.villages[0] ?? null;
}

function applyEventEffects(state: GameState, file: EventFileSpec, option: EventOptionSpec, ctx: TurnCtx): void {
  const county = state.county;
  const village = targetVillage(state, file);
  for (const ef of option.effects) {
    switch (ef.kind) {
      case 'fiscal':
        county.fiscalFund = Math.max(0, county.fiscalFund + ef.value);
        break;
      case 'coop':
        county.cooperationFund = Math.max(0, county.cooperationFund + ef.value);
        break;
      case 'trust':
        county.trust = Math.max(0, Math.min(100, county.trust + ef.value));
        break;
      case 'formality':
        county.formality = Math.max(0, county.formality + ef.value);
        break;
      case 'fakeProb':
        county.backlash.fakeProb = Math.max(0, county.backlash.fakeProb + ef.value);
        break;
      case 'fraudRecord':
        state.fraudRecords.push({ fileId: file.id, round: ctx.round });
        break;
      case 'energy':
        spendCadreEnergy(state, -ef.value, file.trigger.villageId);
        break;
      case 'fatigue':
        addCadreFatigue(state, ef.value, file.trigger.villageId);
        break;
      case 'morale':
        for (const cad of state.cadres) cad.morale = Math.max(0, Math.min(100, cad.morale + ef.value));
        break;
      case 'politicalCapital':
        county.politicalCapital = Math.max(0, Math.min(100, county.politicalCapital + ef.value));
        break;
      case 'debtRisk':
        county.debtRisk = Math.max(0, county.debtRisk + ef.value);
        break;
      case 'returnRisk':
        if (village) village.returnRisk = Math.max(0, village.returnRisk + ef.value);
        else for (const v of state.villages) v.returnRisk = Math.max(0, v.returnRisk + ef.value);
        break;
      case 'participation':
        if (village) village.participation = Math.max(0, Math.min(100, village.participation + ef.value));
        break;
      case 'industryBase':
        if (village) village.industryBase = Math.max(0, Math.min(100, village.industryBase + ef.value));
        break;
      case 'subsidyDependence':
        if (village) village.subsidyDependence = Math.max(0, Math.min(100, village.subsidyDependence + ef.value));
        break;
      case 'exitWillingness':
        if (village) for (const h of village.households) h.exitWillingness = Math.max(0, Math.min(100, h.exitWillingness + ef.value));
        break;
      case 'adminBurden':
        county.adminBurden = Math.max(0, county.adminBurden + ef.value);
        break;
      default:
        break;
    }
  }
}

function settleOption(state: GameState, file: EventFileSpec, option: EventOptionSpec, ctx: TurnCtx): void {
  applyEventEffects(state, file, option, ctx);
  // 记账：稳重进转换账；代价进成本账；造假进成本账并记陷阱（终局审判）
  if (option.tone === 'fraud') {
    ctx.pushLedger('cost', `fraud_${file.id}`, -6, `《${file.title}》造假批复`);
    state.trapRewards.push({ rewardId: `file_${file.id}`, round: ctx.round, cost: 6 });
  } else if (option.tone === 'costly') {
    ctx.pushLedger('cost', `file_${file.id}`, -4, `《${file.title}》代价批复`);
  } else {
    ctx.pushLedger('transition', `file_${file.id}`, 2, `《${file.title}》稳妥处置`);
  }
}

/** 行动层：处理玩家的批复（双层视图：批复耗组长个人精力，不足则批复未成） */
export function resolveEventDecisions(state: GameState, actions: RoundActions, ctx: TurnCtx): void {
  for (const dec of actions.eventDecisions ?? []) {
    const idx = state.eventInbox.findIndex((e) => e.fileId === dec.fileId);
    if (idx < 0) continue;
    const file = config.eventFiles.find((f) => f.id === dec.fileId);
    if (!file) continue;
    const option = file.options.find((o) => o.id === dec.optionId);
    if (!option) continue;
    // 精力闸门：防御性校验（UI 已挡，reducer 再挡一次）
    const staminaCost = config.balance.fileOptionStamina[dec.optionId] ?? 0;
    if (state.county.playerStamina < staminaCost) continue;
    state.county.playerStamina -= staminaCost;
    state.eventInbox.splice(idx, 1);
    settleOption(state, file, option, ctx);
    ctx.pushEvent({ type: 'eventFileResolved', round: ctx.round, fileId: file.id, optionId: dec.optionId });
  }
}

/** 回合末：逾期未批 → 按 autoWorst 自动结算 */
export function expireEventFiles(state: GameState, ctx: TurnCtx): void {
  const expired = state.eventInbox.filter((e) => e.deadline < ctx.round);
  for (const e of expired) {
    state.eventInbox = state.eventInbox.filter((x) => x.fileId !== e.fileId);
    const file = config.eventFiles.find((f) => f.id === e.fileId);
    if (!file) continue;
    const option = file.options.find((o) => o.id === file.autoWorst) ?? file.options[0];
    settleOption(state, file, option, ctx);
    ctx.pushEvent({ type: 'eventFileExpired', round: ctx.round, fileId: file.id, optionId: option.id });
  }
}
