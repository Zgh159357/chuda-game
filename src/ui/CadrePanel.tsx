// ============================================================
// 左栏·干部面板：精力 / 士气 / 疲劳 / 驻村安排
// 干部是主体不是资源卡：过劳会倒下，士气会说话。
// 证件卡可拖拽到沙盘村庄（驻村）或县治（召回）。
// ============================================================
import React from 'react';
import type { Cadre, GameState } from '../core/types';
import { config } from '../config';
import { useGame } from './store';

interface Props {
  state: GameState;
  assignments: Record<string, string | null>; // cadreId → villageId | null
  onAssign: (cadreId: string, villageId: string | null) => void;
  draggable?: boolean; // 等距沙盘模式下开启拖拽驻村
}

const TITLE_SUFFIX: Record<string, string> = {
  第一书记: '驻村第一书记',
  工作队员: '工作队员',
  机关干部: '机关干部（机动）',
};

export function CadrePanel({ state, assignments, onAssign, draggable }: Props) {
  const beginDrag = useGame((s) => s.beginDrag);
  const villageNames = new Map(state.villages.map((v) => [v.id, v.name]));
  const avgMorale = state.cadres.length
    ? Math.round(state.cadres.reduce((s, c) => s + c.morale, 0) / state.cadres.length)
    : 0;

  return (
    <section className="paper">
      <div className="paper-title">
        <h3>干部名册</h3>
        <span className="annotation">
          全队精力 {state.county.cadrePower} · 均士气 {avgMorale}
        </span>
      </div>
      <div className="paper-body">
        {draggable && <p className="note">拖证件卡到沙盘：落到村庄=驻村，落到县治=召回待命。</p>}
        {state.cadres.map((c: Cadre) => {
          const assigned = assignments[c.id] !== undefined ? assignments[c.id] : c.villageId;
          return (
            <div
              className={`cadre-card${draggable ? ' grab-card' : ''}`}
              key={c.id}
              onPointerDown={draggable ? () => beginDrag({ kind: 'cadre', cadreId: c.id }) : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontFamily: "'Songti SC', 'SimSun', serif", fontSize: 15 }}>{c.name}</b>
                <span style={{ fontSize: 14, color: 'rgba(58,46,36,0.7)' }}>
                  {TITLE_SUFFIX[c.title]} · {c.homeUnitId === 'u_agri' ? '县农业局' : c.homeUnitId === 'u_health' ? '县卫健局' : '东部协作单位'}
                </span>
                {c.fatigue >= 80 && <span className="stamp">过劳边缘</span>}
              </div>

              <div className="meter" style={{ margin: '4px 0' }}>
                <span style={{ fontSize: 14, width: 30 }}>精力</span>
                <div className="energy-dots" style={{ flex: 1 }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={i < c.energy ? '' : c.energy === 0 ? 'drained' : 'empty'} />
                  ))}
                </div>
                <b style={{ fontSize: 14, width: 20, textAlign: 'right' }}>{c.energy}</b>
              </div>

              <div className="meter" style={{ margin: '3px 0' }}>
                <span style={{ fontSize: 14, width: 30 }}>士气</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${c.morale}%`, background: c.morale < 40 ? 'var(--seal)' : 'var(--field)' }} />
                </div>
                <b style={{ fontSize: 14, width: 20, textAlign: 'right' }}>{c.morale}</b>
              </div>

              <div className="meter" style={{ margin: '3px 0' }}>
                <span style={{ fontSize: 14, width: 30 }}>疲劳</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${c.fatigue}%`, background: c.fatigue >= 80 ? 'var(--seal)' : 'var(--warn)' }} />
                </div>
                <b style={{ fontSize: 14, width: 20, textAlign: 'right' }}>{c.fatigue}</b>
              </div>

              <div style={{ marginTop: 6 }}>
                {c.traits.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {c.traits.map((tId) => {
                      const t = config.traits.find((x) => x.id === tId);
                      return (
                        <span key={tId} className={`trait-chip${t?.positive === false ? ' trait-negative' : ''}`}>
                          {t?.name ?? tId}
                        </span>
                      );
                    })}
                  </div>
                )}
                <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.7)' }}>驻村安排（换岗耗 1 精力）：</label>
                <select
                  value={assigned ?? ''}
                  onChange={(e) => onAssign(c.id, e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">县机关待命</option>
                  {state.villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {assigned && assigned !== c.villageId && (
                  <span className="note" style={{ display: 'block' }}>换岗需花 1 点精力。</span>
                )}
              </div>
            </div>
          );
        })}
        <p className="note">干部每回合恢复 2–3 点精力；疲劳超 80 会倒下（信任受损、政治资本受挫）。别把人用垮。</p>
      </div>
    </section>
  );
}
