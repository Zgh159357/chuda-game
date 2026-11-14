import type { CheckpointSpec, PhaseSpec } from '../core/types';

// ============================================================
// 阶段表 + 大考节点表 + 回合时间标签
// ============================================================
export const phases: PhaseSpec[] = [
  {
    id: 'A',
    name: '精准识别',
    rounds: [1, 4],
    roundSpan: 'halfYear',
    orgDensityTarget: [30, 50],
    orgDensityMode: 'auto',
    onEnterTextId: 'phase_a_enter',
  },
  {
    id: 'B',
    name: '分类攻坚',
    rounds: [5, 20],
    roundSpan: 'quarter',
    orgDensityTarget: [50, 80],
    orgDensityMode: 'auto',
    onEnterTextId: 'phase_b_enter',
  },
  {
    id: 'C',
    name: '决战验收',
    rounds: [21, 32],
    roundSpan: 'quarter',
    orgDensityTarget: [80, 90],
    orgDensityMode: 'auto',
    onEnterTextId: 'phase_c_enter',
  },
  {
    id: 'D',
    name: '过渡期',
    rounds: [33, 41],
    roundSpan: 'halfYear',
    orgDensityTarget: [90, 50],
    orgDensityMode: 'auto',
    onEnterTextId: 'phase_d_enter',
  },
  {
    id: 'E',
    name: '常态化',
    rounds: [42, 50],
    roundSpan: 'halfYear',
    orgDensityTarget: [40, 60],
    orgDensityMode: 'band',
    onEnterTextId: 'phase_e_enter',
  },
];

export const checkpoints: CheckpointSpec[] = [
  { id: 'r4_commitmentReview', round: 4, name: '首次责任书考核', desc: '承诺档位 vs 实际建档进度与精度' },
  { id: 'r12_midterm', round: 12, name: '中期评估', desc: '分类处置覆盖率、项目启动率' },
  { id: 'r20_supervision', round: 20, name: '攻坚中期督查', desc: '双绑稳定度、搬迁开工率' },
  { id: 'r32_acceptance', round: 32, name: '摘帽验收', desc: '精度、第三方覆盖率、形式主义水平' },
  { id: 'r35_subsidy', round: 35, name: '补贴退坡·第一波', desc: '高补贴依赖项目开始承压' },
  { id: 'r38_subsidy', round: 38, name: '补贴退坡·第二波', desc: '补贴再降，返贫预警窗口开启' },
  { id: 'r41_subsidy', round: 41, name: '补贴退坡·第三波', desc: '最后一波退坡，考验造血成色' },
  { id: 'r41_withdrawal', round: 41, name: '驻村撤出评估', desc: '外部嵌入转化内生治理' },
  { id: 'r50_final', round: 50, name: '终局判定', desc: '四本账 + 五维评级' },
];

// 生成 50 个回合的时间标签：A 半年（2012H1–2013H2）→ B 季度（2014Q1–2017Q4）
// → C 季度（2018Q1–2020Q4）→ D 半年（2021H1–2025H2）→ E 半年（2026H1–2030H1）
function buildTimeLabels(): string[] {
  const labels: string[] = [];
  const half = (y: number, h: 1 | 2) => `${y}年${h === 1 ? '上半年' : '下半年'}`;
  const q = (y: number, k: number) => `${y}年第${k}季度`;
  // A: 1-4
  labels.push(half(2012, 1), half(2012, 2), half(2013, 1), half(2013, 2));
  // B: 5-20
  for (let y = 2014; y <= 2017; y++) for (let k = 1; k <= 4; k++) labels.push(q(y, k));
  // C: 21-32
  for (let y = 2018; y <= 2020; y++) for (let k = 1; k <= 4; k++) labels.push(q(y, k));
  // D: 33-41
  for (let y = 2021; y <= 2025; y++) {
    labels.push(half(y, 1), half(y, 2));
  }
  labels.length = 41; // 2021H1..2025H1 恰好 9 个
  // E: 42-50
  for (let y = 2026; y <= 2030; y++) {
    labels.push(half(y, 1));
    if (labels.length < 50) labels.push(half(y, 2));
  }
  labels.length = 50;
  labels[49] = '2030年·初春';
  return labels;
}

export const timeLabels = buildTimeLabels();
