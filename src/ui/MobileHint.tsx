// ============================================================
// 移动端提示浮窗（部署任务）：小屏设备提示使用电脑浏览器。
// 会话内可关闭（dismiss 存组件 state，不写 localStorage）。
// ============================================================
import React, { useEffect, useState } from 'react';

export function MobileHint() {
  const [small, setSmall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => setSmall(window.innerWidth < 980);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!small || dismissed) return null;
  return (
    <div className="mobile-hint">
      <span>当前屏幕较小，建议使用电脑浏览器以获得完整的沙盘推演体验。</span>
      <button onClick={() => setDismissed(true)}>知道了</button>
    </div>
  );
}
