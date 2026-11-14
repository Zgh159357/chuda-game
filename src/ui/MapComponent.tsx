// ============================================================
// 县域大地图视图（等距沙盘版）：
// 左=干部名册（可拖驻村）+村庄名册 / 中=等距战略沙盘+县级事务 / 右=卡槽+待批文件+县行动台
// 底部=个人精力 + 工作日记 + 结束本月工作。
// ============================================================
import React, { useState } from 'react';
import { useGame } from './store';
import { CadrePanel } from './CadrePanel';
import { VillageRoster } from './VillageRoster';
import { MapSandbox } from './MapSandbox';
import { SlotBoard } from './SlotBoard';
import { EventInbox } from './EventInbox';
import { CountyDesk } from './CountyDesk';
import { TechPanel } from './TechPanel';
import { WonderPanel } from './WonderPanel';
import { HeroesPanel } from './HeroesPanel';
import { DiaryDrawer } from './DiaryDrawer';
import { config } from '../config';
import { resilienceRatio } from '../core/systems/resilience';

export function MapComponent() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const remainingStamina = useGame((s) => s.remainingStamina);
  const updateDraft = useGame((s) => s.updateDraft);
  const endTurn = useGame((s) => s.endTurn);
  const getBlockingFileId = useGame((s) => s.getBlockingFileId);
  const exportSave = useGame((s) => s.exportSave);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [exported, setExported] = useState(false);

  if (!state) return null;
  const blocking = getBlockingFileId();
  const blockingSpec = blocking ? config.eventFiles.find((f) => f.id === blocking) : null;
  const ratio = resilienceRatio(state);
  const lastRound = state.history[state.history.length - 1];
  const absorbedLastRound = lastRound
    ? lastRound.outcome.events.some((e) => e.type === 'resilienceAbsorbed')
    : false;

  return (
    <div className="map-view">
      {/* ===== 左栏：干部名册（可拖）+ 村庄名册 ===== */}
      <aside className="left-col">
        <CadrePanel
          state={state}
          draggable
          assignments={Object.fromEntries(draft.cadreAssignments.map((a) => [a.cadreId, a.villageId]))}
          onAssign={(cadreId, villageId) => {
            const rest = draft.cadreAssignments.filter((a) => a.cadreId !== cadreId);
            updateDraft({ cadreAssignments: [...rest, { cadreId, villageId }] });
          }}
        />
        <VillageRoster
          state={state}
          surveyVillages={draft.surveyVillages}
          onToggleSurvey={(vid) =>
            updateDraft({
              surveyVillages: draft.surveyVillages.includes(vid)
                ? draft.surveyVillages.filter((x) => x !== vid)
                : [...draft.surveyVillages, vid],
            })
          }
        />
      </aside>

      {/* ===== 中栏：等距沙盘 + 县级事务台账 ===== */}
      <main className="center-col">
        <MapSandbox />

        <section className="paper">
          <div className="paper-title">
            <h3>县级事务台账</h3>
          </div>
          <div className="paper-body">
            {state.projects.filter((p) => p.status === 'stalled' || p.status === 'broken').length === 0 && (
              <p className="note">暂无烂尾问题项目。</p>
            )}
            {state.projects
              .filter((p) => p.status === 'stalled' || p.status === 'broken')
              .map((p) => (
                <div key={p.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <b>⚠ {p.name}</b>（{p.status === 'stalled' ? '停滞' : '烂尾'}）：
                  <select
                    value={draft.repair.find((r) => r.projectId === p.id)?.mode ?? ''}
                    onChange={(e) => {
                      const rest = draft.repair.filter((r) => r.projectId !== p.id);
                      updateDraft({
                        repair: e.target.value
                          ? [...rest, { projectId: p.id, mode: e.target.value as 'stopLoss' }]
                          : rest,
                      });
                    }}
                  >
                    <option value="">不处理</option>
                    <option value="stopLoss">止损（回收部分资金）</option>
                    <option value="restructure">重组（换人重来）</option>
                    <option value="changeCarrier">换载体（企业接手）</option>
                    <option value="accountability">追责（政治资本↓ 信任↑）</option>
                  </select>
                </div>
              ))}

            {state.signals.filter((s) => !s.investigated).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(58,46,36,0.75)' }}>模糊信号（追查耗 1 干部精力）：</span>
                {state.signals
                  .filter((s) => !s.investigated)
                  .map((s) => (
                    <div key={s.id} style={{ fontSize: 12, marginTop: 3 }}>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.investigate.includes(s.id)}
                          onChange={(e) =>
                            updateDraft({
                              investigate: e.target.checked
                                ? [...draft.investigate, s.id]
                                : draft.investigate.filter((x) => x !== s.id),
                            })
                          }
                        />{' '}
                        「{config.text[s.textId] ?? s.riskKind}」
                      </label>
                    </div>
                  ))}
              </div>
            )}

            {state.pendingProposals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(58,46,36,0.75)' }}>村民提案（采纳：参与↑ 信任↑）：</span>
                {state.pendingProposals.map((p) => (
                  <div key={p.id} style={{ fontSize: 12, marginTop: 3 }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.acceptProposal.includes(p.id)}
                        onChange={(e) =>
                          updateDraft({
                            acceptProposal: e.target.checked
                              ? [...draft.acceptProposal, p.id]
                              : draft.acceptProposal.filter((x) => x !== p.id),
                          })
                        }
                      />{' '}
                      「{config.text[p.textId] ?? p.id}」
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ===== 右栏：卡槽（可拖落子）+ 待批文件 + 县行动台 ===== */}
      <aside className="right-col">
        <SlotBoard />
        <TechPanel />
        <WonderPanel />
        <HeroesPanel />
        <EventInbox />
        <CountyDesk />
      </aside>

      {/* ===== 底部：个人精力 + 日记 + 结束本月工作 ===== */}
      <footer className="map-footer">
        <div className="stamina-bar">
          <span>组长个人精力</span>
          <span className="energy-dots">
            {Array.from({ length: config.balance.playerStaminaMax }, (_, i) => (
              <i key={i} className={i < remainingStamina() ? '' : 'drained'} />
            ))}
          </span>
          <span>
            {remainingStamina()}/{config.balance.playerStaminaMax}
          </span>
        </div>
        <div className="resilience-bar">
          <span>组织韧性</span>
          <span className="resilience-track">
            <i className="resilience-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
          <span>
            {state.county.organizationalResilience}/{state.county.maxResilience}
          </span>
          {absorbedLastRound && lastRound && (
            <span key={lastRound.round} className="shield-crack" title="上一回合：组织韧性抵挡了治理力损耗">
              ⛨
            </span>
          )}
        </div>
        <button onClick={() => setDiaryOpen(true)}>工作日记</button>
        <button
          onClick={() => {
            exportSave();
            setExported(true);
            setTimeout(() => setExported(false), 1800);
          }}
          title="把当前进度导出为 .json 文件（可换设备导入）"
        >
          {exported ? '已导出 ✓' : '导出存档'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {blocking && blockingSpec && (
            <span className="note" style={{ color: 'var(--seal)' }}>
              急件未批复：{blockingSpec.title}（收工有考核扣分）
            </span>
          )}
          <button className="end-turn" onClick={endTurn}>
            结束本月工作 · 盖章归档
          </button>
        </div>
      </footer>

      {diaryOpen && <DiaryDrawer state={state} onClose={() => setDiaryOpen(false)} />}
    </div>
  );
}
