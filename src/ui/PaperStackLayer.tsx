// ============================================================
// 迎检文件堆：屏幕四角生长，遮挡沙盘视野
// 每堆点击=「盖章处理」耗 1 个人精力；收工时没清完 → 考核压力。
// ============================================================
import React, { useState } from 'react';
import { useGame } from './store';
import { paperStackCount } from '../core/sandbox/paperStacks';

const POS_CLASS = ['ps-tl', 'ps-tr', 'ps-bl', 'ps-br'];

export function PaperStackLayer() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const tryClearPaperStack = useGame((s) => s.tryClearPaperStack);
  const [denied, setDenied] = useState(false);
  if (!state) return null;

  const total = paperStackCount(state);
  if (total <= 0) return null;
  const remaining = total - draft.paperStacksCleared;

  return (
    <>
      {Array.from({ length: remaining }, (_, i) => (
        <div
          key={i}
          className={`paper-stack ${POS_CLASS[i % 4]}`}
          onClick={() => {
            const ok = tryClearPaperStack();
            setDenied(!ok);
          }}
          title="迎检材料：点此盖章处理（耗 1 精力）"
        >
          <div className="stack-top">
            迎检材料（{i + 1}/{total}）
            <span className="stack-note">点此盖章处理 · 耗 1 精力</span>
          </div>
        </div>
      ))}
      {denied && (
        <div className="note" style={{ position: 'fixed', bottom: 140, left: 12, zIndex: 320, color: 'var(--seal)' }}>
          个人精力不够，清不动这堆文件。
        </div>
      )}
    </>
  );
}
