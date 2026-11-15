// ============================================================
// 县政府行动台：瞄准单位 / 财政协作 / 承诺档位 / 考核三旋钮 /
// 驻村工作队 / 干部技能树（县级决策都在这里批）
// 这些选择不耗个人精力（拍板本身是组长的本分），但后果记在账上。
// ============================================================
import React from 'react';
import type { CommitmentLevel, TargetingLevel } from '../core/types';
import { config } from '../config';
import { useGame } from './store';

const TARGETING_LABELS: Record<TargetingLevel, string> = {
  county: '县一级',
  village: '到村',
  household: '到户',
  person: '到人',
};

const TARGETING_COSTS: Record<TargetingLevel, string> = {
  county: '成本 ×1',
  village: '成本 ×1.5',
  household: '成本 ×2.25',
  person: '成本 ×3.375',
};

const COMMITMENT_LABELS: Record<CommitmentLevel, string> = {
  conservative: '保守承诺（压力↓ 政治资本↓）',
  standard: '达标承诺（稳妥）',
  overachieve: '争先承诺（压力↑ 政治资本↑）',
};

export function CountyDesk() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const updateDraft = useGame((s) => s.updateDraft);
  if (!state) return null;
  const c = state.county;

  const unitName = (id: string | null) => {
    if (!id) return '无';
    const u = state.units.find((x) => x.id === id);
    return u ? u.name : id;
  };

  return (
    <section className="paper">
      <div className="paper-title">
        <h3>县政府行动台</h3>
        <span className="annotation">决策不耗精力，后果记四本账</span>
      </div>
      <div className="paper-body">
        {/* 瞄准单位 */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>瞄准单位（精度越高、行政成本越高）：</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {(Object.keys(TARGETING_LABELS) as TargetingLevel[]).map((lv) => (
              <button
                key={lv}
                className={draft.targetingLevel === lv ? 'toggled' : ''}
                onClick={() => updateDraft({ targetingLevel: lv })}
                title={TARGETING_COSTS[lv]}
              >
                {TARGETING_LABELS[lv]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'rgba(58,46,36,0.6)' }}>
            当前：{TARGETING_LABELS[draft.targetingLevel]}（{TARGETING_COSTS[draft.targetingLevel]}）
          </span>
        </div>

        {/* 财政 / 协作 */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14 }}>
            财政投入（余 {Math.round(c.fiscalFund)}）：
            <input
              type="number"
              min={0}
              value={draft.fiscal}
              onChange={(e) => updateDraft({ fiscal: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: 64 }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            协作资金（余 {Math.round(c.cooperationFund)}）：
            <input
              type="number"
              min={0}
              value={draft.coop}
              onChange={(e) => updateDraft({ coop: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: 64 }}
            />
          </label>
        </div>

        {/* 承诺档位 */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>承诺档位：</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {(Object.keys(COMMITMENT_LABELS) as CommitmentLevel[]).map((lv) => (
              <button
                key={lv}
                className={draft.commitment === lv ? 'toggled' : ''}
                onClick={() => updateDraft({ commitment: lv })}
              >
                {COMMITMENT_LABELS[lv].split('（')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 考核三旋钮 */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>
            考核三旋钮（密度 &gt;60 会触发迎检负担与「做证明」）：
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14 }}>
              考核密度
              <input
                type="number"
                min={0}
                max={100}
                value={draft.assessment.density}
                onChange={(e) =>
                  updateDraft({
                    assessment: { ...draft.assessment, density: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                  })
                }
                style={{ width: 56 }}
              />
            </label>
            <label style={{ fontSize: 14 }}>
              第三方
              <input
                type="number"
                min={0}
                max={100}
                value={draft.assessment.thirdParty}
                onChange={(e) =>
                  updateDraft({
                    assessment: { ...draft.assessment, thirdParty: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                  })
                }
                style={{ width: 56 }}
              />
            </label>
            <label style={{ fontSize: 14 }}>
              群众直报
              <input
                type="number"
                min={0}
                max={100}
                value={draft.assessment.directReport}
                onChange={(e) =>
                  updateDraft({
                    assessment: { ...draft.assessment, directReport: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                  })
                }
                style={{ width: 56 }}
              />
            </label>
          </div>
        </div>

        {/* 驻村工作队 */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>驻村工作队（每村一支派出单位）：</label>
          {state.villages.map((v) => (
            <div key={v.id} style={{ fontSize: 14, marginTop: 4 }}>
              {v.name}：
              <select
                value={draft.dispatch.find((d) => d.villageId === v.id)?.unitId ?? v.dispatchedUnitId ?? ''}
                onChange={(e) => {
                  const rest = draft.dispatch.filter((d) => d.villageId !== v.id);
                  updateDraft({
                    dispatch: e.target.value ? [...rest, { villageId: v.id, unitId: e.target.value }] : rest,
                  });
                }}
              >
                <option value="">不派驻</option>
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（资源 {u.resourcePool}）
                  </option>
                ))}
              </select>
              <span style={{ color: 'rgba(58,46,36,0.6)', marginLeft: 6 }}>现状：{unitName(v.dispatchedUnitId)}</span>
            </div>
          ))}
        </div>

        {/* 干部技能树 */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>
            干部技能树（治理经验点 {c.skillPoints}，里程碑回合结算后各得 1 点）：
          </label>
          {(['massWork', 'projectOps', 'orgBuilding'] as const).map((line) => {
            const lineName = line === 'massWork' ? '群众工作' : line === 'projectOps' ? '项目运营' : '组织建设';
            const specs = config.skills.filter((s) => s.line === line);
            return (
              <div key={line} style={{ marginTop: 4 }}>
                <span style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)' }}>{lineName}：</span>
                {specs.map((spec) => {
                  const owned = state.unlocked.skills.includes(spec.id);
                  const prev =
                    spec.level > 1 ? config.skills.find((s) => s.line === line && s.level === spec.level - 1) : null;
                  const prereqOk = !prev || state.unlocked.skills.includes(prev.id);
                  const afford = c.skillPoints >= spec.cost;
                  return (
                    <button
                      key={spec.id}
                      className={owned ? 'toggled' : ''}
                      disabled={!afford || !prereqOk}
                      title={`${spec.desc}（${spec.cost} 点${prereqOk ? '' : '，需先点上一级'}）`}
                      style={{ marginRight: 4, marginTop: 2, fontSize: 14 }}
                      onClick={() =>
                        updateDraft({
                          skills: draft.skills.includes(spec.id)
                            ? draft.skills.filter((x) => x !== spec.id)
                            : [...draft.skills, spec.id],
                        })
                      }
                    >
                      {spec.name}
                      {owned ? ' ✓已学' : `（${spec.cost}点）`}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <p className="note">三条线全满需 12 点，务必取舍。撤队交接时按组织建设线留下治理遗产。</p>
        </div>
      </div>
    </section>
  );
}
