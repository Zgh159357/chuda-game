// ============================================================
// 超级工程面板（主控提示词第九节）：
// 15 大奇观分四类。分回合砸财政，但有开工条件——
// 有的要竞标资格，有的只在走投无路时才被允许。
// ============================================================
import React from 'react';
import { config } from '../config';
import { useGame } from './store';
import {
  checkUnlockConditions,
  wonderBuilt,
  wonderRevealed,
  canInvestWonder,
} from '../core/systems/unlockEngine';

const CATEGORY_NAMES: Record<string, string> = {
  transport: '交通',
  industry: '产业',
  livelihood: '民生',
  controversy: '争议',
};

export function WonderPanel() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const setWonderInvest = useGame((s) => s.setWonderInvest);
  if (!state) return null;

  const investFor = (wonderId: string) => draft.wonderInvest.find((w) => w.wonderId === wonderId)?.amount ?? 0;

  return (
    <section className="paper wonder-panel">
      <div className="paper-title">
        <h3>超级工程</h3>
        <span className="annotation">分期砸财政，条件达标才准开工（财政 {state.county.fiscalFund.toFixed(0)}）</span>
      </div>
      <div className="paper-body">
        {config.wonders.map((w) => {
          const progress = state.wonders.find((x) => x.id === w.id);
          const invested = progress?.invested ?? 0;
          const built = wonderBuilt(state, w.id);
          const draftInvest = investFor(w.id);
          if (!wonderRevealed(state, w)) {
            return (
              <div key={w.id} className="wonder-card wonder-hidden">
                <div className="wonder-head">
                  <b>？？？</b>
                </div>
                <p className="wonder-desc">档案袋里还压着一张蓝图，时机未到，看不清楚。</p>
              </div>
            );
          }
          const cond = checkUnlockConditions(state, w.conditions ?? {});
          const canStart = canInvestWonder(state, w);
          return (
            <div key={w.id} className={`wonder-card${built ? ' built' : ''}${w.trap ? ' wonder-trap' : ''}`}>
              <div className="wonder-head">
                <b>{built ? '☑ ' : invested > 0 ? '▣ ' : '▢ '}{w.name}</b>
                <span className="wonder-cat">[{CATEGORY_NAMES[w.category] ?? w.category}]</span>
                <span className="wonder-progress">
                  {built ? '已落成' : `进度 ${invested}/${w.totalCost}（本回合 +${draftInvest}）`}
                </span>
              </div>
              <p className="wonder-desc">{w.desc}</p>
              <p className="wonder-bonus">建成效果：{w.bonus.desc}</p>
              {w.upkeep !== undefined && w.upkeep > 0 ? (
                <p className="wonder-upkeep">⚠ 建成后每回合吸血 {w.upkeep} 财政</p>
              ) : null}
              {w.trap ? <p className="wonder-upkeep">⚠ 争议工程：只有账面，没有产出</p> : null}
              {!built && (
                <>
                  {!cond.ok && !canStart ? (
                    <p className="wonder-cond">开工条件未达：{cond.missing.join('、')}</p>
                  ) : null}
                  {invested === 0 && canStart ? (
                    <div className="wonder-invest">
                      <input
                        type="number"
                        min={0}
                        max={state.county.fiscalFund}
                        value={draftInvest || ''}
                        placeholder="投入财政"
                        onChange={(e) => setWonderInvest(w.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      />
                    </div>
                  ) : invested > 0 ? (
                    <div className="wonder-invest">
                      <input
                        type="number"
                        min={0}
                        max={state.county.fiscalFund}
                        value={draftInvest || ''}
                        placeholder="追加投入"
                        onChange={(e) => setWonderInvest(w.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        <p className="note">投入在本回合结算时扣除财政并计入进度；维护费每回合自动结算，财政不够会转为债务。</p>
      </div>
    </section>
  );
}
