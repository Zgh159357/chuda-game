import { useGame } from './store';
import { synergyRecipes } from '../config/industry';

/**
 * §14 流派解锁牌匾：报告关闭后全屏闪现一次。
 * 版画牌匾 + 金线描边 + 头衔章，点击任意处收章。
 */
export default function SynergyFlash() {
  const synergyFlash = useGame((s) => s.synergyFlash);
  const clearSynergyFlash = useGame((s) => s.clearSynergyFlash);
  if (!synergyFlash) return null;
  const recipe = synergyRecipes.find((r) => r.id === synergyFlash.recipeId);
  if (!recipe) return null;
  return (
    <div className="synergy-flash" onClick={clearSynergyFlash}>
      <div className="synergy-plaque">
        <div className="synergy-plaque-head">云岭县 · 特色发展头衔</div>
        <div className="synergy-plaque-title">{recipe.unlockVillageTitle}</div>
        <div className="synergy-plaque-name">{recipe.name}</div>
        <div className="synergy-plaque-desc">{recipe.specialEffectDesc}</div>
        <div className="synergy-plaque-seal">触达</div>
        <div className="synergy-plaque-hint">点任意处收章</div>
      </div>
    </div>
  );
}
