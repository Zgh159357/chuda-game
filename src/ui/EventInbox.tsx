// ============================================================
// 待批文件摞（信封）：点击打开全屏公文批复
// 批复逻辑在 DocumentModal；此处只做「信封列表」。
// ============================================================
import React from 'react';
import type { EventFileSpec } from '../core/types';
import { config } from '../config';
import { useGame } from './store';

export function EventInbox() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const openDocument = useGame((s) => s.openDocument);
  if (!state) return null;

  const specs = new Map<string, EventFileSpec>(config.eventFiles.map((f) => [f.id, f]));
  const decisionMap = new Map(draft.eventDecisions.map((d) => [d.fileId, d.optionId]));

  return (
    <section className="paper">
      <div className="paper-title">
        <h3>待批文件</h3>
        <span className="annotation">急件不批，无法安心收工</span>
      </div>
      <div className="paper-body">
        {state.eventInbox.length === 0 && <p className="note">桌面上暂时没有新文件。</p>}
        {state.eventInbox.map((item) => {
          const spec = specs.get(item.fileId);
          if (!spec) return null;
          const decided = decisionMap.get(item.fileId);
          return (
            <div
              className={`event-file ${spec.urgency === '急' ? 'urgent' : ''} ${decided ? 'answered' : ''}`}
              key={item.fileId}
              onClick={() => openDocument(item.fileId)}
              title="点开批阅"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {spec.urgency === '急' && <span className="urgent">急</span>}
                <b style={{ fontFamily: "'Songti SC', 'SimSun', serif" }}>{spec.title}</b>
                {decided && (
                  <span className="stat" style={{ marginLeft: 'auto', fontSize: 13 }}>
                    已批复：{decided}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(58,46,36,0.7)' }}>
                来文：{spec.sender} · 限期第 {item.deadline} 回合前
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
