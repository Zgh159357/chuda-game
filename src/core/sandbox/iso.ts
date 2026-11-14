// ============================================================
// 等距沙盘投影：纯函数（无 UI 依赖，可单测）
// 地面坐标 (x, y) → 屏幕坐标：x' = (x−y)·cos30·TILE, y' = (x+y)·sin30·TILE
// SVG 用法：<g transform={isoMatrix(tx,ty)}> 内直接按地面坐标画图。
// ============================================================

export const TILE = 64;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/** 地面坐标 → 屏幕坐标 */
export function iso(x: number, y: number): [number, number] {
  return [(x - y) * COS30 * TILE, (x + y) * SIN30 * TILE];
}

/** 屏幕坐标 → 地面坐标（拖拽拾取的逆投影） */
export function unproject(sx: number, sy: number): [number, number] {
  const a = COS30 * TILE;
  const b = SIN30 * TILE;
  const dx = sx / a; // x - y
  const dy = sy / b; // x + y
  return [(dx + dy) / 2, (dy - dx) / 2];
}

/** SVG 等距变换矩阵（把地面正方形压成菱形） */
export function isoMatrix(tx = 0, ty = 0): string {
  const a = (COS30 * TILE).toFixed(4);
  const b = (SIN30 * TILE).toFixed(4);
  return `matrix(${a} ${b} ${-a} ${b} ${tx} ${ty})`;
}

/** 沙盘视图包围盒（地面 [0,w]×[0,h] 在屏幕上的范围） */
export function groundBounds(w: number, h: number): { width: number; height: number; minX: number; minY: number } {
  const minX = iso(0, h)[0];
  const maxX = iso(w, 0)[0];
  const minY = iso(0, 0)[1];
  const maxY = iso(w, h)[1];
  return { width: maxX - minX, height: maxY - minY, minX, minY };
}

/** 地面单位正方形地块路径（在等距 group 内使用） */
export function tilePath(x: number, y: number): string {
  return `M ${x} ${y} L ${x + 1} ${y} L ${x + 1} ${y + 1} L ${x} ${y + 1} Z`;
}

/** 地面多边形拉伸成建筑：h 为「抬高」高度（地面坐标里向上=向 x−,y− 平移） */
export function extrude(points: [number, number][], h: number): { walls: string; roof: string } {
  const roof = points.map(([x, y]) => [x - h, y - h] as [number, number]);
  const ring = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
  const wallParts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const aUp: [number, number] = [a[0] - h, a[1] - h];
    const bUp: [number, number] = [b[0] - h, b[1] - h];
    wallParts.push(`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${bUp[0]} ${bUp[1]} L ${aUp[0]} ${aUp[1]} Z`);
  }
  return { walls: wallParts.join(' '), roof: ring(roof) };
}

/** 常用建筑底面（地面坐标、以 (cx,cy) 为中心的正方形） */
export function boxFootprint(cx: number, cy: number, size: number): [number, number][] {
  const r = size / 2;
  return [
    [cx - r, cy - r],
    [cx + r, cy - r],
    [cx + r, cy + r],
    [cx - r, cy + r],
  ];
}
