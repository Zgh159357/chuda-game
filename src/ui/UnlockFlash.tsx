// ============================================================
// 解锁光环（主控提示词第八节）：纸面印章光芒，不是霓虹。
// 机制解锁 / 超级工程落成 / 人才觉醒时全屏一闪 + 盖章音（可选）。
// ============================================================
import React, { useEffect, useRef } from 'react';
import { useGame } from './store';
import { getAudioContext } from './audio';

const FLASH_TEXT: Record<string, { title: string; sub: string }> = {
  tech: { title: '治理机制解锁', sub: '全县的工作方式，跟着变了。' },
  wonder: { title: '超级工程落成', sub: '地图上多了一处谁都能看见的东西。' },
  hero: { title: '人才觉醒', sub: '能人就在村里，只是之前没人张罗。' },
};

export function UnlockFlash() {
  const unlockFlash = useGame((s) => s.unlockFlash);
  const clearUnlockFlash = useGame((s) => s.clearUnlockFlash);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!unlockFlash) return;
    // 纸面盖章声：用启动页手势内初始化的共享 AudioContext（Chrome 不拦截）
    try {
      const actx = getAudioContext();
      if (actx && actx.state !== 'closed') {
        if (actx.state === 'suspended') void actx.resume();
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.frequency.value = 220;
        gain.gain.setValueAtTime(0.12, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.55);
        osc.connect(gain).connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.6);
      }
    } catch {
      /* 无声环境 */
    }
    timerRef.current = window.setTimeout(() => clearUnlockFlash(), 2600);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [unlockFlash, clearUnlockFlash]);

  if (!unlockFlash) return null;
  const info = FLASH_TEXT[unlockFlash];
  if (!info) return null;

  return (
    <div className="unlock-flash" onClick={clearUnlockFlash}>
      <div className="unlock-halo" />
      <div className="unlock-stamp">触达</div>
      <h2>{info.title}</h2>
      <p>{info.sub}</p>
      <span className="unlock-hint">点任意处收章</span>
    </div>
  );
}
