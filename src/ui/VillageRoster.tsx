// ============================================================
// 左栏·村庄名册：信息迷雾遮罩
// 未入户摸排的村，档案上只有「？？？」——没看见的贫穷不会消失。
// ============================================================
import React from 'react';
import type { GameState, VillageState } from '../core/types';
import { config } from '../config';
import { PaperPanel } from './PaperPanel';

interface Props {
  state: GameState;
  surveyVillages: string[]; // 本回合已勾选摸排的村
  onToggleSurvey: (villageId: string) => void;
  villageId?: string; // 村庄视图：只显示这一村
}

function Masked() {
  return <span className="fog-mask">？？？</span>;
}

function valueOrMask(v: VillageState, val: number, suffix = '') {
  if (!v.surveyed) return <Masked />;
  if (v.infoAccuracy < config.formulas.cadre.fogPreciseThreshold) {
    return (
      <span title="口述估算，尚未核实">
        ~{Math.round(val)}
        {suffix}
      </span>
    );
  }
  return (
    <span>
      {Math.round(val)}
      {suffix}
    </span>
  );
}

export function VillageRoster({ state, surveyVillages, onToggleSurvey, villageId }: Props) {
  const residents = new Map<string, string>(); // villageId → cadreId
  for (const c of state.cadres) {
    if (c.villageId) residents.set(c.villageId, c.id);
  }
  const villages = villageId ? state.villages.filter((v) => v.id === villageId) : state.villages;

  const popOf = (v: VillageState) => Math.round(state.villagePopulations[v.id]?.totalPop ?? 0);
  const outflowOf = (v: VillageState) => Math.round(state.villagePopulations[v.id]?.outflowRate ?? 0);
  const inflowOf = (v: VillageState) => Math.round(state.villagePopulations[v.id]?.inflowRate ?? 0);

  return (
    <section className="paper">
      <div className="paper-title">
        <h3>村庄名册</h3>
        <span className="annotation">红笔覆盖处=未摸排</span>
      </div>
      <div className="paper-body">
        {villages.map((v) => {
          const resident = residents.get(v.id);
          const toggled = surveyVillages.includes(v.id);
          return (
            <PaperPanel key={v.id} className="mb-2">
              <h4>
                {v.name}
                <span className="stat" style={{ fontSize: 13 }}>
                  {v.environment.terrain} · 灾害 {v.environment.disasterRisk}
                </span>
                {v.surveyed ? (
                  <span className="stat" style={{ fontSize: 13 }}>
                    已摸排 · 精度 {Math.round(v.infoAccuracy)}
                  </span>
                ) : (
                  <span className="fog-mask">档案缺失 · 未摸排</span>
                )}
              </h4>
              <div className="meters">
                <span>返贫风险：{valueOrMask(v, v.returnRisk)}</span>
                <span>产业基础：{valueOrMask(v, v.industryBase)}</span>
                <span>补贴依赖：{valueOrMask(v, v.subsidyDependence)}%</span>
                <span>接得住：{valueOrMask(v, v.canHoldIndex)}</span>
                <span title="按驻村干部数每回合生成；项目烂尾、灾情先扣护盾">
                  治理护盾：{Math.round(v.governanceShield)}
                </span>
                <span title="劳动人口按技能折算，缺口影响项目产出">
                  人口：{popOf(v)} · 流出 {outflowOf(v)}% · 回流 {inflowOf(v)}%
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                <span style={{ color: 'rgba(58,46,36,0.7)' }}>
                  {v.surveyed ? '在册户群：' : '户群底册：'}
                </span>
                {v.surveyed ? (
                  v.households.map((h) => h.name).join('、')
                ) : (
                  <span className="fog-mask">未建档 · 不知其详</span>
                )}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={toggled ? 'toggled' : ''} onClick={() => onToggleSurvey(v.id)} disabled={!v.surveyed && toggled}>
                  {v.surveyed ? (toggled ? '已安排复核' : '入户复核') : toggled ? '已安排摸排' : '入户摸排'}
                </button>
                <span style={{ fontSize: 13, color: 'rgba(58,46,36,0.65)' }}>
                  {resident
                    ? `驻村干部：${state.cadres.find((c) => c.id === resident)?.name ?? ''}（摸排耗 2 精力）`
                    : '无驻村干部（摸排耗 3 精力）'}
                </span>
              </div>
            </PaperPanel>
          );
        })}
        <p className="note">
          摸排揭开迷雾：致贫标签显现、施策才不打折；档案永远比村子慢一步，走访才是真的摸底。
        </p>
      </div>
    </section>
  );
}
