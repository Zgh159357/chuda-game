// ============================================================
// 人才档案面板（主控提示词第九节）：
// 不再是随机觉醒——事件链触发两难抉择，招募入队。
// 神级绝活 + 致命毒点，一并写进档案。
// 红线：人才是村里本来就有的能人，不是天降救星。
// ============================================================
import React from 'react';
import { config } from '../config';
import { useGame } from './store';
import { heroIsSick } from '../core/systems/heroes';

export function HeroesPanel() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const setHeroAssign = useGame((s) => s.setHeroAssign);
  const openRecruit = useGame((s) => s.openRecruit);
  if (!state) return null;

  const assignFor = (heroId: string) => draft.heroAssign.find((h) => h.heroId === heroId)?.villageId ?? '';

  return (
    <section className="paper heroes-panel">
      <div className="paper-title">
        <h3>人才档案</h3>
        <span className="annotation">本乡能人，事件链触发两难抉择后入队</span>
      </div>
      <div className="paper-body">
        {state.pendingRecruits.length > 0 && (
          <div className="recruit-pending">
            <h4>案头待批复的请托信</h4>
            {state.pendingRecruits.map((p) => {
              const spec = config.heroes.find((x) => x.id === p.heroId);
              if (!spec) return null;
              return (
                <button key={p.heroId} className="recruit-pending-item" onClick={() => openRecruit(p.heroId)}>
                  {spec.role} {spec.name} —— 当面拍板
                </button>
              );
            })}
          </div>
        )}
        {state.heroes.length === 0 && state.pendingRecruits.length === 0 ? (
          <p className="note">档案柜还空着。多入户走访，村里藏着的能人，会自己找上门的。</p>
        ) : null}
        {state.heroes.map((h) => {
          const spec = config.heroes.find((x) => x.id === h.heroId);
          if (!spec) return null;
          const sick = heroIsSick(state, h.heroId);
          const curVillage = h.villageId;
          return (
            <div key={h.heroId} className={`hero-card${sick ? ' hero-sick' : ''}`}>
              <div className="hero-head">
                <b>{spec.name}</b>
                <span className="hero-role">{spec.role}</span>
                {sick ? <span className="hero-sick-tag">病倒休养</span> : null}
              </div>
              <p className="hero-desc">{spec.desc}</p>
              {spec.flawDesc ? <p className="hero-flaw">⚠ {spec.flawDesc}</p> : null}
              <div className="hero-assign">
                <span style={{ fontSize: 12 }}>
                  当前：{curVillage ? state.villages.find((v) => v.id === curVillage)?.name ?? '村庄' : '未派驻'}
                </span>
                <select
                  value={assignFor(h.heroId) || curVillage || ''}
                  onChange={(e) => setHeroAssign(h.heroId, e.target.value)}
                  disabled={sick}
                >
                  <option value="">未派驻</option>
                  {state.villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        <p className="note">派驻在本回合结算时生效；病倒期间增益暂停。</p>
      </div>
    </section>
  );
}
