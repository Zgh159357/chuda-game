// ============================================================
// 应用外壳（等距沙盘版，三层视图）：
// 最底层 MapView 沙盘（MapComponent 常驻）
// → 抽屉层 VillageDrawer（点击村庄从底部滑出 62% 档案板）
// → 覆盖层 DocumentModal（全屏红头公文，急件=强制批复）
// 全局层：迎检文件堆、回合结算报告、终局复盘。
// ============================================================
import React from 'react';
import { useGame } from './store';
import { StartScene } from './StartScene';
import { MapComponent } from './MapComponent';
import { VillageDrawer } from './VillageDrawer';
import { PaperStackLayer } from './PaperStackLayer';
import { DocumentModal } from './DocumentModal';
import { NegotiationModal } from './NegotiationModal';
import { RecruitModal } from './RecruitModal';
import { FloorDefenseOverlay } from './FloorDefenseOverlay';
import { MobileHint } from './MobileHint';
import { UnlockFlash } from './UnlockFlash';
import { RoundReport } from './RoundReport';
import { EndScreen } from './EndScreen';

export function App() {
  const state = useGame((s) => s.state);
  const report = useGame((s) => s.report);
  const hasSave = useGame((s) => s.hasSave);
  const startNew = useGame((s) => s.startNew);
  const continueGame = useGame((s) => s.continueGame);
  const closeReport = useGame((s) => s.closeReport);
  const restart = useGame((s) => s.restart);
  const openDocumentId = useGame((s) => s.openDocumentId);
  const getBlockingFileId = useGame((s) => s.getBlockingFileId);

  if (!state) {
    return (
      <>
        <StartScene onNew={startNew} onContinue={continueGame} hasSave={hasSave} />
        <MobileHint />
      </>
    );
  }

  if (state.status === 'ended') {
    return (
      <div className="game-shell">
        <EndScreen state={state} onRestart={restart} />
        <MobileHint />
      </div>
    );
  }

  // 强制公文：有未批复急件时置顶显示（优先级高于玩家自行点开的文件）
  const blocking = getBlockingFileId();
  const docId = blocking ?? openDocumentId;
  const forced = blocking !== null;

  return (
    <div className="game-shell">
      <header className="app-header">
        <span className="game-title">触达</span>
        <span className="game-sub">一本扶贫台账的三十年</span>
        <span className="header-stamp">云岭县扶贫开发领导小组 · 工作台账</span>
      </header>

      <MapComponent />
      <VillageDrawer />
      <PaperStackLayer />
      <MobileHint />

      {docId && <DocumentModal fileId={docId} forced={forced} />}
      <NegotiationModal />
      <RecruitModal />
      <FloorDefenseOverlay />
      <UnlockFlash />
      {report && <RoundReport outcome={report} onClose={closeReport} />}
    </div>
  );
}
