import type { NodeActionSpec } from '../core/types';

// ============================================================
// 大地图节点交互（双层视图）：县政府 / 安置点 的个人精力动作
// 移动本身免费；交互耗组长个人精力（playerStamina）。
// ============================================================
export const nodeActions: NodeActionSpec[] = [
  {
    id: 'file_materials',
    name: '交材料',
    nodeKind: 'county',
    cost: 1,
    desc: '把各村台账交到县政府：手续清爽一分，上级眼里的分量重一分。',
    effects: [
      { kind: 'formality', value: -3 },
      { kind: 'politicalCapital', value: 1 },
    ],
  },
  {
    id: 'fiscal_run',
    name: '跑财政',
    nodeKind: 'county',
    cost: 1,
    desc: '去财政局磨拨款：钱到账，但张口要钱的账也会记在风险簿上。',
    effects: [
      { kind: 'fiscalFund', value: 5 },
      { kind: 'debtRisk', value: 1 },
    ],
  },
  {
    id: 'dispatch_meeting',
    name: '调度会',
    nodeKind: 'county',
    cost: 2,
    desc: '把干部们叫回来开调度会：组织机器转起来，人人心里有底。',
    effects: [
      { kind: 'orgDensity', value: 2 },
      { kind: 'morale', value: 1 },
    ],
  },
  {
    id: 'site_inspect',
    name: '视察安置点',
    nodeKind: 'site',
    cost: 1,
    desc: '去新坪安置点转一圈：搬迁户能不能自己把日子过起来，亲眼看看。',
    effects: [{ kind: 'siteLivelihood', value: 2 }],
  },
  {
    id: 'road_build',
    name: '修通道路',
    nodeKind: 'county',
    cost: 1,
    desc: '把公路往最近的一块荒坡再推进一格：路通到哪，货才运得到哪。',
    effects: [{ kind: 'roadSegment', value: 1 }],
  },
  {
    id: 'logistics_station',
    name: '建物流站',
    nodeKind: 'county',
    cost: 2,
    desc: '在县里建物流中转站：通了路的村子才收得到订单。耗财政 12。',
    effects: [
      { kind: 'fiscalFund', value: -12 },
      { kind: 'logisticsStation', value: 1 },
    ],
  },
  {
    id: 'site_plaza',
    name: '建文化广场',
    nodeKind: 'site',
    cost: 1,
    desc: '给安置点修个文化广场：搬来的人要有个聚得起来的地方。耗财政 8。',
    effects: [
      { kind: 'fiscalFund', value: -8 },
      { kind: 'siteCohesion', value: 20 },
      { kind: 'facility', value: 0, facilityId: 'plaza' },
    ],
  },
  {
    id: 'site_workshop',
    name: '建就业车间',
    nodeKind: 'site',
    cost: 1,
    desc: '在安置点旁建就业车间：有活干，心才定得下来。耗财政 10。',
    effects: [
      { kind: 'fiscalFund', value: -10 },
      { kind: 'siteCohesion', value: 15 },
      { kind: 'siteLivelihood', value: 8 },
      { kind: 'facility', value: 0, facilityId: 'workshop' },
    ],
  },
];
