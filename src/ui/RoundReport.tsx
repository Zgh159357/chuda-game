import React from 'react';
import type { RoundOutcome } from '../core/types';
import { config } from '../config';
import { synergyRecipes } from '../config/industry';
import { starLabel } from '../core/settlement/stars';

const EVENT_TAGS: Record<string, { text: string; cls: string }> = {
  villagerInitiative: { text: '村民', cls: '' },
  fuzzySignal: { text: '风声', cls: 'warn' },
  returnRiskWarning: { text: '返贫预警', cls: 'bad' },
  projectFailure: { text: '项目', cls: 'warn' },
  canHoldEvent: { text: '接不住', cls: 'bad' },
  checkpoint: { text: '大考', cls: '' },
  storyStage: { text: '叙事', cls: 'good' },
  milestone: { text: '里程碑', cls: 'good' },
  achievement: { text: '成就', cls: 'good' },
  phaseChange: { text: '阶段', cls: 'good' },
  eventFileResolved: { text: '公文', cls: '' },
  eventFileExpired: { text: '公文逾期', cls: 'warn' },
  cadreBurnout: { text: '干部过劳', cls: 'bad' },
  fogRevealed: { text: '揭雾', cls: 'good' },
  fraudCaught: { text: '造假暴露', cls: 'bad' },
  cohesionRiot: { text: '聚众闹事', cls: 'bad' },
  cohesionCrisis: { text: '返贫危机', cls: 'bad' },
  chainStall: { text: '产业链断', cls: 'warn' },
  negotiation: { text: '谈判', cls: '' },
  negTrait: { text: '干部异动', cls: 'bad' },
  techUnlock: { text: '机制解锁', cls: 'good' },
  wonderCompleted: { text: '超级工程', cls: 'good' },
  heroAwakened: { text: '人才觉醒', cls: 'good' },
  recruitOffered: { text: '两难抉择', cls: '' },
  recruitAccepted: { text: '人才入队', cls: 'good' },
  recruitDeclined: { text: '婉拒', cls: '' },
  heroSick: { text: '人才病倒', cls: 'warn' },
  tabooAudit: { text: '暗访败露', cls: 'bad' },
  industryDisaster: { text: '天灾', cls: 'bad' },
  cadreSlack: { text: '干部怠工', cls: 'warn' },
  floorDefense: { text: '底线防御', cls: 'bad' },
  resilienceAbsorbed: { text: '韧性缓冲', cls: 'warn' },
  governanceShieldAbsorbed: { text: '治理护盾', cls: 'good' },
  synergyUnlocked: { text: '流派解锁', cls: 'good' },
};

