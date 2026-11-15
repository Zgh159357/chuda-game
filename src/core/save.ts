import type { EnvironmentTraits, GameState, Round } from './types';
import { config } from '../config';
import { makeCadres } from '../config/world';

// ============================================================
// 存档：序列化 / 反序列化 / localStorage 持久化
// version 字段预留结构演进；按 50 回合预留历史快照。
// v2（重构）：新增干部/事件文件/迷雾摸排字段，v1 存档自动迁移。
// v3（双层视图）：新增组长个人精力 playerStamina，v2 存档自动迁移。
// v4（规划画区）：新增沙盘规划 zoning，v3 存档自动迁移。
// v5（进阶系统）：新增物流（logisticsStation/extraRoads）、干部特质、安置点凝聚力，v4 存档自动迁移。
// v6（核心驱动力）：新增机制树/超级工程/人才，v5 存档自动迁移。
// v7（因果律扩展）：新增事件历史/连击状态/人才两难队列，v6 存档自动迁移。
// v8（组织韧性）：新增组织韧性池/传帮带产出系数，v7 存档自动迁移。
// v9（治理护盾）：新增村级治理护盾，v8 存档自动迁移。
// ============================================================

const STORAGE_KEY = 'chuda.save.v12';
const LEGACY_KEYS = ['chuda.save.v11', 'chuda.save.v10', 'chuda.save.v9', 'chuda.save.v8', 'chuda.save.v7', 'chuda.save.v6', 'chuda.save.v5', 'chuda.save.v4', 'chuda.save.v3', 'chuda.save.v2', 'chuda.save.v1'];
export const SAVE_VERSION = 12;

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** v1 → v2：补干部、事件、摸排等重构字段 */
function migrateV1(data: GameState): void {
  // 干部（v1 无 cadres）
  if (!Array.isArray(data.cadres) || data.cadres.length === 0) {
    data.cadres = makeCadres();
  }
  // 事件文件
  if (!Array.isArray(data.eventInbox)) data.eventInbox = [];
  if (!Array.isArray(data.eventFilesSeen)) data.eventFilesSeen = [];
  if (!Array.isArray(data.fraudRecords)) data.fraudRecords = [];
  // 迷雾摸排：已建过档的村视为已摸排
  for (const v of data.villages) {
    if (typeof v.surveyed !== 'boolean') v.surveyed = v.infoAccuracy >= 40;
  }
  if (typeof data.county.fatigueEvents !== 'number') data.county.fatigueEvents = 0;
  // 新卡：A 阶段 4 张（软锁修复）+ 产业摸排（三卡槽）
  const NEW_CARDS = ['a_public', 'a_recheck', 'a_meeting', 'a_link', 'a_survey'];
  if (data.unlocked?.policies?.includes('a_register')) {
    for (const id of NEW_CARDS) {
      if (!data.unlocked.policies.includes(id)) data.unlocked.policies.push(id);
    }
  }
}

/** v2 → v3：补组长个人精力（双层视图） */
function migrateV2(data: GameState): void {
  if (typeof data.county.playerStamina !== 'number') {
    data.county.playerStamina = 6;
  }
}

/** v3 → v4：补沙盘规划画区（Zoning） */
function migrateV3(data: GameState): void {
  if (!Array.isArray(data.zoning)) data.zoning = [];
}

/** v4 → v5：补物流（物流站/道路）、干部特质、安置点凝聚力 */
function migrateV4(data: GameState): void {
  if (!Array.isArray(data.extraRoads)) data.extraRoads = [];
  if (typeof data.county.logisticsStation !== 'boolean') data.county.logisticsStation = false;
  for (const cad of data.cadres ?? []) {
    if (!Array.isArray(cad.traits)) cad.traits = [];
  }
  for (const site of data.sites ?? []) {
    if (typeof site.communityCohesion !== 'number') site.communityCohesion = 40;
    if (!Array.isArray(site.facilities)) site.facilities = [];
  }
}

/** v5 → v6：补机制树 / 超级工程 / 人才（核心驱动力） */
function migrateV5(data: GameState): void {
  if (!Array.isArray(data.techUnlocked)) data.techUnlocked = [];
  if (!Array.isArray(data.wonders) || data.wonders.length === 0) {
    data.wonders = config.wonders.map((w) => ({ id: w.id, invested: 0, built: false }));
  }
  if (!Array.isArray(data.heroes)) data.heroes = [];
}

/** v6 → v7：补事件历史 / 连击状态 / 人才两难队列（因果律扩展） */
function migrateV6(data: GameState): void {
  if (!Array.isArray(data.eventHistory)) data.eventHistory = [];
  if (!data.streaks) {
    data.streaks = { fraudClean: 0, cutCorners: 0, rank: 0, villageStall: {} };
  } else {
    if (typeof data.streaks.fraudClean !== 'number') data.streaks.fraudClean = 0;
    if (typeof data.streaks.cutCorners !== 'number') data.streaks.cutCorners = 0;
    if (typeof data.streaks.rank !== 'number') data.streaks.rank = 0;
    if (!data.streaks.villageStall) data.streaks.villageStall = {};
  }
  if (!Array.isArray(data.pendingRecruits)) data.pendingRecruits = [];
  if (!Array.isArray(data.declinedRecruits)) data.declinedRecruits = [];
}

