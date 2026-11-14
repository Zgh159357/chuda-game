import type { Config } from '../core/types';
import { formulas } from './formulas';
import { balance } from './balance';
import { phases, checkpoints, timeLabels } from './phases';
import { measures, policies, skills, traits, negotiationHands, techTree, wonders, heroes, achievements, rewards, storylines, endings } from './content';
import { eventFiles } from './eventFiles';
import { nodeActions } from './nodeActions';
import { text } from './text';

// ============================================================
// 配置聚合 —— 游戏逻辑只 import 这一个对象
// ============================================================
export const config: Config = {
  formulas,
  phases,
  checkpoints,
  measures,
  policies,
  skills,
  traits,
  negotiationHands,
  techTree,
  wonders,
  heroes,
  nodeActions,
  eventFiles,
  achievements,
  rewards,
  storylines,
  endings,
  balance,
  text,
  timeLabels,
};

export * from './formulas';
export * from './balance';
export * from './phases';
export * from './content';
export * from './eventFiles';
export * from './nodeActions';
export * from './text';
export * from './world';
