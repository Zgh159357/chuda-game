// ============================================================
// 村庄规划沙盘（村庄控制台中栏）：项目 / 合作社载体 / 分类施策 /
// 易地搬迁 —— 政策卡指派到本村后在这里落地。
// ============================================================
import React from 'react';
import type { CoopType, GameState, IndustryTag, MeasureId, PovertyTag } from '../core/types';
import { config } from '../config';
import { synergyRecipes, industryNodes } from '../config/industry';
import { useGame } from './store';

const TAG_NAMES_BUILT: Record<IndustryTag, string> = {
  primary_agri: '一产',
  processing: '加工',
  service: '服务',
  logistics: '物流',
  energy: '能源',
};

const MEASURE_NAMES: Record<MeasureId, string> = {
  industry: '产业带动',
  relocate: '易地安置',
  ecoJob: '生态岗位',
  training: '能力提升',
  guarantee: '兜底保障',
};

const TAG_NAMES: Record<PovertyTag, string> = {
  disease: '因病',
  education: '因学',
  noLabor: '缺劳力',
  noSkill: '缺技能',
  remote: '地处偏远',
  ecoConstraint: '生态约束',
};

const COOP_NAMES: Record<CoopType, string> = {
  ablePerson: '能人领办',
  partyBranch: '支部领办',
  enterprise: '企业带动',
  retail: '散户自发',
};

