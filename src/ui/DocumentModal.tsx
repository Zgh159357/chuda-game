// ============================================================
// 全屏公文（覆盖层）：红头文件 + 批复盖章
// 急件 = 强制模式：不可点外关闭（只能批复，或结束本月工作弃批）。
// ============================================================
import React, { useState } from 'react';
import { config } from '../config';
import { useGame } from './store';

const TONE_LABEL: Record<string, string> = {
  prudent: '稳',
  costly: '贵',
  fraud: '险',
};

interface Props {
  fileId: string;
  forced: boolean; // 急件强制批复
}

export function DocumentModal({ fileId, forced }: Props) {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const tryDecideFile = useGame((s) => s.tryDecideFile);
  const remainingStamina = useGame((s) => s.remainingStamina);
  const closeDocument = useGame((s) => s.closeDocument);
  const endTurn = useGame((s) => s.endTurn);
  const [denied, setDenied] = useState(false);

  if (!state) return null;
  const item = state.eventInbox.find((e) => e.fileId === fileId);
  const spec = config.eventFiles.find((f) => f.id === fileId);
  if (!spec || !item) return null;

  const decided = draft.eventDecisions.find((d) => d.fileId === fileId)?.optionId;

  return (
    <div className="document-modal">
      <div className="document-sheet">
        <div className="document-head">
          <h2>
            {spec.urgency === '急' ? '【急件】' : ''}
            {spec.title}
          </h2>
          <div className="doc-no">
            来文单位：{spec.sender} · 限期 {spec.deadlineRounds} 回合内批复 · 个人精力余 {remainingStamina()}
          </div>
          <div style={{ marginTop: 8 }}>
            {decided ? (
              <span className="stamp-mark">已批复：{decided}</span>
            ) : (
              <span style={{ fontSize: 14, color: 'rgba(58,46,36,0.6)' }}>待批</span>
            )}
          </div>
        </div>

        <p style={{ lineHeight: 1.8 }}>{spec.body}</p>

        <div className="redhead" style={{ fontSize: 15, marginTop: 14 }}>
          拟批复
        </div>
        {spec.options.map((opt) => {
          const cost = config.balance.fileOptionStamina[opt.id] ?? 0;
          const afford = remainingStamina() >= cost;
          const picked = decided === opt.id;
          return (
            <div
              key={opt.id}
              className={`document-opt${opt.tone === 'fraud' ? ' fraud' : ''}${picked ? ' picked' : ''}`}
              onClick={() => {
                setDenied(false);
                const ok = tryDecideFile(fileId, opt.id);
                if (!ok) setDenied(true);
                else closeDocument();
              }}
            >
              <span className="opt-id">{opt.id}</span>
              <div className="opt-body">
                <span className="opt-label">
                  {opt.label} [{TONE_LABEL[opt.tone]}]
                </span>
                <div className="opt-desc">{opt.desc}</div>
                {opt.risk && <div className="opt-risk">风险：{opt.risk.consequence}</div>}
                {!afford && <div className="opt-risk" style={{ color: 'var(--warn)' }}>精力不足，无法盖章。</div>}
              </div>
              <span className="opt-cost">耗 {cost} 精力</span>
            </div>
          );
        })}

        {denied && (
          <p className="note" style={{ color: 'var(--seal)', marginTop: 10 }}>
            个人精力不够了：结束本月工作（放弃批复，考核扣分），或等精力恢复。
          </p>
        )}

        <div className="forced-footer">
          {!forced && (
            <button onClick={closeDocument}>合上文件</button>
          )}
          {forced && (
            <span className="note" style={{ color: 'var(--seal)' }}>
              急件压不得：只能盖章批复，或结束本月工作接受扣分。
            </span>
          )}
          {forced && (
            <button className="end-turn" onClick={endTurn}>
              结束本月工作（放弃批复，压力 +5）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
