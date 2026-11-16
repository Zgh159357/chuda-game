// ============================================================
// §18 人才多阶段招募弹层：极乐迪斯科式的「对谈」
// 不是一次拍板：一段剧情 → 三五个选项（成本/失败率/后果）→ 逐阶段推进。
// 失败原地重试，婉拒 = 结账走人（可能永不回头）。
// ============================================================
import { useGame } from './store';
import { config } from '../config';
import { chainOf } from '../config/heroChains';
import { currentStepOf, optionAffordable } from '../logic/heroChain';

function costText(cost: RecruitCost | undefined): string {
  if (!cost) return '';
  const parts: string[] = [];
  if (cost.funds) parts.push(`财政 −${cost.funds}`);
  if (cost.politicalCapital) parts.push(`政治资本 −${cost.politicalCapital}`);
  if (cost.trust) parts.push(`信任 −${cost.trust}`);
  if (cost.targetVillageGovernance) parts.push(`锚点村治理 −${cost.targetVillageGovernance}`);
  return parts.join(' · ');
}

import type { RecruitOption } from '../core/types';
type RecruitCost = RecruitOption['cost'];

export function RecruitModal() {
  const state = useGame((s) => s.state);
  const openRecruitId = useGame((s) => s.openRecruitId);
  const closeRecruit = useGame((s) => s.closeRecruit);
  const chooseRecruitOption = useGame((s) => s.chooseRecruitOption);
  const declineRecruit = useGame((s) => s.declineRecruit);

  if (!state || !openRecruitId) return null;
  const pending = state.pendingRecruits.find((p) => p.heroId === openRecruitId);
  if (!pending) return null;
  const spec = config.heroes.find((h) => h.id === openRecruitId);
  const chain = chainOf(openRecruitId);
  if (!spec || !chain) return null;
  const step = currentStepOf(state, openRecruitId);
  if (!step) return null;
  const prog = state.heroChains[openRecruitId];
  const fails = prog?.failCount ?? 0;

  return (
    <div className="approval-overlay">
      <div className="approval-sheet recruit-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="document-head redhead">
          <div className="document-title">奇遇 · {spec.name}</div>
          <div className="document-meta">
            拟用人：{spec.role} ｜ 第 {step.stepId + 1}/{chain.recruitSteps.length} 步
            {fails > 0 ? ` ｜ 已受挫 ${fails} 次` : ''}
          </div>
        </div>
        <div className="document-body">
          <p className="recruit-question">{step.promptText}</p>
          <p className="recruit-desc">{spec.desc}</p>
          {spec.flawDesc ? <p className="recruit-flaw">⚠ 隐患：{spec.flawDesc}</p> : null}
          {chain.passiveDebuff ? (
            <p className="recruit-flaw">⚠ 体制摩擦：{chain.passiveDebuff.desc}</p>
          ) : null}
          <div className="recruit-choice recruit-choice-stack">
            {step.options.map((opt, idx) => {
              const afford = optionAffordable(state, openRecruitId, opt);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`option-card opt-${idx === 0 ? 'a' : idx === step.options.length - 1 ? 'c' : 'b'}`}
                  disabled={!afford.ok}
                  title={afford.ok ? undefined : `付不起：${afford.missing.join('、')}`}
                  onClick={() => chooseRecruitOption(openRecruitId, idx)}
                >
                  <span className="opt-label">{opt.label}</span>
                  <span className="opt-desc">成：{opt.successEffectDesc}</span>
                  <span className="opt-risk">败（{Math.round(opt.failChance * 100)}%）：{opt.failEffectDesc}</span>
                  <span className="opt-cost">
                    {costText(opt.cost) || '不花钱，只赌运气'}
                    {!afford.ok ? `（付不起：${afford.missing.join('、')}）` : ''}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="recruit-decline-row">
            <button
              type="button"
              className="paper-btn paper-btn-warn"
              onClick={() => declineRecruit(openRecruitId)}
            >
              婉拒（{chain.declinePenalty ?? '没有影响'}）
              {chain.declineCloses ? ' · 此后不复再请' : ''}
            </button>
          </div>
        </div>
        <div className="document-foot">
          <button type="button" className="paper-btn" onClick={closeRecruit}>
            改日再谈（先压着）
          </button>
        </div>
      </div>
    </div>
  );
}