export function VillageSandbox({ villageId }: { villageId: string }) {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const updateDraft = useGame((s) => s.updateDraft);
  const openNegotiation = useGame((s) => s.openNegotiation);
  const toggleMentorship = useGame((s) => s.toggleMentorship);
  const toggleBuildNode = useGame((s) => s.toggleBuildNode);
  if (!state) return null;
  const village = state.villages.find((v) => v.id === villageId);
  if (!village) return null;

  const projects = state.projects.filter((p) => p.villageId === villageId);
  const households = village.households;
  const residentCadre = state.cadres.find((x) => x.villageId === villageId);
  const assignedCards = (Object.values(draft.slots).filter(Boolean) as { cardId: string; villageId?: string }[])
    .filter((s) => s.villageId === villageId)
    .map((s) => config.policies.find((p) => p.id === s.cardId))
    .filter(Boolean);

  const measureFor = (groupId: string) => draft.householdMeasures.find((m) => m.groupId === groupId)?.measureId ?? '';
  const setMeasure = (groupId: string, measureId: MeasureId | '') => {
    const rest = draft.householdMeasures.filter((m) => m.groupId !== groupId);
    updateDraft({
      householdMeasures: measureId ? [...rest, { groupId, measureId }] : rest,
    });
  };
  const measureMatches = (groupId: string, measureId: MeasureId) => {
    const hh = households.find((h) => h.id === groupId);
    if (!hh) return false;
    const spec = config.measures.find((m) => m.id === measureId);
    return !!spec && spec.matchTags.some((t) => hh.tag === t);
  };

  return (
    <section className="paper sandbox">
      <div className="paper-title">
        <h3>{village.name} · 村庄规划沙盘</h3>
        <span className="annotation">
          {village.surveyed ? (village.infoAccuracy >= 70 ? '档案完整' : '口述估计') : '档案缺失·未摸排'}
        </span>
      </div>
      <div className="paper-body">
        {assignedCards.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--indigo)' }}>
              本回合指派的施政方针：{assignedCards.map((x) => x?.name).join('、')}
            </span>
          </div>
        )}
        {village.synergyTitles.length > 0 && (
          <div className="synergy-stamps" style={{ marginBottom: 8 }}>
            {village.synergyTitles.map((rid) => {
              const recipe = synergyRecipes.find((r) => r.id === rid);
              return recipe ? (
                <span
                  key={rid}
                  className={`synergy-stamp${recipe.anti ? ' anti' : ''}`}
                  title={recipe.specialEffectDesc}
                >
                  {recipe.unlockVillageTitle}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* 项目 */}
        <div className="sandbox-block">
          <h4>产业项目</h4>
          {projects.length === 0 && <p className="note">这个村还没有项目。B 阶段起可在产业槽布局产业奖补/以工代赈。</p>}
          {projects.map((p) => (
            <div key={p.id} style={{ fontSize: 14, marginBottom: 4 }}>
              <b>{p.name}</b>（{p.status === 'active' ? '运营中' : p.status === 'stalled' ? '停滞' : p.status === 'broken' ? '烂尾' : '已修复'}）
              {p.subsidyDependence > 0 && ` · 补贴依赖 ${Math.round(p.subsidyDependence)}%`}
            </div>
          ))}
        </div>

        {/* 合作社载体 */}
        <div className="sandbox-block">
          <h4>合作社载体（双绑稳定度的组织基础）</h4>
          <select
            value={(draft.coopChoose.find((x) => x.villageId === villageId)?.coopType ?? village.coopType) ?? ''}
            onChange={(e) => {
              const rest = draft.coopChoose.filter((x) => x.villageId !== villageId);
              updateDraft({
                coopChoose: e.target.value
                  ? [...rest, { villageId, coopType: e.target.value as CoopType }]
                  : rest,
              });
            }}
          >
            <option value="">未设载体</option>
            {(Object.keys(COOP_NAMES) as CoopType[]).map((t) => (
              <option key={t} value={t}>
                {COOP_NAMES[t]}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: 'rgba(58,46,36,0.6)', marginLeft: 6 }}>
            当前：{village.coopType ? COOP_NAMES[village.coopType] : '未设载体'}（双绑 {Math.round(village.dualBindStability)}）
          </span>
        </div>

        {/* 传帮带（第十节：驻村队组织嵌入的二选一） */}
        {village.dispatchedUnitId && (
          <div className="sandbox-block">
            <h4>传帮带指令（驻村队 × 村两委）</h4>
            <label style={{ fontSize: 14, display: 'block' }}>
              <input
                type="checkbox"
                checked={draft.mentorship.includes(villageId)}
                onChange={() => toggleMentorship(villageId)}
              />{' '}
              指派传帮带：村内生治理 +1/回合，但本回合产业产出 −30%；不指派则驻村队挤出效应每回合 −2 组织度（先扣组织韧性）。
            </label>
          </div>
        )}

        {/* §15 自建产业设施（自由组合的落点） */}
        <div className="sandbox-block">
          <h4>自建产业设施（产业融合拼图）</h4>
          {!village.surveyed && <p className="note">迷雾未揭，图纸放不进去。</p>}
          {industryNodes.map((n) => {
            const built = state.builtNodes.some((b) => b.nodeId === n.id && b.villageId === villageId);
            const picked = draft.buildNodes.some((b) => b.nodeId === n.id && b.villageId === villageId);
            const affordable = state.county.fiscalFund >= n.cost;
            return (
              <label
                key={n.id}
                style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}
              >
                <input
                  type="checkbox"
                  disabled={!village.surveyed || built}
                  checked={picked}
                  onChange={() => toggleBuildNode(n.id, villageId)}
                />
                <span>
                  {n.name}（{n.tags.map((t) => TAG_NAMES_BUILT[t] ?? t).join('+')}）· 造价 {n.cost} 财政
                  {built ? ' · 已落成' : !affordable ? ' · 财政不足' : ''}
                </span>
              </label>
            );
          })}
        </div>

        {/* 分类施策（五个一批） */}
        <div className="sandbox-block">
          <h4>分类施策 · 五个一批</h4>
          {!village.surveyed && <p className="note">未摸排：真实致贫标签藏在迷雾里，盲施策效果减半。缺劳力户可直接兜底。</p>}
          {households.map((hh) => {
            const cur = measureFor(hh.id);
            return (
              <div key={hh.id} style={{ fontSize: 14, marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  {hh.name}（{TAG_NAMES[hh.tag]}，{hh.population} 人，劳力 {Math.round(hh.laborAbility * 100)}%）
                </span>
                {hh.covered && <span style={{ color: 'var(--field)' }}>已兜底</span>}
                <select value={cur} onChange={(e) => setMeasure(hh.id, e.target.value as MeasureId | '')}>
                  <option value="">不施策</option>
                  {(Object.keys(MEASURE_NAMES) as MeasureId[]).map((m) => (
                    <option key={m} value={m}>
                      {MEASURE_NAMES[m]}
                      {measureMatches(hh.id, m) ? ' ✓匹配' : village.surveyed ? ' ✗错配' : ''}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {/* 易地搬迁 */}
        <div className="sandbox-block">
          <h4>易地搬迁（remote 户，迁出后入安置点）</h4>
          {households.filter((h) => h.tag === 'remote').length === 0 && (
            <p className="note">没有待搬迁户。</p>
          )}
          {households
            .filter((h) => h.tag === 'remote')
            .map((h) => {
              const siteId = state.sites[0]?.id ?? '';
              const queued = draft.resettle.some((r) => r.groupId === h.id);
              const negotiated = draft.negotiations.some((n) => n.groupId === h.id);
              return (
                <label key={h.id} style={{ fontSize: 14, display: 'block', marginBottom: 3 }}>
                  <input
                    type="checkbox"
                    checked={queued}
                    onChange={(e) =>
                      updateDraft({
                        resettle: e.target.checked
                          ? [...draft.resettle, { groupId: h.id, siteId }]
                          : draft.resettle.filter((r) => r.groupId !== h.id),
                      })
                    }
                  />{' '}
                  {h.name} → {state.sites[0]?.name ?? '安置点'}（财政 5/户）
                  {h.exitWillingness < 30 && (
                    <button
                      type="button"
                      className="negotiate-btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => openNegotiation(h.id)}
                    >
                      钉子户·当面恳谈{negotiated ? '（已约）' : ''}
                    </button>
                  )}
                </label>
              );
            })}
          {households.filter((h) => h.tag === 'remote' && h.exitWillingness < 30).length > 0 && (
            <p className="note">退出意愿低于 30 的户，硬迁伤信任；先「当面恳谈」说动再搬。</p>
          )}
        </div>

        {/* 人才派驻（伟人收集） */}
        <div className="sandbox-block">
          <h4>人才派驻（走访中发现的能人）</h4>
          {state.heroes.length === 0 && <p className="note">本县还没有发现人才。多入户摸排，能人就在村里。</p>}
          {state.heroes.map((h) => {
            const spec = config.heroes.find((x) => x.id === h.heroId);
            if (!spec) return null;
            const curAssign = draft.heroAssign.find((a) => a.heroId === h.heroId);
            const effVillage = curAssign?.villageId ?? h.villageId;
            return (
              <div key={h.heroId} style={{ fontSize: 14, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{spec.name}</b>
                <span>（{spec.role}）</span>
                <span style={{ color: 'var(--indigo)' }}>{spec.desc}</span>
                <select
                  value={curAssign?.villageId ?? h.villageId ?? ''}
                  onChange={(e) => {
                    const rest = draft.heroAssign.filter((a) => a.heroId !== h.heroId);
                    updateDraft({ heroAssign: e.target.value ? [...rest, { heroId: h.heroId, villageId: e.target.value }] : rest });
                  }}
                >
                  <option value="">未派驻</option>
                  {state.villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {effVillage === villageId && <span style={{ color: 'var(--field)' }}>✓ 驻本村</span>}
              </div>
            );
          })}
        </div>

        {residentCadre && (
          <p className="note">
            驻村干部：{residentCadre.name}（{residentCadre.title}，精力 {residentCadre.energy}）——摸排/施策消耗的是干部精力。
          </p>
        )}
      </div>
    </section>
  );
}
