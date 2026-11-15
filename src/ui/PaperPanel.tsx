import type { ReactNode } from 'react';

// ============================================================
// <PaperPanel /> —— 钉在桌上的纸（§12 主控提示词）
// 直边不圆角、撕纸毛边、左上角回形针、纸张略白于桌面。
// ============================================================

/** 撕纸毛边（确定性抖动多边形，直边 + 轻微锯齿） */
const TORN_CLIP =
  'polygon(' +
  '0% 3.2%, 1.6% 0.6%, 3.4% 2.9%, 5.2% 0.3%, 7.1% 3.0%, 9.0% 0.9%, 11.4% 2.6%, 13.5% 0.4%, ' +
  '16.2% 2.8%, 18.6% 0.7%, 21.5% 2.4%, 24.0% 0.5%, 26.8% 3.1%, 29.4% 0.8%, 32.6% 2.7%, ' +
  '35.3% 0.4%, 38.5% 2.9%, 41.2% 0.9%, 44.4% 2.5%, 47.5% 0.3%, 50.5% 3.0%, 53.6% 0.6%, ' +
  '56.8% 2.8%, 59.7% 0.5%, 63.0% 2.6%, 66.1% 0.9%, 69.3% 3.1%, 72.4% 0.4%, 75.5% 2.7%, ' +
  '78.6% 0.8%, 81.7% 2.4%, 84.9% 0.3%, 88.0% 2.9%, 91.1% 0.6%, 94.2% 2.6%, 97.0% 0.5%, ' +
  '99.2% 2.8%, 99.2% 97.0%, 97.3% 99.4%, 94.5% 97.2%, 91.6% 99.6%, 88.7% 97.1%, 85.8% 99.3%, ' +
  '82.9% 97.4%, 80.0% 99.5%, 77.1% 97.0%, 74.2% 99.2%, 71.3% 97.3%, 68.4% 99.6%, 65.5% 97.2%, ' +
  '62.6% 99.4%, 59.7% 97.1%, 56.8% 99.5%, 53.9% 97.4%, 51.0% 99.3%, 48.1% 97.0%, 45.2% 99.2%, ' +
  '42.3% 97.3%, 39.4% 99.6%, 36.5% 97.2%, 33.6% 99.4%, 30.7% 97.1%, 27.8% 99.5%, 24.9% 97.4%, ' +
  '22.0% 99.3%, 19.1% 97.0%, 16.2% 99.2%, 13.3% 97.3%, 10.4% 99.6%, 7.5% 97.2%, 4.6% 99.4%, ' +
  '1.7% 97.1%, 0.4% 99.5%, 0.4% 3.2%' +
  ')';

/** 回形针（金属细丝双回环，左上角斜钉） */
function Paperclip() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 46 46"
      className="pointer-events-none absolute -left-2 -top-2 z-10 drop-shadow"
      style={{ transform: 'rotate(-14deg)' }}
      aria-hidden="true"
    >
      <path
        d="M16 4 C 20 2, 36 6, 36 12 L 33 40 C 33 42, 29 44, 27 42 L 13 16 C 11 14, 12 11, 14 11 C 16 11, 17 13, 16 15 L 25 31 C 26 32, 28 32, 29 31 L 31 14"
        fill="none"
        stroke="#8d8172"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface PaperPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  /** 是否钉回形针（默认 true） */
  pinned?: boolean;
  /** 纸张泛黄程度 0-1（默认 0，纯纸白） */
  aged?: number;
}

export function PaperPanel({ title, children, className = '', pinned = true, aged = 0 }: PaperPanelProps) {
  return (
    <div
      className={`relative shadow-lg ${className}`}
      style={{
        clipPath: TORN_CLIP,
        background: aged > 0 ? `rgba(249, 246, 238, ${1 - aged * 0.12})` : '#F9F6EE',
        filter: aged > 0 ? `sepia(${aged * 0.28})` : undefined,
      }}
    >
      {pinned && <Paperclip />}
      {title && (
        <h3
          className="border-b px-4 py-2 text-sm font-bold tracking-[0.2em]"
          style={{ borderColor: 'rgba(58, 46, 36, 0.28)', color: '#3A2E24', fontFamily: "'FangSong','SimSun',serif" }}
        >
          {title}
        </h3>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
