# 网格地块（Tile）组件渲染示例

> 对应主控提示词【五、当前启动任务】第 3 项：纸张质感 + 规划边界线。
> 生产实现见 `src/ui/MapSandbox.tsx`（等距投影 `isoMatrix` 内画地块）与 `src/core/sandbox/iso.ts`；本文件给出最小独立示例，便于新人理解「一张地块」怎么画。

## 等距地块（生产路径，零依赖 SVG）

```tsx
// src/core/sandbox/iso.ts 已提供：
//   iso(x, y)           地面格坐标 → 屏幕坐标
//   tilePath(x, y)      一块地面格的多边形路径字符串
//   isoMatrix(tx, ty)   SVG transform：matrix(0.866 0.5 -0.866 0.5 tx ty)
//
// MapSandbox.tsx 中一块地：
<g transform={isoMatrix(TX, TY)}>
  {GRID.map((row, y) =>
    row.map((cell, x) => (
      <polygon
        key={`${x}-${y}`}
        points={tilePath(x, y)}
        className={`iso-tile ${tileClass(x, y)}`} // 县治红/村绿/风险村泛红/安置点土黄/空地浅墨
      />
    ))
  )}
</g>
```

- 纸张质感来自全局旧纸滤镜（`.game-shell`：`#F4ECD8` 底色 + SVG feTurbulence 噪点 + clip-path 毛边），地块本身只画「墨线描边 + 低饱和填色」，符合档案台账观感。
- `vector-effect: non-scaling-stroke` 保证缩放时墨线粗细不变（钢笔手绘感）。

## 规划边界线（Zoning，Issue #1 交付后样式）

```css
/* 规划区边界：红色虚线 + 手工批注感（非现代半透明蓝） */
.zoning-boundary {
  fill: none;
  stroke: var(--seal);            /* 印章红 #B33A2B */
  stroke-width: 2.5;
  stroke-dasharray: 10 6;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.zoning-fill {
  opacity: 0.18;
  pointer-events: none;
}
.zoning-fill.agri   { fill: var(--field); }   /* 田野绿 #6B7F4E */
.zoning-fill.industry { fill: var(--indigo); } /* 靛蓝 #3E5C76 */
.zoning-fill.resettle { fill: var(--earth); }  /* 土黄 #C49A5A */
```

## 平面网格（平铺视角的最小独立示例）

若不想要等距、只做「俯视网格 + 纸张质感 + 规划边界」，可用纯 CSS 网格实现：

```tsx
// Tile.tsx（示例，非生产代码）
import React from 'react';

export type ZoningKind = 'agri' | 'industry' | 'resettle';

export function Tile({
  x,
  y,
  zoning,
  onSelect,
}: {
  x: number;
  y: number;
  zoning: ZoningKind | null;
  onSelect: (x: number, y: number) => void;
}) {
  return (
    <div
      className={`tile ${zoning ? `zoning-${zoning}` : ''}`}
      data-x={x}
      data-y={y}
      onClick={() => onSelect(x, y)}
      title={`地块 (${x}, ${y})${zoning ? ` · 已规划为${zoningLabel(zoning)}` : ''}`}
    />
  );
}

function zoningLabel(z: ZoningKind) {
  return z === 'agri' ? '农业区' : z === 'industry' ? '产业区' : '易地搬迁安置区';
}
```

```css
/* 纸张质感地块：米黄底 + 噪点 + 墨线网格 */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0;
  background: #f4ecd8;
  border: 2px solid #3a2e24;
  outline: 3px solid rgba(58, 46, 36, 0.25);
  outline-offset: 4px;
  position: relative;
}
/* 噪点：复用全局旧纸噪点（feTurbulence data-uri 或 css 斜纹） */
.tile-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
}
.tile {
  aspect-ratio: 1;
  border: 1px solid rgba(58, 46, 36, 0.55); /* 墨褐网格线 */
  cursor: pointer;
  transition: background-color 120ms ease;
}
.tile:hover { background: rgba(107, 127, 78, 0.18); }

/* 规划边界：选中态用印章红虚线收边 */
.tile.zoning-agri      { background: rgba(107, 127, 78, 0.35); outline: 2px dashed #b33a2b; outline-offset: -2px; }
.tile.zoning-industry  { background: rgba(62, 92, 118, 0.35); outline: 2px dashed #b33a2b; outline-offset: -2px; }
.tile.zoning-resettle  { background: rgba(196, 154, 90, 0.4);  outline: 2px dashed #b33a2b; outline-offset: -2px; }
```

## 规范要点（纸质档案美学，违反即返工）

1. 只用色板：纸米黄 `#F4ECD8`、墨褐 `#3A2E24`、印章红 `#B33A2B`、田野绿 `#6B7F4E`、土黄 `#C49A5A`、靛蓝 `#3E5C76`、警示橙 `#D07A2E`、失败灰 `#7A7268`。
2. 不用现代扁平按钮样式、不用霓虹/高饱和渐变、不用圆角阴影卡片。
3. 信息迷雾优先：未摸排村的 Tile 一律档案纸遮罩「？？？」，任何图层热力不得穿透遮罩。
4. 边界线用红笔虚线（手绘感），不用纯色粗线。
