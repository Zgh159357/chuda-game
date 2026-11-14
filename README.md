# 《触达：一本扶贫台账的三十年》

> 触达是能力，接得住才是治理。

单机回合制严肃治理模拟。玩家扮演虚构「云岭县」扶贫开发领导小组组长，通过信息摸排、公文批复、干部派驻、政策落子、考核纠偏与防返贫监测，把资源送到最底层；同时控制行政成本、政治风险、债务生态、补贴依赖与形式主义负担，最终完成从运动式攻坚到常态化治理的转换。

- **技术栈**：Vite + React 18 + TypeScript + TailwindCSS 3 + Zustand 5
- **AI 协作契约**：见 [AI_GUIDE.md](./AI_GUIDE.md)（主控提示词；GitHub 敏捷流程：Issue → 分支 → 接口先行 → 分步代码）
- **文档**：`docs/issues/`（Issue 归档）、`docs/gameStore-接口设计.md`、`docs/tile-组件示例.md`
- **本地运行**：`pnpm install && pnpm dev`（Windows 下可直接双击桌面「打开触达」）

## 目录约定

| 目录 | 职责 |
|---|---|
| `src/core/types.ts` | 全部数据类型（状态、回合动作、配置 spec、事件 union） |
| `src/core/` | 纯函数逻辑层（等价于主控提示词中的 `src/logic/`）：回合 reducer、系统结算、终局判定 |
| `src/core/sandbox/` | 等距沙盘纯函数：投影/逆投影、建筑派生、落子规则、文件堆派生 |
| `src/config/` | 数据驱动配置：公式系数、平衡参数、政策卡、事件文件、世界初始态、文本库 |
| `src/ui/` | React UI（只渲染与交互，不含数值逻辑）、Zustand store |
| `tests/` | Vitest 单元测试（当前 25/25） |

## 创作红线

不做苦难奇观（村民是主体不是资源卡）、不做英雄叙事（玩家是组织者）、不做单一归因、不还原真实政策（全部虚构中性）、不设计造假获胜（形式主义只通向负成就与差结局）。

## 测试

```bash
pnpm test      # vitest run
pnpm build     # tsc -b && vite build
```
