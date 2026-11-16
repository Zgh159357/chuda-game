import type { GameState, HouseholdGroup, MeasureId, PovertyTag, RoundActions } from '../types';
import { config } from '../../config';
import type { TurnCtx } from './context';
import { applyCardEffects } from './cardEffects';
import { deriveRoadSet, logisticsCoveredAt } from '../sandbox/logistics';
import { resolveNegotiation } from '../sandbox/negotiation';
import { industryNodes } from '../../config/industry';

// ============================================================
// 行动解析：把 UI 产出的 RoundActions 变成状态变化
// （扣资源 / 建档 / 派队 / 处置 / 追查 / 修复 / 搬迁 / 承诺）
// ============================================================

function findHousehold(state: GameState, groupId: string): HouseholdGroup | undefined {
  for (const v of state.villages) {
    const h = v.households.find((x) => x.id === groupId);
    if (h) return h;
  }
  return undefined;
}

/** 修路行动：把公路推进到离县治最近的一块「尚未通路的荒坡」（须与现有路网邻接） */
function buildRoadSegment(state: GameState): void {
  const road = deriveRoadSet(state);
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      if (road.has(`${x},${y}`)) continue;
      const adj = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([ax, ay]) => road.has(`${ax},${ay}`));
      if (!adj) continue;
      candidates.push({ x, y, d: Math.abs(x - 3) + Math.abs(y - 3) });
    }
  }
  candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const pick = candidates[0];
  if (!pick) return;
  state.extraRoads.push({ x: pick.x, y: pick.y });
  void logisticsCoveredAt;
}

