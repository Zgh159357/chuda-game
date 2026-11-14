// ============================================================
// 右栏·政策卡槽：党建槽 / 产业槽 / 民生槽
// 双层视图重构：卡槽=本回合「施政方针」，可指派到具体村庄沙盘。
// 每槽至多 1 张；三槽全填=「调度有方」；不设最少卡硬门槛（空槽只提示）。
// ============================================================
import React from 'react';
import type { SlotKind } from '../core/types';
import { config } from '../config';
import { useGame } from './store';

interface Props {
  villageId?: string; // 村庄视图传入：选中卡自动指派到该村
}

const KIND_LABEL: Record<SlotKind, string> = {
  party: '党建槽',
  industry: '产业槽',
  livelihood: '民生槽',
};

export function SlotBoard({ villageId }: Props) {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const tryToggleCard = useGame((s) => s.tryToggleCard);
  const updateDraft = useGame((s) => s.updateDraft);
  const beginDrag = useGame((s) => s.beginDrag);
  if (!state) return null;

  const unlocked = new Set(state.unlocked.policies);
  const kinds = ['party', 'industry', 'livelihood'] as SlotKind[];
  const filledCount = kinds.filter((k) => draft.slots[k]).length;
  const villageName = villageId ? state.villages.find((v) => v.id === villageId)?.name : null;

  return (
    <section className="paper">
      <div className="paper-title">
        <h3>政策卡槽 · 施政方针</h3>
        <span className="annotation">已填 {filledCount}/3 {filledCount === 3 ? '· 调度有方' : ''}</span>
      </div>
      <div className="paper-body">
        <div className="slot-row">
          {kinds.map((kind) => {
            const slot = draft.slots[kind];
            const card = slot ? config.policies.find((p) => p.id === slot.cardId) : null;
            const assigned = slot?.villageId
              ? state.villages.find((v) => v.id === slot.villageId)?.name
              : null;
            return (
              <div key={kind} className={`slot-cell ${card ? 'filled' : ''}`}>
                <span className="slot-kind">{KIND_LABEL[kind]}</span>
                {card ? (
                  <>
                    <b style={{ fontSize: 12 }}>{card.name}</b>
                    <span style={{ fontSize: 10, color: 'rgba(58,46,36,0.65)' }}>
                      {card.cost.cadre ? `干部精力 ${card.cost.cadre}` : ''}
                      {card.cost.fiscal ? ` 财政 ${card.cost.fiscal}` : ''}
                      {card.cost.coop ? ` 协作 ${card.cost.coop}` : ''}
                    </span>
                    {assigned && (
                      <span style={{ fontSize: 10, color: 'var(--seal)' }}>指派：{assigned}</span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(58,46,36,0.5)' }}>空</span>
                )}
              </div>
            );
          })}
        </div>

        {villageName && (
          <div style={{ margin: '6px 0' }}>
            {kinds.map((kind) => {
              const slot = draft.slots[kind];
              if (!slot) return null;
              const assigned = slot.villageId === villageId;
              return (
                <button
                  key={kind}
                  className={assigned ? 'toggled' : ''}
                  style={{ marginRight: 6, fontSize: 12 }}
                  onClick={() =>
                    updateDraft({
                      slots: {
                        ...draft.slots,
                        [kind]: { cardId: slot.cardId, villageId: assigned ? undefined : villageId },
                      },
                    })
                  }
                >
                  {assigned ? '✓已指派到本村' : `指派「${config.policies.find((p) => p.id === slot.cardId)?.name}」到本村`}
                </button>
              );
            })}
          </div>
        )}

        {kinds.map((kind) => {
          const candidates = config.policies.filter((p) => p.slot === kind && unlocked.has(p.id));
          if (candidates.length === 0) return null;
          return (
            <div key={kind} style={{ margin: '8px 0' }}>
              <div style={{ fontSize: 12, color: 'rgba(58,46,36,0.7)', marginBottom: 4 }}>
                {KIND_LABEL[kind]}可选：
              </div>
              <div className="card-deck">
                {candidates.map((card) => {
                  const picked = draft.slots[kind]?.cardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className={`policy-card grab-card ${picked ? 'played' : ''}`}
                      onClick={() => tryToggleCard(kind, card.id, villageId)}
                      onPointerDown={() => beginDrag({ kind: 'card', slot: kind, cardId: card.id })}
                      title={`${card.desc}${card.curse ? '（补贴诅咒：退坡时会暴雷）' : ''}；可拖到沙盘村庄落子，或点选入槽`}
                    >
                      <b style={{ fontSize: 12 }}>{card.name}</b>
                      {card.curse && <span style={{ color: 'var(--warn)', fontSize: 10, marginLeft: 4 }}>补贴诅咒</span>}
                      <div className="cost">
                        {card.cost.cadre ? `精力${card.cost.cadre} ` : ''}
                        {card.cost.fiscal ? `财政${card.cost.fiscal} ` : ''}
                        {card.cost.coop ? `协作${card.cost.coop}` : ''}
                      </div>
                      {card.combo && card.combo.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--indigo)' }}>组合：与他卡搭配有加成</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="note">
          {filledCount === 0
            ? '本回合未布施政方针——空转的回合，账面上不会好看。'
            : '政策卡按阶段解锁，不抽卡、不氪金；三槽全填获得「调度有方」。'}
        </p>
      </div>
    </section>
  );
}
