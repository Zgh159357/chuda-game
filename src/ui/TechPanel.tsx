// ============================================================
// 机制树面板（主控提示词第九节）：
// 四大流派 × 基础/进阶/极值/禁忌。解锁不止要政治资本，
// 还要治理状态与事件链达标（因果律条件引擎）。
// ============================================================
import React from 'react';
import { config } from '../config';
import { useGame } from './store';
import {
  checkUnlockConditions,
  isTechUnlocked,
  techRevealed,
  techAffordable,
} from '../core/systems/unlockEngine';

const BRANCH_NAMES: Record<string, string> = {
  org: '组织',
  industry: '产业',
  livelihood: '民生',
  infra: '基建',
};

const TYPE_NAMES: Record<string, string> = {
  basic: '基础',
  advanced: '进阶',
  extreme: '极值',
  taboo: '禁忌',
};

export function TechPanel() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const toggleTechUnlock = useGame((s) => s.toggleTechUnlock);
  if (!state) return null;

  const branches: string[] = ['org', 'industry', 'livelihood', 'infra'];

  return (
    <section className="paper tech-panel">
      <div className="paper-title">
        <h3>治理机制树</h3>
        <span className="annotation">耗政治资本 + 治理状态/事件链达标（政治资本 {state.county.politicalCapital.toFixed(0)}）</span>
      </div>
      <div className="paper-body">
        {branches.map((b) => (
          <div key={b} className="tech-branch">
            <h4>{BRANCH_NAMES[b]}</h4>
            {config.techTree
              .filter((t) => t.branch === b)
              .map((node) => {
                const unlocked = isTechUnlocked(state, node.id);
                const revealed = techRevealed(state, node);
                const inDraft = draft.techUnlocks.includes(node.id);
                const cond = checkUnlockConditions(state, node.conditions);
                const affordable = techAffordable(state, node);
                if (!revealed) {
                  return (
                    <button key={node.id} className="tech-node locked" disabled title="条件未明：这张机制卡还被档案纸盖着">
                      <span className="tech-name">？？？</span>
                      <span className="tech-desc">档案缺失，尚未显现</span>
                    </button>
                  );
                }
                const cls = unlocked
                  ? 'unlocked'
                  : !cond.ok || !affordable
                    ? 'locked'
                    : inDraft
                      ? 'selected'
                      : 'available';
                const title = unlocked
                  ? '已解锁'
                  : `需：${cond.missing.join('、')}；消耗 ${node.politicalCapitalCost} 政治资本`;
                return (
                  <button
                    key={node.id}
                    className={`tech-node ${cls} ${node.type === 'taboo' ? 'tech-taboo' : ''} ${node.type === 'extreme' ? 'tech-extreme' : ''}`}
                    title={title}
                    disabled={unlocked || !cond.ok || !affordable}
                    onClick={() => toggleTechUnlock(node.id)}
                  >
                    <span className="tech-name">
                      {unlocked ? '✓ ' : inDraft ? '☑ ' : ''}
                      {node.name}
                      <span className={`tech-type type-${node.type}`}>{TYPE_NAMES[node.type]}</span>
                    </span>
                    <span className="tech-desc">{node.effectDesc}</span>
                    {node.penaltyDesc ? <span className="tech-penalty">代价：{node.penaltyDesc}</span> : null}
                    {!unlocked && <span className="tech-cost">政治资本 {node.politicalCapitalCost}</span>}
                  </button>
                );
              })}
          </div>
        ))}
        <p className="note">极值节点增益强但背永久代价；禁忌节点可能把整局推向败局。解锁在本回合结算时生效。</p>
      </div>
    </section>
  );
}
