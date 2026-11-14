// ============================================================
// 人才两难抉择弹层（主控提示词第九节）：全屏公文纸排版
// 不是抽卡：事件链触发 → 一张两难抉择摆在桌上，玩家拍板。
// ============================================================
import { useGame } from './store';
import { config } from '../config';

export function RecruitModal() {
  const state = useGame((s) => s.state);
  const openRecruitId = useGame((s) => s.openRecruitId);
  const closeRecruit = useGame((s) => s.closeRecruit);
  const answerRecruit = useGame((s) => s.answerRecruit);

  if (!state || !openRecruitId) return null;
  const pending = state.pendingRecruits.find((p) => p.heroId === openRecruitId);
  if (!pending) return null;
  const spec = config.heroes.find((h) => h.id === openRecruitId);
  if (!spec || !spec.recruit) return null;
  const rec = spec.recruit;

  const acceptCosts: string[] = [];
  if (rec.acceptCosts?.fiscal) acceptCosts.push(`财政 −${rec.acceptCosts.fiscal}`);
  if (rec.acceptCosts?.politicalCapital !== undefined) {
    acceptCosts.push(`政治资本 ${rec.acceptCosts.politicalCapital >= 0 ? '+' : ''}${rec.acceptCosts.politicalCapital}`);
  }
  if (rec.acceptCosts?.trust !== undefined) {
    acceptCosts.push(`信任 ${rec.acceptCosts.trust >= 0 ? '+' : ''}${rec.acceptCosts.trust}`);
  }

  return (
    <div className="approval-overlay" onClick={() => undefined}>
      <div className="approval-sheet recruit-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="document-head redhead">
          <div className="document-title">请托信 · 两难抉择</div>
          <div className="document-meta">拟用人：{spec.role} {spec.name}</div>
        </div>
        <div className="document-body">
          <p className="recruit-question">{pending.question || rec.question}</p>
          <p className="recruit-desc">{spec.desc}</p>
          {spec.flawDesc ? <p className="recruit-flaw">⚠ 隐患：{spec.flawDesc}</p> : null}
          <div className="recruit-choice">
            <button
              type="button"
              className="option-card opt-a"
              onClick={() => answerRecruit(openRecruitId, true)}
            >
              <span className="opt-label">接受</span>
              <span className="opt-desc">{rec.acceptEffect}</span>
              {acceptCosts.length > 0 ? <span className="opt-cost">{acceptCosts.join(' · ')}</span> : null}
            </button>
            <button
              type="button"
              className="option-card opt-c"
              onClick={() => answerRecruit(openRecruitId, false)}
            >
              <span className="opt-label">拒绝</span>
              <span className="opt-desc">{rec.declinePenalty}</span>
              {rec.declineCloses ? <span className="opt-risk">拒绝后此人不复再请</span> : null}
            </button>
          </div>
        </div>
        <div className="document-foot">
          <button type="button" className="paper-btn" onClick={closeRecruit}>
            暂不批复（压着）
          </button>
        </div>
      </div>
    </div>
  );
}
