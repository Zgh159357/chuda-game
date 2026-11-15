// ============================================================
// 等距战略沙盘：6×6 微缩地形 + 建筑模型 + 档案纸迷雾 + 拖拽落子
// + 规划画区（Zoning 框选）+ 数据图层透视（Info Views）
// 纯 SVG 零 3D；沙盘永远可由 state 重绘。
// ============================================================
import React, { useRef } from 'react';
import { useGame, MAP_NODES } from './store';
import {
  iso,
  isoMatrix,
  unproject,
  tilePath,
  extrude,
  boxFootprint,
} from '../core/sandbox/iso';
import { GRID, cellOwner, COUNTY_CELL, VILLAGE_CELLS, SITE_CELLS, deriveSandboxObjects } from '../core/sandbox/sandboxObjects';
import { canDrop } from '../core/sandbox/dropRules';
import { paperStackCount } from '../core/sandbox/paperStacks';
import { deriveZoningCells } from '../core/sandbox/zoning';
import { povertyHeat, governanceHeat, logisticsHeat, INFO_VIEW_LABELS, type InfoViewId } from '../core/sandbox/infoViews';
import { chainStatus } from '../core/sandbox/logistics';
import { ZONING_LABELS, type ZoningKind } from '../core/types';
import { config } from '../config';

const VB_W = 800;
const VB_H = 460;
const TX = 400;
const TY = 20;

const KIND_FILL: Record<string, { wall: string; roof: string }> = {
  villageHall: { wall: 'var(--earth)', roof: '#8a6b4a' },
  greenhouse: { wall: 'rgba(107,127,78,0.85)', roof: 'rgba(107,127,78,0.55)' },
  factory: { wall: '#6f675e', roof: '#4a443d' },
  solar: { wall: 'rgba(62,92,118,0.8)', roof: 'rgba(62,92,118,0.55)' },
  workshop: { wall: 'var(--earth)', roof: '#a8854f' },
};

const ZONING_STYLE: Record<ZoningKind, { fill: string; stroke: string }> = {
  agri: { fill: 'rgba(107,127,78,0.28)', stroke: 'var(--field)' },
  industry: { fill: 'rgba(196,154,90,0.30)', stroke: 'var(--earth)' },
  resettle: { fill: 'rgba(62,92,118,0.30)', stroke: 'var(--indigo)' },
};

const INFO_VIEWS: InfoViewId[] = ['none', 'poverty', 'governance', 'logistics'];

/** 节点 → 地面格 */
function nodeCell(nodeId: string): [number, number] {
  switch (nodeId) {
    case 'n_county':
      return COUNTY_CELL;
    case 'n_yunxi':
      return VILLAGE_CELLS.v_yunxi;
    case 'n_wuling':
      return VILLAGE_CELLS.v_wuling;
    case 'n_qingshi':
      return VILLAGE_CELLS.v_qingshi;
    case 'n_xinping':
      return SITE_CELLS.s_xinping;
    default:
      return COUNTY_CELL;
  }
}

