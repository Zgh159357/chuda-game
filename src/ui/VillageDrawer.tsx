// ============================================================
// 村庄档案抽屉（底部 62%）：点击沙盘村庄地块从下方滑出
// 左=村庄档案+干部名册（该村）/ 中=村庄规划沙盘 / 右=卡槽指派+待批文件
// ============================================================
import React from 'react';
import { useGame } from './store';
import { CadrePanel } from './CadrePanel';
import { VillageRoster } from './VillageRoster';
import { VillageSandbox } from './VillageSandbox';
import { SlotBoard } from './SlotBoard';
import { EventInbox } from './EventInbox';

export function VillageDrawer() {
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const drawerVillageId = useGame((s) => s.drawerVillageId);
  const closeDrawer = useGame((s) => s.closeDrawer);
  const updateDraft = useGame((s) => s.updateDraft);
  if (!state || !drawerVillageId) return null;

  const village = state.villages.find((v) => v.id === drawerVillageId);
  if (!village) return null;

  return (
    <div className="village-drawer">
      <div className="drawer-bar">
        <span className="stamp" style={{ marginRight: 2 }}>档案</span>
        <h3>{village.name} · 村庄档案板</h3>
        <span className="annotation">
          {village.surveyed ? `信息精度 ${Math.round(village.infoAccuracy)}` : '未摸排 · 情况不明'}
        </span>
        <button style={{ marginLeft: 'auto' }} onClick={closeDrawer}>合上档案板 ↓</button>
      </div>
      <div className="drawer-body map-view">
        <aside className="left-col">
          <CadrePanel
            state={state}
            assignments={Object.fromEntries(draft.cadreAssignments.map((a) => [a.cadreId, a.villageId]))}
            onAssign={(cadreId, villageId2) => {
              const rest = draft.cadreAssignments.filter((a) => a.cadreId !== cadreId);
              updateDraft({ cadreAssignments: [...rest, { cadreId, villageId: villageId2 }] });
            }}
          />
          <VillageRoster
            state={state}
            villageId={drawerVillageId}
            surveyVillages={draft.surveyVillages}
            onToggleSurvey={(vid) =>
              updateDraft({
                surveyVillages: draft.surveyVillages.includes(vid)
                  ? draft.surveyVillages.filter((x) => x !== vid)
                  : [...draft.surveyVillages, vid],
              })
            }
          />
        </aside>

        <main className="center-col">
          <VillageSandbox villageId={drawerVillageId} />
        </main>

        <aside className="right-col">
          <SlotBoard villageId={drawerVillageId} />
          <EventInbox />
        </aside>
      </div>
    </div>
  );
}