function eventText(outcome: RoundOutcome, e: RoundOutcome['events'][number]): string {
  switch (e.type) {
    case 'villagerInitiative':
      return config.text[e.textId] ?? e.textId;
    case 'fuzzySignal':
      return `${config.text[e.textId] ?? e.textId}${e.investigated ? '（已追查：确有实情）' : '（未追查，风险积累）'}`;
    case 'returnRiskWarning':
      return `返贫预警：${outcome.state.villages.find((v) => v.id === e.villageId)?.name ?? e.villageId} 风险抬升，还有 ${e.window} 回合响应窗口。`;
    case 'projectFailure':
      return `项目烂尾：${outcome.state.projects.find((p) => p.id === e.projectId)?.name ?? e.projectId} 运转不良。`;
    case 'canHoldEvent':
      return `接不住预警：${outcome.state.villages.find((v) => v.id === e.villageId)?.name ?? e.villageId} 的接得住指数跌破阈值。`;
    case 'checkpoint': {
      const r = outcome.checkpoints.find((c) => c.id === e.checkpointId);
      return `${config.checkpoints.find((c) => c.id === e.checkpointId)?.name}：${r?.passed ? '通过' : '未达标'}。`;
    }
    case 'storyStage': {
      const sl = config.storylines.find((s) => s.id === e.storyId);
      return `故事线推进：${sl?.title ?? e.storyId} 第 ${e.stageIndex} 章。`;
    }
    case 'milestone':
      return `里程碑：第 ${outcome.round} 回合，能力解锁。`;
    case 'achievement': {
      const ac = config.achievements.find((a) => a.id === e.achievementId);
      return `${e.isNegative ? '负成就（镜子）' : '成就'}：${ac?.name ?? e.achievementId}。`;
    }
    case 'phaseChange':
      return `${config.text[e.textId] ?? ''}`;
    case 'eventFileResolved': {
      const file = config.eventFiles.find((f) => f.id === e.fileId);
      return `《${file?.title ?? e.fileId}》已批复（${e.optionId}）。`;
    }
    case 'eventFileExpired': {
      const file = config.eventFiles.find((f) => f.id === e.fileId);
      return `《${file?.title ?? e.fileId}》逾期未批，按最坏情形自动处理（${e.optionId}）。`;
    }
    case 'cadreBurnout': {
      const cd = outcome.state.cadres.find((x) => x.id === e.cadreId);
      return `${config.text[e.textId] ?? e.textId}（${cd?.name ?? e.cadreId}）`;
    }
    case 'fogRevealed':
      return `信息迷雾揭开：${outcome.state.villages.find((v) => v.id === e.villageId)?.name ?? e.villageId} 的真实情况浮出水面。`;
    case 'fraudCaught':
      return config.text[e.textId] ?? e.textId;
    case 'cohesionRiot':
      return `安置点炸锅：${config.text[e.textId] ?? e.textId}`;
    case 'cohesionCrisis':
      return `安置点告急：${config.text[e.textId] ?? e.textId}`;
    case 'chainStall': {
      const p = outcome.state.projects.find((x) => x.id === e.projectId);
      return `产业链断链：${p?.name ?? e.projectId}（缺 ${e.missing.map((m) => ({ supply: '原料', road: '公路', logistics: '物流站' })[m]).join('、')}）烂尾。`;
    }
    case 'negotiation': {
      const h = outcome.state.villages.flatMap((v) => v.households).find((x) => x.id === e.groupId);
      return `${e.won ? '谈判成功' : '谈判破裂'}：${h?.name ?? e.groupId}${e.won ? ' 松了口' : ' 不为所动'}。`;
    }
    case 'negTrait': {
      const cd = outcome.state.cadres.find((x) => x.id === e.cadreId);
      return `${config.text[e.textId] ?? e.textId}（${cd?.name ?? e.cadreId}）`;
    }
    case 'techUnlock': {
      const node = config.techTree.find((t) => t.id === e.nodeId);
      return `治理机制解锁：${node?.name ?? e.nodeId}。`;
    }
    case 'wonderCompleted': {
      const w = config.wonders.find((x) => x.id === e.wonderId);
      return `超级工程落成：${w?.name ?? e.wonderId}（${w?.bonus.desc ?? ''}）。`;
    }
    case 'heroAwakened': {
      const h = config.heroes.find((x) => x.id === e.heroId);
      const v = outcome.state.villages.find((x) => x.id === e.villageId);
      return `人才觉醒：${h?.name ?? e.heroId}（${h?.role ?? ''}）在${v?.name ?? e.villageId}被发现了。`;
    }
    case 'recruitOffered': {
      const h = config.heroes.find((x) => x.id === e.heroId);
      return `两难抉择摆上桌：${h?.name ?? e.heroId}（${h?.role ?? ''}）有意入局，等你拍板。`;
    }
    case 'recruitAccepted': {
      const h = config.heroes.find((x) => x.id === e.heroId);
      return `人才入队：${h?.name ?? e.heroId}（${h?.role ?? ''}）。`;
    }
    case 'recruitDeclined': {
      const h = config.heroes.find((x) => x.id === e.heroId);
      return `婉拒了${h?.name ?? e.heroId}。有些门，关了就不容易再开。`;
    }
    case 'heroSick': {
      const h = config.heroes.find((x) => x.id === e.heroId);
      return `${h?.name ?? e.heroId}病倒了，暂时休养，增益暂停。`;
    }
    case 'tabooAudit': {
      const node = config.techTree.find((t) => t.id === e.nodeId);
      return `暗访组翻开了${node?.name ?? e.nodeId}的旧账——瞒过去的东西，终究瞒不过去。`;
    }
    case 'industryDisaster':
      return config.text[e.textId] ?? '天灾砸在产业上，全县的项目都受了波及。';
    case 'cadreSlack':
      return config.text[e.textId] ?? '有干部蔫了，下乡的日子少了。';
    case 'floorDefense': {
      const v = outcome.state.villages.find((x) => x.id === e.villageId);
      return `${v?.name ?? e.villageId} 内生治理濒临失守：${config.text[e.textId] ?? ''}`;
    }
    case 'resilienceAbsorbed':
      return `组织韧性抵挡了 ${e.amount} 点治理力损耗。`;
    case 'governanceShieldAbsorbed': {
      const v = outcome.state.villages.find((x) => x.id === e.villageId);
      return `${v?.name ?? e.villageId} 的治理护盾吸收了 ${e.amount} 点冲击，村两委没有伤到。`;
    }
    case 'synergyUnlocked': {
      const v = outcome.state.villages.find((x) => x.id === e.villageId);
      const recipe = synergyRecipes.find((r) => r.id === e.recipeId);
      return `${v?.name ?? e.villageId} 炼出了「${recipe?.unlockVillageTitle ?? e.recipeId}」——${recipe?.specialEffectDesc ?? ''}`;
    }
    default:
      return '';
  }
}

