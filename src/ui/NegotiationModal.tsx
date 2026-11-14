import React from 'react';
import { config } from '../config';
import { useGame } from './store';
import { stubbornnessOf } from '../core/sandbox/negotiation';

// ============================================================
// 谈判博弈弹层（主控提示词第七节）：钉子户 / 低退出意愿户
// 打法：从 4 张手牌里选 ≤2 张，总「说服值」+ 运气对抗「顽固值」。
// 顽固值 = 100 − 退出意愿。胜：退出意愿 +20；败：政治资本 −4、信任 −2。
// ============================================================
export function NegotiationModal() {
  const state = useGame((s) => s.state);
  const openNegotiationGroupId = useGame((s) => s.openNegotiationGroupId);
  const pickedNegotiationHands = useGame((s) => s.pickedNegotiationHands);
  const closeNegotiation = useGame((s) => s.closeNegotiation);
  const toggleNegotiationHand = useGame((s) => s.toggleNegotiationHand);
  const confirmNegotiation = useGame((s) => s.confirmNegotiation);
  const playerStamina = useGame((s) => s.state?.county.playerStamina ?? 0);
  const staminaSpent = useGame((s) => s.draft.staminaSpent);

  if (!state || !openNegotiationGroupId) return null;

  const household = state.villages.flatMap((v) => v.households).find((h) => h.id === openNegotiationGroupId);
  if (!household) return null;

  const stubborn = stubbornnessOf(openNegotiationGroupId, state);
  const remaining = playerStamina - staminaSpent;
  const pickedTotal = pickedNegotiationHands
    .map((id) => config.negotiationHands.find((x) => x.id === id))
    .reduce((sum, h) => sum + (h?.value ?? 0), 0);

  const fiscalCost = pickedNegotiationHands
    .map((id) => config.negotiationHands.find((x) => x.id === id))
    .reduce((sum, h) => sum + (h?.cost.fiscal ?? 0), 0);
  const staminaCost = pickedNegotiationHands
    .map((id) => config.negotiationHands.find((x) => x.id === id))
    .reduce((sum, h) => sum + (h?.cost.stamina ?? 0), 0);
  const trustCost = pickedNegotiationHands
    .map((id) => config.negotiationHands.find((x) => x.id === id))
    .reduce((sum, h) => sum + (h?.cost.trust ?? 0), 0);

  const canAfford = state.county.fiscalFund >= fiscalCost && remaining >= staminaCost;

  return (
    <div className="negotiation-overlay">
      <div className="negotiation-sheet">
        <div className="document-head">
          <span className="redhead">云岭县 · 群众工作记录</span>
          <span className="doc-meta">当面恳谈 · 第 {state.county.round} 回合</span>
        </div>
        <h3>《{household.name} 户 · 恳谈》</h3>
        <p className="negotiation-intro">
          {household.name} 家认死理，干部上了三次门都没说动。
          <span className="annotation">（顽固值 {stubborn}，退出意愿 {household.exitWillingness}）</span>
        </p>
        <div className="stubborn-bar">
          <span className="stubborn-fill" style={{ width: `${stubborn}%` }} />
          <span className="stubborn-label">顽固值 {stubborn}</span>
        </div>
        <p className="negotiation-intro">出牌（最多两张）：</p>
        <div className="negotiation-hands">
          {config.negotiationHands.map((hand) => {
            const picked = pickedNegotiationHands.includes(hand.id);
            const costs: string[] = [];
            if (hand.cost.fiscal) costs.push(`财政 ${hand.cost.fiscal}`);
            if (hand.cost.stamina) costs.push(`个人精力 ${hand.cost.stamina}`);
            if (hand.cost.trust) costs.push(`信任 −${-hand.cost.trust}`);
            return (
              <button
                key={hand.id}
                className={`negotiation-hand ${picked ? 'picked' : ''}`}
                onClick={() => toggleNegotiationHand(hand.id)}
              >
                <b>{hand.name}</b>
                <span className="hand-value">说服 +{hand.value}</span>
                <span className="hand-cost">{costs.length > 0 ? `代价：${costs.join('、')}` : '无直接代价'}</span>
              </button>
            );
          })}
        </div>
        <p className="negotiation-intro">
          当前牌面：说服值 <b>{pickedTotal}</b>（运气浮动 ±10）
          {pickedTotal < stubborn && <span className="annotation">—— 未必能说动，牌面不足胜算低。</span>}
          {pickedTotal >= stubborn && <span className="annotation">—— 有胜算，但还要看运气。</span>}
        </p>
        <div className="negotiation-actions">
          <button className="secondary" onClick={closeNegotiation}>收起记录本</button>
          <button
            className="primary"
            disabled={pickedNegotiationHands.length === 0 || !canAfford}
            title={canAfford ? '' : '精力或财政不足，付不起这套牌'}
            onClick={confirmNegotiation}
          >
            拍板（{fiscalCost > 0 ? `财政 ${fiscalCost}，` : ''}{staminaCost > 0 ? `精力 ${staminaCost}，` : ''}{trustCost < 0 ? `信任 ${trustCost}` : ''}）
          </button>
        </div>
      </div>
    </div>
  );
}