export function resolveActions(state: GameState, actions: RoundActions, ctx: TurnCtx): void {
  const c = state.county;

  // ----- 瞄准等级（行政成本在 targeting 系统结算） -----
  c.lastTargeting = actions.targetingLevel;

  // ----- 财政投入：全县产业投资（分摊到各村项目） -----
  if (actions.fiscal > 0) {
    const overdraw = Math.max(0, actions.fiscal - c.fiscalFund);
    c.fiscalFund = Math.max(0, c.fiscalFund - actions.fiscal);
    if (overdraw > 0) {
      // 借贷：债务风险上升
      c.debtRisk = Math.min(100, c.debtRisk + overdraw * 0.5);
      ctx.pushLedger('cost', 'fiscalBorrow', -overdraw, '财政透支');
    }
    const perVillage = actions.fiscal / Math.max(1, state.villages.length);
    for (const v of state.villages) {
      v.industryBase = Math.min(100, v.industryBase + perVillage * 0.4);
      for (const pid of v.projects) {
        const p = state.projects.find((x) => x.id === pid);
        if (p) p.invested += perVillage;
      }
    }
    ctx.pushLedger('achievement', 'fiscalInvest', actions.fiscal, '财政产业投入');
    ctx.pushLedger('cost', 'fiscalSpend', -actions.fiscal, '财政支出');
  }

  // ----- 协作资金：受东部意愿影响 -----
  if (actions.coop > 0) {
    const effective = (actions.coop * c.eastWillingness) / 100;
    const overdraw = Math.max(0, actions.coop - c.cooperationFund);
    c.cooperationFund = Math.max(0, c.cooperationFund - actions.coop);
    if (overdraw > 0) c.eastWillingness = Math.max(0, c.eastWillingness - 5);
    const perVillage = effective / Math.max(1, state.villages.length);
    for (const v of state.villages) {
      v.industryChannel = Math.min(100, v.industryChannel + perVillage * 0.5);
    }
    ctx.pushLedger('achievement', 'coopInvest', effective, '协作资金实效');
  }

  // ----- 承诺档位（政治责任链） -----
  if (actions.commitment) {
    c.commitment = actions.commitment;
    c.commitmentRound = ctx.round;
    if (actions.commitment === 'overachieve') {
      c.politicalCapital = Math.min(100, c.politicalCapital + 5);
      c.pressure += 10;
      // 陷阱记录：争先承诺（终局复盘标出）
      state.trapRewards.push({ rewardId: 'trap_overcommit', round: ctx.round, cost: 0 });
    } else if (actions.commitment === 'conservative') {
      c.politicalCapital = Math.max(0, c.politicalCapital - 3);
      c.pressure = Math.max(0, c.pressure - 5);
    }
  }

  // ----- 政策卡（G2：只打已解锁的卡；成本不足自动跳过） -----
  // 三卡槽（重构）：三槽齐出给「调度有方」加成（只连行为不连数字）
  if (actions.slots) {
    const filled = Object.values(actions.slots).filter((x) => !!x);
    if (filled.length === 3) {
      ctx.addStars(5);
      ctx.pushFeedback('mf_scheduler', 'mf_slot_full_text');
    }
  }
  // 双层视图重构：卡槽（可指派到村）优先，旧式 cards 并入（去重取并集）
  const plays: { cardId: string; villageId?: string }[] = [];
  if (actions.slots) {
    for (const kind of ['party', 'industry', 'livelihood'] as const) {
      const s = actions.slots[kind];
      if (s) plays.push({ cardId: s.cardId, villageId: s.villageId });
    }
  }
  for (const cardId of actions.cards ?? []) {
    if (!plays.some((p) => p.cardId === cardId)) plays.push({ cardId });
  }
  const playedIds = plays.map((p) => p.cardId);
  for (const play of plays) {
    if (!state.unlocked.policies.includes(play.cardId)) continue;
    const card = config.policies.find((p) => p.id === play.cardId);
    if (!card) continue;
    applyCardEffects(state, card, playedIds, ctx, play.villageId);
  }

  // ----- 大地图节点交互（双层视图：耗组长个人精力） -----
  for (const actionId of actions.nodeActions ?? []) {
    const spec = config.nodeActions.find((n) => n.id === actionId);
    if (!spec) continue;
    // 已建成的一次性设施：跳过且不耗精力
    if (actionId === 'logistics_station' && c.logisticsStation) continue;
    if ((actionId === 'site_plaza' || actionId === 'site_workshop') && state.sites[0]?.facilities.includes(actionId === 'site_plaza' ? 'plaza' : 'workshop')) continue;
    if (c.playerStamina < spec.cost) continue;
    c.playerStamina -= spec.cost;
    for (const e of spec.effects) {
      switch (e.kind) {
        case 'formality':
          c.formality = Math.max(0, c.formality + e.value);
          break;
        case 'politicalCapital':
          c.politicalCapital = Math.max(0, Math.min(100, c.politicalCapital + e.value));
          break;
        case 'trust':
          c.trust = Math.max(0, Math.min(100, c.trust + e.value));
          break;
        case 'fiscalFund':
          c.fiscalFund = Math.max(0, c.fiscalFund + e.value);
          break;
        case 'debtRisk':
          c.debtRisk = Math.max(0, Math.min(100, c.debtRisk + e.value));
          break;
        case 'orgDensity':
          c.orgDensity = Math.max(0, Math.min(100, c.orgDensity + e.value));
          break;
        case 'morale':
          for (const cad of state.cadres) cad.morale = Math.max(0, Math.min(100, cad.morale + e.value));
          break;
        case 'siteLivelihood': {
          const site = state.sites[0];
          if (site) site.livelihoodSelfReliance = Math.max(0, Math.min(100, site.livelihoodSelfReliance + e.value));
          break;
        }
        case 'siteCohesion': {
          const site = state.sites[0];
          if (site) site.communityCohesion = Math.max(0, Math.min(100, site.communityCohesion + e.value));
          break;
        }
        case 'facility': {
          const site = state.sites[0];
          if (site && e.facilityId && !site.facilities.includes(e.facilityId)) {
            site.facilities.push(e.facilityId);
            ctx.pushFeedback('mf_clean_desk', 'facility_built');
          }
          break;
        }
        case 'logisticsStation':
          if (!c.logisticsStation) {
            c.logisticsStation = true;
            ctx.pushFeedback('mf_clean_desk', 'logistics_on');
          }
          break;
        case 'roadSegment':
          buildRoadSegment(state);
          ctx.pushFeedback('mf_clean_desk', 'road_built');
          break;
        case 'coldChainExpand': {
          // §16 物理漏损：扩建冷链库容（空置率随之重算）
          state.physicalInfra.coldChainCapacity += e.value;
          ctx.pushFeedback('mf_clean_desk', 'coldchain_expand_text');
          break;
        }
        case 'smartApp': {
          // §16 数字化错位：上线智慧农业 APP（使用率从 0 起步，低=无效投资）
          if (!state.physicalInfra.hasSmartAgriApp) {
            state.physicalInfra.hasSmartAgriApp = true;
            state.physicalInfra.appAdoptionRate = 0.05;
            ctx.pushFeedback('mf_clean_desk', 'smart_app_text');
          }
          break;
        }
        default:
          break;
      }
    }
    ctx.addStars(3);
    ctx.pushLedger('transition', `node_${actionId}`, 1, `节点交互：${spec.name}`);
  }

  // ----- 急件放弃批复（强制弹窗的逃生门：接受考核扣分） -----
  if (actions.abandonUrgent) {
    c.pressure += 5;
    ctx.pushLedger('cost', 'abandonUrgent', -5, '急件未批复就收工');
  }

  // ----- 迎检文件堆（视觉压迫 → 精力出口）：不清=考核扣分 -----
  {
    const burden = c.inspectionBurden; // 上回合反噬写入、本回合到货的迎检负担
    const stacks = burden > 0 ? Math.min(4, 1 + Math.floor(burden / 20)) : 0;
    if (stacks > 0) {
      const cleared = Math.min(actions.paperStacksCleared ?? 0, c.playerStamina, stacks);
      c.playerStamina -= cleared;
      const uncleared = stacks - cleared;
      if (uncleared > 0) {
        c.pressure += uncleared * config.balance.paperStackPressure;
        ctx.pushLedger('cost', 'paperStacks', -2 * uncleared, `迎检文件堆未清（${uncleared} 堆）`);
      }
      if (cleared >= stacks) {
        ctx.pushFeedback('mf_clean_desk', 'mf_clean_desk_text');
        ctx.addStars(5);
        ctx.pushLedger('transition', 'paperStacksClear', 3, '案头清爽');
      }
    }
  }

  // ----- 派驻工作队（行动版；卡牌版另有 dispatch） -----
  for (const d of actions.dispatch ?? []) {
    const v = state.villages.find((x) => x.id === d.villageId);
    const u = state.units.find((x) => x.id === d.unitId);
    if (!v || !u) continue;
    if (c.cadrePower < 1 || u.resourcePool < 5) continue;
    c.cadrePower -= 1;
    u.resourcePool -= 5;
    v.dispatchedUnitId = u.id;
    v.externalEmbed = Math.min(100, v.externalEmbed + 12);
    const rel = state.relationships.find((r) => r.a === u.id || r.b === u.id);
    if (rel) rel.value = Math.min(100, rel.value + 4);
  }

  // ----- 户群施策（五个一批分类处置；迷雾未揭→信息错配打折） -----
  const fog = config.formulas.cadre;
  for (const hm of actions.householdMeasures ?? []) {
    const h = findHousehold(state, hm.groupId);
    if (!h) continue;
    const spec = config.measures.find((m) => m.id === hm.measureId);
    if (!spec) continue;
    if (c.cadrePower < spec.cost) continue;
    c.cadrePower -= spec.cost;
    const matched = spec.matchTags.includes(h.tag);
    const srcVillage = state.villages.find((v) => v.households.some((x) => x.id === h.id));
    // 信息迷雾：没入户摸排的村，施策是"盲打"——效果按雾浓度打折
    let fogMul = 1;
    if (srcVillage && !srcVillage.surveyed && hm.measureId !== 'guarantee') {
      fogMul = srcVillage.infoAccuracy >= fog.fogRevealThreshold ? fog.halfBlindMeasureMul : fog.blindMeasureMul;
    }
    const mul = (matched ? 1 : 0.5) * fogMul; // 错配减半 × 迷雾打折
    h.measureId = hm.measureId;
    if (hm.measureId === 'guarantee') {
      h.covered = true;
    }
    if (hm.measureId === 'relocate') {
      // 搬迁由 resettle 完成；此处只做标记（错配无意义）
      h.exitWillingness = Math.min(100, h.exitWillingness + 10 * mul);
    } else if (hm.measureId === 'training') {
      h.laborAbility = Math.min(1, h.laborAbility + 0.05 * mul);
      h.exitWillingness = Math.min(100, h.exitWillingness + 8 * mul);
    } else if (hm.measureId === 'industry' || hm.measureId === 'ecoJob') {
      h.exitWillingness = Math.min(100, h.exitWillingness + 6 * mul);
    }
    const blindNote = fogMul < 1 ? '（信息迷雾未揭，盲施策）' : '';
    ctx.pushLedger('achievement', `measure_${hm.measureId}`, matched ? 6 : 3, (matched ? '标签匹配施策' : '错配施策（效果减半）') + blindNote);
    if (matched) {
      state.accurateMatches += 1;
      ctx.addStars(15);
      ctx.noteCombo('precision');
      ctx.pushFeedback('mf_accurate_badge', 'mf_accurate_badge_text');
    }
    // 兜底陷阱：对不缺劳力的户群也兜底 → 逆向激励
    if (hm.measureId === 'guarantee' && h.tag !== 'noLabor' && h.tag !== 'disease') {
      h.exitWillingness = Math.max(0, h.exitWillingness - 5);
      state.trapRewards.push({ rewardId: 'trap_full_guarantee', round: ctx.round, cost: 0 });
    }
  }

  // ----- 考核三旋钮 -----
  if (actions.assessment) {
    c.assessmentDensity = Math.max(0, Math.min(100, actions.assessment.density));
    c.thirdPartyCoverage = Math.max(0, Math.min(100, actions.assessment.thirdParty));
    c.directReport = Math.max(0, Math.min(100, actions.assessment.directReport));
  }

  // ----- P5 追查模糊信号 -----
  for (const sigId of actions.investigate ?? []) {
    if (c.cadrePower < 1) continue;
    const sig = state.signals.find((s) => s.id === sigId && !s.investigated);
    if (!sig) continue;
    c.cadrePower -= 1;
    sig.investigated = true;
    ctx.addStars(5);
    ctx.pushEvent({ type: 'fuzzySignal', round: ctx.round, textId: `signal_truth_${sig.riskKind}`, riskKind: sig.riskKind, investigated: true });
    if (sig.riskKind === 'return') {
      for (const v of state.villages) v.returnRisk = Math.max(0, v.returnRisk - 5);
    }
    if (sig.riskKind === 'trust') c.trust = Math.min(100, c.trust + 2);
    if (sig.riskKind === 'debt') c.debtRisk = Math.max(0, c.debtRisk - 3);
    if (sig.riskKind === 'org') {
      for (const v of state.villages) v.internalGovernance = Math.min(100, v.internalGovernance + 3);
    }
  }

  // ----- P3 修复烂尾项目 -----
  for (const rp of actions.repair ?? []) {
    const p = state.projects.find((x) => x.id === rp.projectId);
    if (!p) continue;
    if (p.status !== 'stalled' && p.status !== 'broken') continue;
    if (c.cadrePower < 2) continue;
    c.cadrePower -= 2;
    state.repairModes.push({ projectId: rp.projectId, mode: rp.mode });
    switch (rp.mode) {
      case 'stopLoss':
        p.status = 'stalled';
        c.fiscalFund += 5; // 回收部分投资
        state.projectsRepaired.push(p.id);
        ctx.pushEvent({ type: 'projectFailure', round: ctx.round, projectId: p.id });
        ctx.pushLedger('transition', 'repair_stopLoss', 8, '止损退出');
        break;
      case 'restructure':
        p.status = 'recovered';
        state.projectsRepaired.push(p.id);
        ctx.pushLedger('transition', 'repair_restructure', 12, '重组重生');
        break;
      case 'changeCarrier': {
        p.status = 'recovered';
        const v = state.villages.find((x) => x.id === p.villageId);
        if (v && !v.coopType) v.coopType = 'enterprise';
        state.projectsRepaired.push(p.id);
        ctx.pushLedger('transition', 'repair_carrier', 10, '换载体');
        break;
      }
      case 'accountability':
        p.status = 'recovered';
        c.politicalCapital = Math.max(0, c.politicalCapital - 4);
        c.trust = Math.min(100, c.trust + 2);
        state.projectsRepaired.push(p.id);
        ctx.pushLedger('transition', 'repair_accountability', 10, '追责立规矩');
        break;
    }
    ctx.addStars(20);
    ctx.noteCombo('solid');
  }

  // ----- P2 采纳村民提案 -----
  for (const propId of actions.acceptProposal ?? []) {
    const prop = state.pendingProposals.find((x) => x.id === propId);
    if (!prop) continue;
    state.pendingProposals = state.pendingProposals.filter((x) => x.id !== propId);
    // 效果：小投入换参与（由效果键解析）
    const v = state.villages[0];
    if (v) v.participation = Math.min(100, v.participation + 6);
    c.trust = Math.min(100, c.trust + 3);
    ctx.addStars(10);
    ctx.pushLedger('transition', 'acceptProposal', 5, '采纳村民方案');
  }

  // ----- 谈判博弈（主控提示词第七节）：钉子户 / 低退出意愿户攻坚 -----
  for (const neg of actions.negotiations ?? []) {
    const h = findHousehold(state, neg.groupId);
    if (!h) continue;
    // 手牌成本：财政 / 个人精力 / 信任（付不起则整场跳过）
    let fiscalCost = 0;
    let staminaCost = 0;
    let trustCost = 0;
    const hands = neg.hands
      .map((id) => config.negotiationHands.find((x) => x.id === id))
      .filter((x): x is NonNullable<typeof x> => !!x);
    for (const hand of hands) {
      fiscalCost += hand.cost.fiscal ?? 0;
      staminaCost += hand.cost.stamina ?? 0;
      trustCost += hand.cost.trust ?? 0;
    }
    if (c.fiscalFund < fiscalCost || c.playerStamina < staminaCost) continue;
    c.fiscalFund -= fiscalCost;
    c.playerStamina -= staminaCost;
    if (trustCost < 0) c.trust = Math.max(0, c.trust + trustCost);
    const result = resolveNegotiation(state, neg.groupId, neg.hands, ctx.rng);
    ctx.pushEvent({
      type: 'negotiation',
      round: ctx.round,
      groupId: neg.groupId,
      textId: result.won ? 'negotiate_win' : 'negotiate_lose',
      won: result.won,
    });
    if (result.won) {
      h.exitWillingness = Math.min(100, h.exitWillingness + 20);
      ctx.pushLedger('transition', `negotiate_${neg.groupId}`, 6, `谈判成功：${h.name} 愿意配合`);
      ctx.addStars(10);
      ctx.noteCombo('solid');
    } else {
      c.politicalCapital = Math.max(0, c.politicalCapital - 4);
      c.trust = Math.max(0, c.trust - 2);
      ctx.pushLedger('cost', `negotiate_${neg.groupId}`, -4, `谈判破裂：${h.name} 不松口`);
      ctx.addStars(-5);
    }
  }

  // ----- 搬迁安置 -----
  for (const rs of actions.resettle ?? []) {
    const h = findHousehold(state, rs.groupId);
    const site = state.sites.find((s) => s.id === rs.siteId);
    if (!h || !site) continue;
    if (c.fiscalFund < 5) continue;
    c.fiscalFund -= 5;
    // 从原村移除，迁入安置点
    const srcVillage = state.villages.find((x) => x.id === h.villageId);
    if (srcVillage) {
      srcVillage.households = srcVillage.households.filter((x) => x.id !== h.id);
      srcVillage.returnRisk = Math.max(0, srcVillage.returnRisk - 10);
    }
    site.population += h.population;
    site.households.push(h.id);
    h.measureId = 'relocate';
    h.villageId = ''; // 已迁出（户群归属安置点）
    ctx.pushLedger('transition', 'resettle', 8, '易地安置');
    ctx.addStars(10);
    ctx.noteCombo('guarantee');
    // 搬迁治理重建：治理密度 vs 生计自立度
    if (site.population > 2000) {
      c.orgCostRatio = c.orgCostRatio + 0.2; // 大安置点组织成本上升
      ctx.pushLedger('org', 'resettleBig', -6, '大安置点治理成本');
    }
  }

  // ----- 合作社载体选择 -----
  for (const cc of actions.coopChoose ?? []) {
    const v = state.villages.find((x) => x.id === cc.villageId);
    if (!v) continue;
    v.coopType = cc.coopType;
  }

  // ----- G3 干部技能树：花治理经验点解锁技能 -----
  for (const skillId of actions.skills ?? []) {
    const spec = config.skills.find((s) => s.id === skillId);
    if (!spec) continue;
    if (state.unlocked.skills.includes(skillId)) continue;
    if (c.skillPoints < spec.cost) continue;
    // 前置：同级线上一级必须先解锁
    if (spec.level > 1) {
      const prev = config.skills.find((s) => s.line === spec.line && s.level === spec.level - 1);
      if (prev && !state.unlocked.skills.includes(prev.id)) continue;
    }
    c.skillPoints -= spec.cost;
    state.unlocked.skills.push(skillId);
    ctx.pushFeedback('mf_skill_unlock', 'mf_skill_unlock_text');
    ctx.addStars(10);
    ctx.pushLedger('transition', `skill_${skillId}`, 6, `技能解锁：${spec.name}`);
  }

  // ----- §15 自建产业设施：把蓝图落进村庄沙盘（自由组合的落点） -----
  for (const bn of actions.buildNodes ?? []) {
    const spec = industryNodes.find((n) => n.id === bn.nodeId);
    if (!spec) continue;
    const v = state.villages.find((x) => x.id === bn.villageId);
    if (!v) continue;
    if (!v.surveyed) continue; // 迷雾未揭，图纸放不进去
    if (c.fiscalFund < spec.cost) continue; // 财政不足，不动工
    const dup = (state.builtNodes ?? []).some(
      (b) => b.nodeId === bn.nodeId && b.villageId === bn.villageId
    );
    if (dup) continue; // 同村同蓝图只建一座
    c.fiscalFund -= spec.cost;
    state.builtNodes.push({
      id: `${bn.nodeId}_${bn.villageId}_${ctx.round}`,
      nodeId: bn.nodeId,
      villageId: bn.villageId,
      builtRound: ctx.round,
    });
    ctx.pushLedger('achievement', 'builtNode', 2, `落成设施：${spec.name}`);
    ctx.addStars(3);
    ctx.noteCombo('solid');
  }
}

/** 行动资源预估：返回本回合可执行的行动力上限（UI 提示用） */
export function availableCadre(state: GameState): number {
  return state.county.cadrePower;
}

/** 措辞：措施是否匹配户群标签 */
export function measureMatches(tag: PovertyTag, measureId: MeasureId): boolean {
  const spec = config.measures.find((m) => m.id === measureId);
  return spec ? spec.matchTags.includes(tag) : false;
}
