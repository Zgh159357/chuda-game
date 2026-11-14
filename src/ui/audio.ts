// ============================================================
// 音频上下文管理：Chrome 要求 AudioContext 必须在用户手势内
// 创建/恢复，否则自动播放被拦截。启动页（StartScene）任何
// 「开始」点击都会调 ensureAudioContext()；其余组件只取不建。
// ============================================================

let ctx: AudioContext | null = null;

export function ensureAudioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** 取共享上下文；可能为 null（尚未解锁或浏览器不支持） */
export function getAudioContext(): AudioContext | null {
  return ctx;
}