/** v7 → v8：补组织韧性池与传帮带产出系数（组织韧性） */
function migrateV7(data: GameState): void {
  const r = config.balance.resilience;
  if (typeof data.county.organizationalResilience !== 'number') {
    data.county.organizationalResilience = r.initialMax;
  }
  if (typeof data.county.maxResilience !== 'number') {
    data.county.maxResilience = r.initialMax;
  }
  for (const v of data.villages) {
    if (typeof v.industryOutputMul !== 'number') v.industryOutputMul = 1;
  }
}

/** v8 → v9：补村级治理护盾（governanceShield，§11） */
function migrateV8(data: GameState): void {
  for (const v of data.villages) {
    if (typeof v.governanceShield !== 'number') v.governanceShield = 0;
  }
}

/** 各村的默认环境特征（§12 迁移与容错共用） */
const DEFAULT_ENV_BY_VILLAGE: Record<string, EnvironmentTraits> = {
  v_yunxi: { terrain: '平原', disasterRisk: 30, clanPower: 40, traditionalIdeology: 45, resources: ['fertile_soil', 'rich_selenium'] },
  v_wuling: { terrain: '深山', disasterRisk: 45, clanPower: 55, traditionalIdeology: 65, resources: ['non_heritage', 'idle_houses'] },
  v_qingshi: { terrain: '石漠化', disasterRisk: 55, clanPower: 35, traditionalIdeology: 50, resources: ['sunlight'] },
};

/** v9 → v10：补村级环境特征（environment，§12） */
function migrateV9(data: GameState): void {
  for (const v of data.villages) {
    if (!v.environment) {
      v.environment = DEFAULT_ENV_BY_VILLAGE[v.id] ?? { terrain: '平原', disasterRisk: 30, clanPower: 30, traditionalIdeology: 30, resources: [] };
    }
  }
}

/** v10 → v11：补环境隐性资源标签（resources，§14） */
function migrateV10(data: GameState): void {
  for (const v of data.villages) {
    if (!Array.isArray(v.environment.resources)) {
      v.environment.resources = DEFAULT_ENV_BY_VILLAGE[v.id]?.resources ?? [];
    }
  }
}

/** v11 → v12：补涌现式融合流派头衔（synergyTitles，§14 第二批） */
function migrateV11(data: GameState): void {
  for (const v of data.villages) {
    if (!Array.isArray(v.synergyTitles)) v.synergyTitles = [];
  }
}

export function deserialize(json: string): GameState {
  const data = JSON.parse(json) as GameState;
  if (data.version === 1) {
    migrateV1(data);
    data.version = 2;
  }
  if (data.version === 2) {
    migrateV2(data);
    data.version = 3;
  }
  if (data.version === 3) {
    migrateV3(data);
    data.version = 4;
  }
  if (data.version === 4) {
    migrateV4(data);
    data.version = 5;
  }
  if (data.version === 5) {
    migrateV5(data);
    data.version = 6;
  }
  if (data.version === 6) {
    migrateV6(data);
    data.version = 7;
  }
  if (data.version === 7) {
    migrateV7(data);
    data.version = 8;
  }
  if (data.version === 8) {
    migrateV8(data);
    data.version = 9;
  }
  if (data.version === 9) {
    migrateV9(data);
    data.version = 10;
  }
  if (data.version === 10) {
    migrateV10(data);
    data.version = 11;
  }
  if (data.version === 11) {
    migrateV11(data);
    data.version = SAVE_VERSION;
  }
  if (data.version !== SAVE_VERSION) {
    throw new Error(`存档版本不兼容：存档 v${data.version}，当前 v${SAVE_VERSION}`);
  }
  return data;
}

export function saveToLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // 存储满/隐私模式等：静默失败，不打断游戏
  }
}

export function loadFromLocal(): GameState | null {
  try {
    // 新档优先；旧版本键（v1..v5）找到后原地迁移到 v6 键
    const keys = [STORAGE_KEY, ...LEGACY_KEYS];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = deserialize(raw);
      if (key !== STORAGE_KEY) {
        localStorage.setItem(STORAGE_KEY, serialize(state));
      }
      return state;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 短局模式：前 18 回合 */
export const SHORT_GAME_ROUNDS = 18;

export function isShortGameEnd(state: GameState): boolean {
  return state.county.round >= SHORT_GAME_ROUNDS;
}

/** 章节边界（存档点）：4/20/32/41 */
export const CHAPTER_BOUNDARIES: Round[] = [4, 20, 32, 41];

export function nextChapterBoundary(round: Round): Round | null {
  for (const b of CHAPTER_BOUNDARIES) {
    if (b > round) return b;
  }
  return null;
}
