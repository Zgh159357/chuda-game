import React, { useRef, useState } from 'react';
import type { PlayerAnchor } from '../core/types';
import { useGame } from './store';
import { ensureAudioContext } from './audio';

type GameLength = 'short' | 'full';

const ANCHORS: { id: PlayerAnchor; title: string; desc: string; tag: string }[] = [
  {
    id: 'returningStudent',
    title: '返乡大学生',
    desc: '你在外面念过书，回来接这个摊子。村里人先看你能待多久。群众参与 +5，初始信任 −3。',
    tag: '年轻人，先证明自己',
  },
  {
    id: 'entrusted',
    title: '前任托付',
    desc: '前任留下的账本还没合上。人走了，字签了，事情在你手里。初始信任 +3，政治资本 −2。',
    tag: '接过来的是摊子，也是债',
  },
  {
    id: 'local',
    title: '本地干部',
    desc: '你就在云岭长大，谁家灶头朝哪边开你都知道。熟人社会，人情也是成本。行动力 +1/回合，行政负担 +2。',
    tag: '自己人，躲不开人情',
  },
];

export function StartScene(props: {
  onNew: (anchor: PlayerAnchor, length: GameLength) => void;
  onContinue: () => void;
  hasSave: boolean;
}) {
  const [anchor, setAnchor] = useState<PlayerAnchor>('returningStudent');
  const [length, setLength] = useState<GameLength>('short');
  const fileRef = useRef<HTMLInputElement>(null);
  const importError = useGame((s) => s.importError);
  const importSave = useGame((s) => s.importSave);
  const clearImportError = useGame((s) => s.clearImportError);

  const startNew = () => {
    ensureAudioContext(); // 用户手势内初始化音频，避免 Chrome 拦截
    props.onNew(anchor, length);
  };
  const continueGame = () => {
    ensureAudioContext();
    props.onContinue();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      ensureAudioContext();
      importSave(String(reader.result ?? ''));
    };
    reader.onerror = () => importSave('');
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="desk">
      <div className="desk-top paper flex items-center gap-2">
        <span className="title">触达</span>
        <span className="annotation">一本扶贫台账的三十年</span>
      </div>

      <div className="desk-main">
        <div className="paper">
          <div className="paper-title">
            <span>卷首 · 你是谁</span>
            <span className="stamp">云岭县</span>
          </div>
          <div className="paper-body">
            <p>
              云岭县，户籍人口四十一万，贫困人口台账上的数字逐年变着。
              你被任命为扶贫开发领导小组组长。组织关系、责任书、检查组的行程表，
              一样样摆到了办公桌上。而县里三份村庄档案，还都盖着纸——雾没散之前，没人说得清穷在哪里。
            </p>
            <p className="annotation" style={{ marginTop: 8 }}>
              ——你从哪里来，决定村民第一眼怎么看你；先把谁家摸清楚，决定第一步往哪走。
            </p>
          </div>
        </div>

        <div className="paper">
          <div className="paper-title">
            <span>选择你的来路</span>
          </div>
          <div className="paper-body">
            {ANCHORS.map((a) => (
              <div
                key={a.id}
                className={`village-item ${anchor === a.id ? 'played' : ''}`}
                style={{ cursor: 'pointer', outline: anchor === a.id ? '2px solid var(--indigo)' : undefined }}
                onClick={() => setAnchor(a.id)}
              >
                <h4>
                  {a.title}
                  <span className="annotation" style={{ fontSize: 14 }}>{a.tag}</span>
                </h4>
                <p style={{ fontSize: 14.5 }}>{a.desc}</p>
              </div>
            ))}

            <div className="action-row" style={{ marginTop: 10 }}>
              <label>本局长度</label>
              <select value={length} onChange={(e) => setLength(e.target.value as GameLength)}>
                <option value="short">短局 · 前 18 回合（2012—2016）</option>
                <option value="full">长局 · 50 回合（2012—2030）</option>
              </select>
            </div>
          </div>
        </div>

        <div className="paper">
          <div className="paper-title">
            <span>卷宗</span>
          </div>
          <div className="paper-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="primary" onClick={startNew}>
              建档开局
            </button>
            <button onClick={continueGame} disabled={!props.hasSave}>
              {props.hasSave ? '翻开存档' : '没有存档'}
            </button>
            <button onClick={() => fileRef.current?.click()}>导入存档（.json）</button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={onPickFile}
            />
            {importError && (
              <p className="annotation" style={{ fontSize: 14, color: 'var(--seal)' }}>
                {importError}
                <button
                  style={{ marginLeft: 8, fontSize: 13, border: 'none', background: 'none', color: 'var(--indigo)', cursor: 'pointer' }}
                  onClick={clearImportError}
                >
                  知道了
                </button>
              </p>
            )}
            <p className="annotation" style={{ fontSize: 14 }}>
              本游戏所有地名、人物、数据与政策文本均为虚构。
              不还原真实政策，不虚构真实人物，不做苦难奇观。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
