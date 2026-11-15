// ============================================================
// 工作日记（左下抽屉）：三条户故事线的信件与口述
// 情感羁绊不靠看板娘，靠老李、小杨、小王的一封封信。
// ============================================================
import React from 'react';
import type { GameState } from '../core/types';
import { config } from '../config';

interface Props {
  state: GameState;
  onClose: () => void;
}

export function DiaryDrawer({ state, onClose }: Props) {
  const householdName = (householdId: string) => {
    for (const v of state.villages) {
      const h = v.households.find((x) => x.id === householdId);
      if (h) return h.name;
    }
    return householdId;
  };

  return (
    <div className="diary-drawer paper">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h3>工作日记</h3>
        <button style={{ marginLeft: 'auto' }} onClick={onClose}>
          合上日记
        </button>
      </div>
      <p className="note">本子里夹着三家的信。他们不是数据，是这片土地上的人。</p>

      {config.storylines.map((sl) => {
        const rec = state.storylines.find((s) => s.id === sl.id);
        const stageIndex = rec?.stageIndex ?? 0;
        return (
          <section key={sl.id} style={{ margin: '14px 0' }}>
            <h4 style={{ borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
              {sl.title} <span style={{ fontSize: 14, color: 'rgba(58,46,36,0.65)' }}>——{householdName(sl.householdId)}</span>
            </h4>
            {stageIndex === 0 ? (
              <p style={{ fontSize: 15, color: 'rgba(58,46,36,0.6)' }}>档案袋里还没有他家的信。</p>
            ) : (
              sl.stages.slice(0, stageIndex).map((st, i) => (
                <blockquote
                  key={i}
                  style={{
                    margin: '8px 0 8px 12px',
                    padding: '8px 10px',
                    borderLeft: '3px solid var(--indigo)',
                    background: 'rgba(62,92,118,0.06)',
                    fontFamily: "'KaiTi', 'STKaiti', cursive",
                    fontSize: 14,
                  }}
                >
                  {config.text[st.textId]}
                </blockquote>
              ))
            )}
          </section>
        );
      })}
      <p className="annotation" style={{ marginTop: 18 }}>
        每一封回信，都记在四本账的「温度」那一页。
      </p>
    </div>
  );
}