export function RoundReport(props: { outcome: RoundOutcome; onClose: () => void }) {
  const { outcome } = props;
  const c = outcome.state.county;
  const ended = outcome.gameStatus === 'ended';

  return (
    <div className="report-overlay" onClick={props.onClose}>
      <div className="report" onClick={(e) => e.stopPropagation()}>
        <h2>
          第 {outcome.round} 回合 · {config.timeLabels[outcome.round - 1]} 结算
          <span className="stars" style={{ marginLeft: 14 }}>
            {'★'.repeat(outcome.stars)}
            <span className="off">{'★'.repeat(5 - outcome.stars)}</span>
          </span>
        </h2>

        {outcome.stars < 5 && <p className="annotation">{starLabel(outcome.stars)}</p>}

        {outcome.failures.length > 0 && (
          <section>
            <h3 className="note">硬失败判定</h3>
            {outcome.failures.map((f) => (
              <p key={f} className="trap-box">{config.text[`fail_${f}`] ?? f}</p>
            ))}
          </section>
        )}

        {outcome.checkpoints.length > 0 && (
          <section>
            <h3>大考</h3>
            {outcome.checkpoints.map((cp) => (
              <div key={cp.id} className="ledger-line">
                <span className="kind">{cp.passed ? '通过' : '未达标'}</span>
                <span>
                  {config.checkpoints.find((x) => x.id === cp.id)?.name ?? cp.id}
                  {cp.pressureDelta !== 0 && `（压力${cp.pressureDelta > 0 ? '+' : ''}${cp.pressureDelta}）`}
                  {cp.politicalCapitalDelta !== 0 && `（政治资本${cp.politicalCapitalDelta > 0 ? '+' : ''}${cp.politicalCapitalDelta}）`}
                </span>
              </div>
            ))}
          </section>
        )}

        {outcome.microFeedbacks.length > 0 && (
          <section>
            <h3>即时反馈</h3>
            {outcome.microFeedbacks.map((mf, i) => (
              <p key={i} className="note">{config.text[mf.textId] ?? mf.textId}</p>
            ))}
          </section>
        )}

        {outcome.events.length > 0 && (
          <section>
            <h3>村里发生的事</h3>
            <ul className="events">
              {outcome.events.map((e, i) => (
                <li key={i}>
                  <span className={`tag ${EVENT_TAGS[e.type]?.cls ?? ''}`}>{EVENT_TAGS[e.type]?.text ?? e.type}</span>
                  {eventText(outcome, e)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {outcome.ledgerDelta.length > 0 && (
          <section>
            <h3>本回合入账</h3>
            {outcome.ledgerDelta.map((l, i) => (
              <div key={i} className="ledger-line">
                <span className="kind">{l.kind}</span>
                <span style={{ flex: 1 }}>{l.note}</span>
                <b>{l.value > 0 ? '+' : ''}{l.value}</b>
              </div>
            ))}
          </section>
        )}

        <section>
          <h3>账面速览</h3>
          <div className="stat-row">
            <span className="stat">财政 <b>{c.fiscalFund.toFixed(1)}</b></span>
            <span className="stat">信任 <b>{c.trust.toFixed(0)}</b></span>
            <span className="stat">政治资本 <b>{c.politicalCapital.toFixed(0)}</b></span>
            <span className="stat">债务 <b>{c.debtRisk.toFixed(0)}</b></span>
            <span className="stat">形式主义 <b>{c.formality.toFixed(0)}</b></span>
            <span className="stat">组织密度 <b>{c.orgDensity.toFixed(0)}</b></span>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          {ended ? (
            <button className="primary" onClick={props.onClose}>合上卷宗</button>
          ) : (
            <button className="primary" onClick={props.onClose}>翻回桌面</button>
          )}
        </div>
      </div>
    </div>
  );
}
