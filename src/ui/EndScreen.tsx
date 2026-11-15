import React, { useMemo } from 'react';
import type { GameState } from '../core/types';
import { config } from '../config';
import { summarizeLedger, trapReview } from '../core/settlement/ledger';
import { computeFiveRatings } from '../core/settlement/ending';

const RATING_NAMES: { key: keyof ReturnType<typeof computeFiveRatings>; label: string }[] = [
  { key: 'achievement', label: '成就' },
  { key: 'cost', label: '代价' },
  { key: 'organization', label: '组织' },
  { key: 'transition', label: '转换' },
  { key: 'temperature', label: '温度' },
];

export function EndScreen(props: { state: GameState; onRestart: () => void }) {
  const { state } = props;
  const summary = useMemo(() => summarizeLedger(state), [state]);
  const ratings = useMemo(() => computeFiveRatings(state), [state]);
  const traps = useMemo(() => trapReview(state), [state]);

  const ending = config.endings.find((e) => e.id === state.ending);
  const failures = state.history[state.history.length - 1]?.outcome.failures ?? [];

  const achievements = config.achievements.filter((a) => state.unlocked.achievements.includes(a.id));

  return (
    <div className="desk">
      <div className="desk-top paper">
        <span className="title">触达</span>
        <span className="annotation">终局复盘 · {config.timeLabels[state.county.round - 1]}</span>
      </div>

      <div className="desk-main" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="desk-panel paper">
          <div className="paper-title">
            <span>结局</span>
            <span className="stamp">终</span>
          </div>
          <div className="paper-body">
            <h2 style={{ marginBottom: 6 }}>{ending?.name ?? state.ending}</h2>
            <p style={{ marginBottom: 10 }}>{ending?.desc ?? ''}</p>
            {failures.length > 0 && (
              <div className="trap-box">
                <b>硬失败：</b>
                {failures.map((f) => config.text[`fail_${f}`] ?? f).join('；')}
              </div>
            )}
            <h4 style={{ margin: '10px 0 6px' }}>五维评级</h4>
            {RATING_NAMES.map((r) => (
              <div key={r.key} className="kv">
                <span>{r.label}</span>
                <span>
                  <span className="rating-badge">{ratings[r.key]}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="desk-panel paper">
          <div className="paper-title">
            <span>四本账</span>
          </div>
          <div className="paper-body">
            <div className="kv"><span>成就账</span><b>{summary.achievement > 0 ? '+' : ''}{summary.achievement}</b></div>
            <div className="kv"><span>代价账</span><b>{summary.cost > 0 ? '+' : ''}{summary.cost}</b></div>
            <div className="kv"><span>组织账</span><b>{summary.org > 0 ? '+' : ''}{summary.org}</b></div>
            <div className="kv"><span>转换账</span><b>{summary.transition > 0 ? '+' : ''}{summary.transition}</b></div>
            <div className="kv"><span>形式主义峰值</span><b>{state.county.formalityPeak.toFixed(0)}</b></div>
            <div className="kv"><span>组织成本比率</span><b>{state.county.orgCostRatio.toFixed(2)}</b></div>
            <div className="kv"><span>平均补贴依赖</span>
              <b>{state.villages.length ? (state.villages.reduce((s, v) => s + v.subsidyDependence, 0) / state.villages.length).toFixed(0) : 0}</b>
            </div>
            <div className="kv"><span>平均接得住指数</span>
              <b>{state.villages.length ? (state.villages.reduce((s, v) => s + v.canHoldIndex, 0) / state.villages.length).toFixed(0) : 0}</b>
            </div>
          </div>
        </div>

        <div className="desk-panel paper">
          <div className="paper-title">
            <span>陷阱复盘：哪些奖励其实是债</span>
          </div>
          <div className="paper-body">
            {traps.length === 0 ? (
              <p>没有掉进陷阱奖励。每一步都付了它该付的价。</p>
            ) : (
              traps.map((t) => (
                <div key={t.rewardId} className="trap-box">
                  <b>{config.rewards.find((r) => r.id === t.rewardId)?.effect ?? t.rewardId}</b>
                  <p style={{ fontSize: 14.5 }}>{t.title}</p>
                </div>
              ))
            )}
            <p className="annotation" style={{ fontSize: 14, marginTop: 8 }}>
              争先承诺、快速摘帽、高补贴产业、考核拉满、全兜底——
              它们都曾给过即时奖励，债在终局才见。
            </p>
          </div>
        </div>

        <div className="desk-panel paper">
          <div className="paper-title">
            <span>成就收集（{achievements.length}/{config.achievements.length}）</span>
          </div>
          <div className="paper-body">
            <ul className="events">
              {config.achievements.map((a) => {
                const got = state.unlocked.achievements.includes(a.id);
                return (
                  <li key={a.id} style={{ opacity: got ? 1 : 0.35 }}>
                    {a.isNegative ? '🪞' : '▣'} {a.name}
                    <span className="annotation" style={{ fontSize: 13, marginLeft: 6 }}>{got ? '已收录' : '未达成'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="desk-bottom paper">
        <p className="annotation" style={{ flex: 1 }}>
          设计者注释：触达是能力，接得住才是治理。
          本作所有地名、人物、数据与政策文本均为虚构。
          形式主义只通向负成就与差结局——这里没有造假获胜。
        </p>
        <button className="primary" onClick={props.onRestart}>合上档案盒 · 回到卷首</button>
      </div>
    </div>
  );
}
