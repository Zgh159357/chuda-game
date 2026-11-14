// ============================================================
// 底线防御全屏红头文件（第十节）：
// 村内生治理将跌破 20 → 县财政紧急下拨维稳资金（锁 20）。
// 结算后置 flash，报告关闭后弹出，点「收文归档」关闭。
// ============================================================
import React from 'react';
import { useGame } from './store';
import { config } from '../config';

export function FloorDefenseOverlay() {
  const state = useGame((s) => s.state);
  const flash = useGame((s) => s.floorDefenseFlash);
  const clearFloorDefenseFlash = useGame((s) => s.clearFloorDefenseFlash);
  if (!state || !flash) return null;
  const village = state.villages.find((v) => v.id === flash.villageId);
  return (
    <div className="floor-defense-overlay">
      <div className="approval-sheet">
        <div className="redhead">
          <div className="redhead-title">紧急通知</div>
          <div className="redhead-sub">云岭县财政局 · 内部传真</div>
        </div>
        <div className="document-body">
          <p className="doc-para">
            县财政紧急下拨维稳资金：<b>{village?.name ?? '该村'}</b> 内生治理濒临失守，按「底线防御」机制冻结治理底线。
          </p>
          <p className="doc-para">{config.text['floor_defense_text'] ?? ''}</p>
        </div>
        <div className="stamp-row">
          <button className="end-turn" onClick={clearFloorDefenseFlash}>
            收文归档
          </button>
        </div>
      </div>
    </div>
  );
}