export function MapSandbox() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const state = useGame((s) => s.state);
  const draft = useGame((s) => s.draft);
  const playerPos = useGame((s) => s.playerPos);
  const drag = useGame((s) => s.drag);
  const dragGhost = useGame((s) => s.dragGhost);
  const dropTarget = useGame((s) => s.dropTarget);
  const moveDrag = useGame((s) => s.moveDrag);
  const endDrag = useGame((s) => s.endDrag);
  const setDropTarget = useGame((s) => s.setDropTarget);
  const openDrawer = useGame((s) => s.openDrawer);
  const moveTo = useGame((s) => s.moveTo);
  const tryQueueNodeAction = useGame((s) => s.tryQueueNodeAction);
  const remainingStamina = useGame((s) => s.remainingStamina);

  // 规划画区 + 图层透视
  const zoningMode = useGame((s) => s.zoningMode);
  const zoningStart = useGame((s) => s.zoningStart);
  const zoningSel = useGame((s) => s.zoningSel);
  const beginZoneSelect = useGame((s) => s.beginZoneSelect);
  const extendZoneSelect = useGame((s) => s.extendZoneSelect);
  const commitZoneSelect = useGame((s) => s.commitZoneSelect);
  const setZoningMode = useGame((s) => s.setZoningMode);
  const infoView = useGame((s) => s.infoView);
  const setInfoView = useGame((s) => s.setInfoView);

  if (!state) return null;

  const objs = deriveSandboxObjects(state, draft);
  const [pcx, pcy] = nodeCell(playerPos);
  const zoningGroups = deriveZoningCells(state.zoning);

  /** clientX/Y → SVG 视图坐标 → 地面坐标 */
  function groundAt(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) * VB_W) / rect.width;
    const sy = ((e.clientY - rect.top) * VB_H) / rect.height;
    return unproject(sx - TX, sy - TY);
  }

  /** 地面坐标 → 格（钳制网格内） */
  function cellAt(e: React.PointerEvent): [number, number] {
    const [gx, gy] = groundAt(e);
    const cx = Math.floor(Math.min(GRID.w - 0.001, Math.max(0, gx)));
    const cy = Math.floor(Math.min(GRID.h - 0.001, Math.max(0, gy)));
    return [cx, cy];
  }

  function onDown(e: React.PointerEvent) {
    if (drag) return;
    if (zoningMode) {
      const [cx, cy] = cellAt(e);
      beginZoneSelect(cx, cy);
      (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    }
  }

  function onMove(e: React.PointerEvent) {
    if (drag) {
      moveDrag(e.clientX, e.clientY);
      const [cx, cy] = cellAt(e);
      const owner = cellOwner(cx, cy);
      setDropTarget({ kind: owner.kind, refId: owner.refId });
      return;
    }
    if (zoningStart) {
      const [cx, cy] = cellAt(e);
      extendZoneSelect(cx, cy);
    }
  }

  function onUp(e: React.PointerEvent) {
    if (drag) {
      endDrag(dropTarget);
      return;
    }
    if (zoningStart) {
      commitZoneSelect();
      return;
    }
    if (zoningMode) return; // 框选模式：无选择时忽略点击
    // 无拖拽 = 点击：村庄开抽屉，县治/安置点移动棋子
    const [cx, cy] = cellAt(e);
    const owner = cellOwner(cx, cy);
    if (owner.kind === 'village' && owner.refId) openDrawer(owner.refId);
    else if (owner.kind === 'county') moveTo('n_county');
    else if (owner.kind === 'site') moveTo('n_xinping');
  }

  /** 图层热力：poverty 返回色值；governance 返回色值 + 工作队覆盖标记 */
  function heatAt(x: number, y: number): string | null {
    if (infoView === 'poverty') return povertyHeat(state!, x, y);
    if (infoView === 'governance') return governanceHeat(state!, x, y).heat;
    return null;
  }

  const playerNode = MAP_NODES.find((n) => n.id === playerPos)!;
  const nodeActionsHere = config.nodeActions.filter((a) => {
    if (playerPos === 'n_xinping') return a.nodeKind === 'site';
    if (playerPos === 'n_county') return a.nodeKind === 'county';
    return false;
  });

  const dropOk =
    drag && dropTarget ? canDrop(drag, dropTarget, state).ok : false;

  return (
    <section className="paper map-paper map-sandbox">
      <div className="paper-title">
        <h3>云岭县域 · 战略沙盘</h3>
        <span className="annotation">
          你现在：{playerNode.label}
          {state.signals.length > 0 && ` · 待追查信号 ${state.signals.length}`}
          {paperStackCount(state) > 0 && ` · 迎检文件堆 ${paperStackCount(state) - draft.paperStacksCleared}`}
        </span>
      </div>

      {/* 数据图层透视：纸质标签页 */}
      <div className="info-view-tabs">
        {INFO_VIEWS.map((v) => (
          <button
            key={v}
            className={infoView === v ? 'active' : ''}
            onClick={() => setInfoView(v)}
          >
            {INFO_VIEW_LABELS[v]}
          </button>
        ))}
        {infoView === 'poverty' && <span className="tab-note">红=因病 · 土黄=偏远 · 靛蓝=因学 · 绿=生态约束（未摸排村照旧盖雾）</span>}
        {infoView === 'governance' && <span className="tab-note">红=村两委弱 · 绿=内生治理强 · 靛蓝虚线圈=工作队覆盖半径</span>}
        {infoView === 'logistics' && <span className="tab-note">褐色=已通公路 · 靛蓝圈=物流覆盖（通了公路+县里有物流站）</span>}
      </div>

      {/* 规划画区：框选工具栏 */}
      <div className="zoning-toolbar">
        <span className="zoning-label">规划画区：</span>
        {(Object.keys(ZONING_LABELS) as ZoningKind[]).map((k) => (
          <button
            key={k}
            className={zoningMode === k ? 'active' : ''}
            onClick={() => setZoningMode(zoningMode === k ? null : k)}
          >
            {ZONING_LABELS[k]}
          </button>
        ))}
        <span className="tab-note">
          {zoningMode
            ? `在沙盘上按住拖动框选地块（本回合累计 ${draft.zoning.length} 笔规划）。本版规划区仅作空间标注，数值效果后续版本绑定。`
            : '本版规划区仅作空间标注，数值效果后续版本绑定。'}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`iso-svg${drag ? ' dragging' : ''}${zoningMode ? ' zoning-mode' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* ===== 等距地块 ===== */}
        <g transform={isoMatrix(TX, TY)}>
          {Array.from({ length: GRID.h }, (_, y) =>
            Array.from({ length: GRID.w }, (_, x) => {
              const owner = cellOwner(x, y);
              const village = owner.kind === 'village' && owner.refId ? state.villages.find((v) => v.id === owner.refId) : null;
              const site = owner.kind === 'site' && owner.refId ? state.sites.find((s) => s.id === owner.refId) : null;
              let fill = 'rgba(58,46,36,0.05)';
              if (owner.kind === 'county') fill = 'rgba(179,58,43,0.18)';
              else if (village) fill = village.returnRisk >= 70 ? 'rgba(179,58,43,0.22)' : 'rgba(107,127,78,0.26)';
              else if (site) fill = 'rgba(196,154,90,0.3)';
              // 图层透视：热力覆盖底色
              const heat = heatAt(x, y);
              if (heat) fill = heat;
              const isDropCell =
                dropTarget && dropTarget.kind === owner.kind && dropTarget.refId === owner.refId;
              return (
                <path
                  key={`${x}_${y}`}
                  d={tilePath(x, y)}
                  className={`iso-tile${isDropCell ? (dropOk ? ' drop-cell-ok' : ' drop-cell-bad') : ''}`}
                  fill={fill}
                />
              );
            })
          )}

          {/* ===== 已规划画区（长期，从 state.zoning 派生） ===== */}
          {Object.entries(zoningGroups).flatMap(([kind, cells]) =>
            cells.map((c) => {
              const st = ZONING_STYLE[kind as ZoningKind];
              return (
                <path
                  key={`zone_${c.x}_${c.y}`}
                  d={tilePath(c.x, c.y)}
                  className="iso-zone"
                  fill={st.fill}
                  stroke={st.stroke}
                />
              );
            })
          )}

          {/* ===== 本回合规划预览（草稿） ===== */}
          {draft.zoning.flatMap((z, zi) =>
            z.cells.map((c) => {
              const st = ZONING_STYLE[z.kind];
              return (
                <path
                  key={`zoneprev_${zi}_${c.x}_${c.y}`}
                  d={tilePath(c.x, c.y)}
                  className="iso-zone preview"
                  fill={st.fill}
                  stroke={st.stroke}
                />
              );
            })
          )}

          {/* ===== 框选中（随指针） ===== */}
          {zoningSel.map((c) => (
            <path
              key={`zonesel_${c.x}_${c.y}`}
              d={tilePath(c.x, c.y)}
              className="iso-zone-select"
              fill="rgba(179,58,43,0.18)"
            />
          ))}

          {/* 内生治理层：工作队覆盖半径（靛蓝虚线圈） */}
          {infoView === 'governance' &&
            state.villages
              .filter((v) => v.surveyed && v.externalEmbed > 0)
              .map((v) => {
                const [cx, cy] = VILLAGE_CELLS[v.id] ?? COUNTY_CELL;
                const pts = Array.from({ length: 24 }, (_, i) => {
                  const a = (i / 24) * Math.PI * 2;
                  return iso(cx + 0.5 + Math.cos(a) * 1.4, cy + 0.5 + Math.sin(a) * 1.4);
                });
                const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
                return <path key={`cover_${v.id}`} d={d} className="iso-cover-ring" />;
              })}

          {/* 干裂泛红：高返贫风险村 */}
          {state.villages
            .filter((v) => v.returnRisk >= 70)
            .map((v) => {
              const [cx, cy] = VILLAGE_CELLS[v.id] ?? COUNTY_CELL;
              return (
                <path
                  key={`crack_${v.id}`}
                  className="iso-crack"
                  d={`M ${cx + 0.15} ${cy + 0.25} L ${cx + 0.45} ${cy + 0.55} L ${cx + 0.3} ${cy + 0.75} M ${cx + 0.6} ${cy + 0.2} L ${cx + 0.75} ${cy + 0.5} L ${cx + 0.55} ${cy + 0.8}`}
                />
              );
            })}

          {/* ===== 建筑模型 ===== */}
          {objs.map((o) => {
            const [cx, cy] = o.cell;
            const fp = boxFootprint(cx + 0.5, cy + 0.5, 0.62);
            const { walls, roof } = extrude(fp, o.h);
            const c = KIND_FILL[o.kind] ?? KIND_FILL.villageHall;
            return (
              <g key={o.id} className={`iso-building ${o.status}`}>
                <path d={walls} fill={c.wall} className="iso-building-wall" />
                <path d={roof} fill={c.roof} className="iso-building-roof" />
              </g>
            );
          })}

          {/* ===== 超级工程（奇观）：工地脚手架 / 落成建筑 ===== */}
          {config.wonders.map((w) => {
            const prog = state.wonders.find((x) => x.id === w.id);
            const invested = prog?.invested ?? 0;
            const built = prog?.built ?? false;
            const cx = w.cell.x;
            const cy = w.cell.y;
            if (!built && invested <= 0) return null;
            const fp = boxFootprint(cx + 0.5, cy + 0.5, built ? 0.78 : 0.6);
            if (built) {
              const { walls, roof } = extrude(fp, 0.55);
              const [tx, ty] = iso(cx + 0.5, cy + 0.5);
              return (
                <g key={`wonder_${w.id}`} className="iso-wonder">
                  <path d={walls} fill="#8a7a62" className="iso-building-wall" />
                  <path d={roof} fill="var(--seal)" className="iso-building-roof" />
                  <circle cx={tx} cy={ty - 30} r={9} fill="var(--seal)" opacity={0.9} />
                  <text
                    x={tx}
                    y={ty - 27}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#f2e8d5"
                    fontFamily="'Kaiti SC','KaiTi',serif"
                  >
                    章
                  </text>
                </g>
              );
            }
            // 施工中：竹脚手架 X 线
            const [ax, ay] = iso(cx, cy);
            const [bx, by] = iso(cx + 1, cy + 1);
            return (
              <g key={`scaffold_${w.id}`} className="iso-scaffold">
                <path d={`M ${ax} ${ay} L ${bx} ${by} M ${bx} ${ay} L ${ax} ${by}`} />
                <text
                  x={(ax + bx) / 2}
                  y={(ay + by) / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--seal)"
                  fontFamily="'Kaiti SC','KaiTi',serif"
                >
                  {w.name} {Math.round((invested / w.totalCost) * 100)}%
                </text>
              </g>
            );
          })}

          {/* ===== 安置点住房：茅草屋 → 有就业车间换新房 ===== */}
          {state.sites
            .filter((s) => s.population > 0)
            .map((s) => {
              const [cx, cy] = SITE_CELLS[s.id] ?? COUNTY_CELL;
              const newHouse = s.facilities.includes('workshop');
              const houses: [number, number][] = [
                [cx + 0.2, cy + 0.25],
                [cx + 0.7, cy + 0.3],
                [cx + 0.4, cy + 0.72],
              ];
              return (
                <g key={`houses_${s.id}`} className="iso-house">
                  {houses.map(([hx, hy], i) => {
                    const fp = boxFootprint(hx, hy, 0.24);
                    const { walls, roof } = extrude(fp, newHouse ? 0.16 : 0.1);
                    return (
                      <g key={i}>
                        <path d={walls} fill={newHouse ? '#e8e0cf' : '#b09a72'} className="iso-building-wall" />
                        <path d={roof} fill={newHouse ? 'var(--indigo)' : '#8a6b3a'} className="iso-building-roof" />
                      </g>
                    );
                  })}
                </g>
              );
            })}

          {/* 物流图层：公路与物流覆盖 */}
          {infoView === 'logistics' &&
            Array.from({ length: GRID.h }, (_, y) =>
              Array.from({ length: GRID.w }, (_, x) => {
                const lg = logisticsHeat(state!, x, y);
                if (!lg.road) return null;
                const [sx, sy] = iso(x + 0.5, y + 0.5);
                return (
                  <g key={`logi_${x}_${y}`}>
                    <path
                      d={`M ${sx - 12} ${sy} L ${sx - 4} ${sy - 8} L ${sx + 4} ${sy - 8} L ${sx + 12} ${sy} L ${sx + 4} ${sy + 8} L ${sx - 4} ${sy + 8} Z`}
                      className="iso-road"
                    />
                    {lg.covered && <circle cx={sx} cy={sy} r={13} className="iso-logi-ring" />}
                  </g>
                );
              })
            )}

          {/* ===== 档案纸迷雾（未摸排村） ===== */}
          {state.villages
            .filter((v) => !v.surveyed)
            .map((v) => {
              const [cx, cy] = VILLAGE_CELLS[v.id] ?? COUNTY_CELL;
              const fp = boxFootprint(cx + 0.5, cy + 0.5, 0.86);
              const ring = fp.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
              return <path key={`fog_${v.id}`} d={ring} className="iso-fog-paper" />;
            })}
        </g>

        {/* ===== 物流车动画：物流站建成后县治↔安置点往返 ===== */}
        {infoView === 'logistics' && state.county.logisticsStation && (
          <g className="iso-truck">
            {(() => {
              const [ax, ay] = iso(COUNTY_CELL[0] + 0.5, COUNTY_CELL[1] + 0.5);
              const [bx, by] = iso(SITE_CELLS.s_xinping[0] + 0.5, SITE_CELLS.s_xinping[1] + 0.5);
              return (
                <>
                  <path
                    d={`M ${ax} ${ay} L ${bx} ${by}`}
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                    strokeDasharray="4 5"
                    opacity="0.4"
                    fill="none"
                  />
                  <g>
                    <animateMotion dur="9s" repeatCount="indefinite" path={`M ${ax} ${ay} L ${bx} ${by} M ${bx} ${by} L ${ax} ${ay}`} />
                    <rect x={-7} y={-5} width={14} height={7} rx={2} fill="var(--indigo)" />
                    <rect x={-9} y={-3} width={4} height={5} fill="var(--ink)" opacity={0.75} />
                    <circle cx={5} cy={4} r={2.2} fill="var(--ink)" />
                  </g>
                </>
              );
            })()}
          </g>
        )}

        {/* ===== 屏幕空间层：迷雾红字 / 村名牌 / 玩家棋子 ===== */}
        {state.villages
          .filter((v) => !v.surveyed)
          .map((v) => {
            const [cx, cy] = VILLAGE_CELLS[v.id] ?? COUNTY_CELL;
            const [sx, sy] = iso(cx + 0.5, cy + 0.5);
            return (
              <text
                key={`fogtext_${v.id}`}
                x={sx + TX}
                y={sy + TY + 4}
                textAnchor="middle"
                fontSize="13"
                fill="var(--seal)"
                fontFamily="'Kaiti SC','KaiTi',serif"
              >
                未摸排
              </text>
            );
          })}

        {state.villages.map((v) => {
          const [cx, cy] = VILLAGE_CELLS[v.id] ?? COUNTY_CELL;
          const [sx, sy] = iso(cx + 0.5, cy + 1.35);
          return (
            <text
              key={`plaque_${v.id}`}
              x={sx + TX}
              y={sy + TY}
              textAnchor="middle"
              fontSize="13"
              fill="var(--ink)"
              fontFamily="'Kaiti SC','KaiTi',serif"
              style={{ userSelect: 'none' }}
            >
              {v.name}
            </text>
          );
        })}

        {state.sites.map((s) => {
          const [cx, cy] = SITE_CELLS[s.id] ?? COUNTY_CELL;
          const [sx, sy] = iso(cx + 0.5, cy + 1.35);
          return (
            <g key={`plaque_site_${s.id}`}>
              <text
                x={sx + TX}
                y={sy + TY}
                textAnchor="middle"
                fontSize="13"
                fill="var(--ink)"
                fontFamily="'Kaiti SC','KaiTi',serif"
              >
                {s.name}
              </text>
              {s.population > 0 && (
                <text
                  x={sx + TX}
                  y={sy + TY + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill={s.communityCohesion < 30 ? 'var(--seal)' : 'var(--ink)'}
                  fontFamily="'Kaiti SC','KaiTi',serif"
                >
                  凝聚力 {Math.round(s.communityCohesion)}
                </text>
              )}
            </g>
          );
        })}

        {/* 玩家棋子 */}
        <g pointerEvents="none">
          <circle cx={iso(pcx + 0.5, pcy + 0.5)[0] + TX} cy={iso(pcx + 0.5, pcy + 0.5)[1] + TY - 10} r={7} fill="var(--warn)" stroke="var(--ink)" strokeWidth="1.4">
            <animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      {/* 产业链闭环面板（物流图层下显示） */}
      {infoView === 'logistics' && (
        <div className="chain-panel">
          {state.projects
            .filter((p) => p.status === 'active')
            .map((p) => {
              const ch = chainStatus(state, p.id);
              if (!ch) return null;
              const MISSING_LABEL: Record<string, string> = { supply: '原料', road: '公路', logistics: '物流站' };
              return (
                <div key={p.id} className="chain-line">
                  <span className={ch.ok ? 'chain-ok' : 'chain-bad'}>{ch.ok ? '链成' : '断链'}</span>
                  <b>{p.name}</b>
                  {!ch.ok && <span className="annotation">缺 {ch.missing.map((m) => MISSING_LABEL[m]).join('、')} —— 产业项目将烂尾并扣财政</span>}
                  {ch.ok && <span className="annotation">原料 ✓ · 公路 ✓ · 物流站 ✓</span>}
                </div>
              );
            })}
        </div>
      )}

      {/* 节点交互（当前所在格） */}
      <div className="node-actions">
        <div style={{ fontSize: 14, color: 'rgba(58,46,36,0.75)', marginBottom: 4 }}>
          在「{playerNode.label}」可以办的事（个人精力余 {remainingStamina()}）：
        </div>
        {nodeActionsHere.length === 0 && (
          <p className="note">这里没有需要你亲自办的事。点击沙盘上的村庄地块，翻开它的档案。</p>
        )}
        {nodeActionsHere.map((a) => {
          const queued = draft.nodeActions.some((n) => n.nodeId === playerPos && n.actionId === a.id);
          return (
            <button
              key={a.id}
              className={queued ? 'toggled' : ''}
              title={`${a.desc}（耗 ${a.cost} 个人精力）`}
              onClick={() => tryQueueNodeAction(playerPos, a.id)}
            >
              {a.name}（{a.cost} 精力）
            </button>
          );
        })}
      </div>

      {/* 拖拽幽灵 */}
      {drag && dragGhost && (
        <div className="drag-ghost" style={{ left: dragGhost.x, top: dragGhost.y }}>
          {drag.kind === 'card'
            ? `📄 ${config.policies.find((p) => p.id === drag.cardId)?.name ?? drag.cardId}`
            : `👤 ${state.cadres.find((c) => c.id === drag.cadreId)?.name ?? drag.cadreId}`}
        </div>
      )}
    </section>
  );
}
