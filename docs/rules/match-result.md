# 规则匹配结果与稀疏激活索引设计

## 背景

当前匹配函数只返回计分系数：

```ts
type RuleMatcher = (grid: Grid, params?: unknown) => number
```

这个结果足以完成判定和计分，但无法告诉前端：

- 哪些格子组成了本次匹配；
- 一条规则在棋盘中命中了多少个独立区域；
- 同一次命中包含哪些结构部分；
- 某些格子应该按照什么顺序呈现。

为了支持高亮、逐格动画、多色显示和 badge hover 回放，匹配函数应返回结构化结果。匹配层只提供有序的格子分组，不指定颜色、动画类型、播放时间或展示方式。

## 设计目标

- 判定、计分和展示证据由同一次匹配计算产生；
- 支持一条规则在棋盘中命中多次；
- 支持一次命中包含多个有序格子组；
- 同一格可以在多个格子组中反复出现；
- 前端可将格子组解释为颜色分组、动画帧或累积步骤；
- 避免为稀疏结果固定创建多个 6×6 布尔矩阵；
- 匹配逻辑不依赖 Vue、CSS 或具体动画实现；
- 计分系数与命中数量、分组数量相互独立。

## 核心类型

```ts
type Grid = number[][]
type CellIndex = number

type ActivationGroup = CellIndex[]

interface MatchEvidence {
  groups: ActivationGroup[]
}

interface RuleMatchResult {
  coefficient: number
  matches: MatchEvidence[]
}

type RuleMatcher = (
  grid: Grid,
  params?: unknown,
) => RuleMatchResult
```

结构关系为：

```text
RuleMatchResult
├── coefficient                    计分系数
└── matches                        一条规则的所有独立命中
    └── MatchEvidence              一次独立命中
        └── groups                 有序的格子组
            └── CellIndex[]        当前组激活的格子
```

## 格子索引

当前棋盘固定为 6×6。格子使用从 0 到 35 的行优先索引：

```text
 0  1  2  3  4  5
 6  7  8  9 10 11
12 13 14 15 16 17
18 19 20 21 22 23
24 25 26 27 28 29
30 31 32 33 34 35
```

坐标与索引的换算为：

```ts
function toCellIndex(row: number, column: number, width = 6): CellIndex {
  return row * width + column
}

function fromCellIndex(index: CellIndex, width = 6) {
  return {
    row: Math.floor(index / width),
    column: index % width,
  }
}
```

虽然当前宽度固定为 6，工具函数仍应根据输入棋盘宽度计算，避免算法内部散布常量。

## 字段语义

### `coefficient`

`coefficient` 是非负整数计分系数：

- `0` 表示规则未命中；
- 正整数用于计算规则得分；
- 最终得分仍为 `coefficient × baseScore`。

### `matches`

外层 `matches` 区分同一规则的多次独立命中。

例如棋盘中存在三个十字：

```ts
{
  coefficient: 3,
  matches: [
    { groups: [firstArms, firstCenter] },
    { groups: [secondArms, secondCenter] },
    { groups: [thirdArms, thirdCenter] },
  ],
}
```

规则通常只生成一个 badge。多次命中保存在该 badge 对应结果的 `matches` 中，而不是生成多个重复 badge。

### `groups`

`groups` 是一次命中内的有序格子组。数组顺序可以被前端解释为：

- 不同颜色的结构层；
- 依次播放的动画帧；
- 逐步累积显示的步骤；
- 合并后一次显示的区域。

匹配层不规定前端采用哪一种解释。

## 基本约束

### 未命中

未命中必须返回：

```ts
{
  coefficient: 0,
  matches: [],
}
```

不应返回空的命中项：

```ts
// 不推荐
{
  coefficient: 0,
  matches: [{ groups: [] }],
}
```

### 索引范围

对于 6×6 棋盘，每个索引必须为 0–35 的整数。通用实现应验证：

```ts
0 <= index && index < grid.length * grid[0].length
```

### 组内不重复

同一个 `ActivationGroup` 内不应包含重复索引：

```ts
// 不推荐
[7, 7, 8]
```

重复索引不会增加展示信息，还可能导致前端重复处理。

### 跨组可以重复

同一个格子可以出现在不同组中：

```ts
{
  groups: [
    [7],
    [6, 7, 8],
    [1, 7, 13],
  ],
}
```

这可以表达同一格在多帧中反复激活，无需使用位掩码或额外接口。

### 避免空组

通常不应生成 `[]`。如果一次命中没有可局部高亮的格子，应返回包含全部格子的整板组。

### 顺序稳定

匹配器必须采用确定的顺序：

- 候选区域按从上到下、从左到右；
- 路径按实际经过顺序；
- 对应位置按规则文档规定顺序；
- 符号组按符号在模板中的首次出现顺序；
- 数字组按参数中的配置顺序；
- 连通块按其第一个行优先索引排序；
- 组内索引按算法语义排序；没有特殊语义时按升序。

相同输入必须始终产生相同的 `matches` 和 `groups` 顺序。

## 为什么使用稀疏索引

### 相比多个布尔 Mask

6×6 布尔 mask 可以表达相同信息，但稀疏索引对局部匹配更直接：

```ts
// 布尔 mask
[
  [false, true,  false, false, false, false],
  [true,  true,  true,  false, false, false],
  [false, true,  false, false, false, false],
  // ...
]

// 稀疏索引
[1, 6, 7, 8, 13]
```

稀疏索引的优势：

- 只返回真正参与展示的格子；
- 更容易阅读、记录和测试；
- 更容易追加路径步骤或对应位置；
- 前端无需扫描全部 36 格来恢复激活位置；
- 同一格可自然出现在多个组中。

JavaScript 中布尔值的具体占用是引擎实现细节。本项目数据量很小，选择稀疏索引主要是为了语义和操作便利，而不是依赖特定的内存估算。

### 相比单个整型层级矩阵

一个 6×6 整型数组可以用数字表示层级，但它隐含“每格只属于一个层”。若改用按位标记，则会引入：

- 位数限制；
- JavaScript 32 位有符号位运算语义；
- 颜色组与播放顺序之间的解释歧义；
- 多次独立命中仍需额外数组。

稀疏分组直接表达实际关系，不需要位运算约定。

## 计分与激活数据相互独立

`coefficient` 与以下数量均不要求相等：

- `matches.length`；
- 某次命中的 `groups.length`；
- 某个组的格子数量；
- 所有组的索引总数。

例如检测到三个俄罗斯方块时：

```ts
{
  coefficient: 4, // 2^(3-1)
  matches: [
    { groups: [[/* 第一个四格块 */]] },
    { groups: [[/* 第二个四格块 */]] },
    { groups: [[/* 第三个四格块 */]] },
  ],
}
```

围棋可能检测到两个被提棋块，共七枚棋子：

```ts
{
  coefficient: 7,
  matches: [
    { groups: [firstCaptured, firstSurrounding] },
    { groups: [secondCaptured, secondSurrounding] },
  ],
}
```

因此：

- `coefficient` 只负责计分；
- `matches` 只负责说明独立命中；
- `groups` 只负责说明格子分组和顺序；
- 前端不能根据分组数量自动推导得分。

## 前端职责

匹配结果不包含：

- CSS 颜色；
- 动画名称；
- 播放持续时间；
- 是否同时播放；
- 是否循环；
- 是否累积已播放的组；
- 是否在格子之间画线。

对于同一个 `groups`，前端可以自由选择展示方式。

### 同时多色显示

```ts
match.groups.forEach((group, index) => {
  highlightCells(group, palette[index])
})
```

### 按顺序播放

```ts
for (const group of match.groups) {
  await animateCells(group)
}
```

### 逐步累积

```ts
const visible = new Set<CellIndex>()
for (const group of match.groups) {
  group.forEach((index) => visible.add(index))
  renderCells([...visible])
  await delay(200)
}
```

### 合并显示

```ts
const merged = [...new Set(match.groups.flat())]
highlightCells(merged)
```

因此，多色显示与逐帧动画不需要不同的匹配器接口。

前端可以按 `rule.label` 配置默认展示策略：

```ts
const presentation = {
  crosshair: 'sequence',
  snake: 'sequence',
  creeper: 'parallel-colors',
  'next-round': 'parallel-colors',
  'seven-segment-symmetry': 'custom',
}
```

七段数码管、化学元素等特殊规则可以使用专用渲染器，但仍消费同一种稀疏匹配结果。

## 工具函数

建议提供统一的稀疏索引工具：

```ts
interface CellPosition {
  row: number
  column: number
}

function toCellIndex(
  grid: Grid,
  row: number,
  column: number,
): CellIndex {
  return row * grid[0]!.length + column
}

function fromCellIndex(
  grid: Grid,
  index: CellIndex,
): CellPosition {
  const width = grid[0]!.length
  return {
    row: Math.floor(index / width),
    column: index % width,
  }
}

function cellsToIndices(
  grid: Grid,
  cells: CellPosition[],
): CellIndex[] {
  return cells.map(({ row, column }) => toCellIndex(grid, row, column))
}

function wholeBoardGroup(grid: Grid): CellIndex[] {
  return Array.from(
    { length: grid.length * grid[0]!.length },
    (_, index) => index,
  )
}

function mergeGroups(groups: ActivationGroup[]): ActivationGroup {
  return [...new Set(groups.flat())]
}
```

为了兼容需要 6×6 布尔矩阵的渲染代码，前端可以按需转换：

```ts
function groupToMask(grid: Grid, group: ActivationGroup): boolean[][] {
  const active = new Set(group)
  let index = 0
  return grid.map((row) => row.map(() => active.has(index++)))
}
```

稀疏索引是匹配层的标准格式，布尔 mask 只是前端可选的派生格式。

## 各类规则的返回方式

### Pattern 匹配

Pattern matcher 每命中一个候选起点，生成一个 `MatchEvidence`。同一模板中的不同符号或固定数字生成不同 group。

以左上角命中的附魔金苹果为例：

```text
###
#*#
###
```

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        [0, 1, 2, 6, 8, 12, 13, 14], // # 外围
        [7],                           // * 中心
      ],
    },
  ],
}
```

如果模板命中三个位置，则产生三个 `MatchEvidence`：

```ts
{
  coefficient: 3,
  matches: [
    { groups: [firstOuter, firstCenter] },
    { groups: [secondOuter, secondCenter] },
    { groups: [thirdOuter, thirdCenter] },
  ],
}
```

Pattern 的 group 顺序规定为：

1. 如果规则配置了 `groupOrder`，则按其中列出的 token 顺序确定 group 顺序；
2. 否则按模板从上到下、从左到右扫描，按 token 首次出现顺序确定 group 顺序；
3. 固定数字同样按顺序分组；
4. 空格不生成 group。

因此：

- `groupOrder` 省略时，苦力怕依次生成 `#` 高数字区域和 `.` 低数字区域；
- 套圈若省略 `groupOrder`，则依次生成 `a` 外圈、`b` 中圈、`c` 内圈；若设置 `groupOrder: ["c", "b", "a"]`，则从内到外播放。

`groupOrder` 的完整规范见 [JSON 规范](json-schema.md)。

### 数字包含/不包含

对于 `requiredDigits`，每个要求数字生成一个 group，并按配置顺序排列。每个 group 包含该数字在棋盘中的全部位置：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        allDigit4Indices,
        allDigit5Indices,
      ],
    },
  ],
}
```

对于只有 `forbiddenDigits` 的规则，命中时不存在被禁止数字可供高亮，因此返回一个整板 group：

```ts
{
  coefficient: 1,
  matches: [
    { groups: [wholeBoardGroup(grid)] },
  ],
}
```

同时存在 required 和 forbidden 时，required 数字负责生成 groups，forbidden 数字只参与判定。

### 贪吃蛇

搜索得到从 0 到 9 的路径后，每个位置生成一个单格 group：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        [12], // 0
        [13], // 1
        [19], // 2
        [20], // 3
        // ...
      ],
    },
  ],
}
```

前端按顺序播放即形成路径动画，合并所有 groups 则显示完整路径。

如果规则只要求存在一条路径，可以只返回按确定搜索顺序找到的第一条路径。

### Crosshair

对于中心索引为 7 的十字，可按“先四周、后中心”的顺序返回：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        [1, 6, 8, 13],
        [7],
      ],
    },
  ],
}
```

前端既可以逐组闪烁，也可以给两组分配不同颜色。

### 主副对角线对应

每对对应格形成一个 group：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        [0, 5],
        [7, 10],
        [14, 15],
        [20, 21],
        [25, 28],
        [30, 35],
      ],
    },
  ],
}
```

前端可逐对播放，也可同时使用不同颜色显示。

### 六皇后

每个构成六皇后的数字产生一个独立命中，其中只有一个包含六个皇后位置的 group：

```ts
{
  coefficient: 1,
  matches: [
    { groups: [[/* 六个皇后索引 */]] },
  ],
}
```

如果多个数字分别构成合法解，则产生多个 `MatchEvidence`。计分是否随解数量变化仍由规则定义决定。

### 围棋

每个被提连通块产生一个独立命中，并包含两个 group：

```ts
{
  coefficient: capturedStoneCount,
  matches: [
    {
      groups: [
        firstCapturedIndices,
        firstSurroundingIndices,
      ],
    },
    {
      groups: [
        secondCapturedIndices,
        secondSurroundingIndices,
      ],
    },
  ],
}
```

顺序固定为：

1. 被提棋子；
2. 与该棋块正交相邻的包围棋子。

### 俄罗斯方块

每个识别出的四格块产生一个独立命中：

```ts
{
  coefficient: 2 ** (shapeCount - 1),
  matches: [
    { groups: [[/* 第一个四格块 */]] },
    { groups: [[/* 第二个四格块 */]] },
  ],
}
```

### E 与 Ǝ

每个识别出的 E 形结构产生一个独立命中。当前可使用一个 group 包含竖条和三条横叉：

```ts
{
  coefficient: 1,
  matches: [
    { groups: [[/* E 的全部格子 */]] },
  ],
}
```

如果以后需要分步展示，可以在不改变顶层接口的情况下拆成：

```ts
{
  groups: [
    spineIndices,
    topArmIndices,
    middleArmIndices,
    bottomArmIndices,
  ],
}
```

具体分组方式一旦实现，应在规则实现文档中固定。

### 对称规则

对称规则将互相对应的位置组成有序 group。

旋转 90°时，每个 group 可以包含同一旋转轨道中的最多四个格子：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        firstOrbitIndices,
        secondOrbitIndices,
        // ...
      ],
    },
  ],
}
```

水平或垂直反射通常每个 group 包含一对对应格。前端可以逐轨道播放，也可以同时分色显示。

### 中心与外围

内强外弱、外强中干和苹果皮可返回两个 group：

```ts
{
  coefficient: 1,
  matches: [
    { groups: [center4x4Indices, outerBorderIndices] },
  ],
}
```

### 四象限

四和院可以返回四个 3×3 象限 group：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        topLeftIndices,
        topRightIndices,
        bottomLeftIndices,
        bottomRightIndices,
      ],
    },
  ],
}
```

### 套圈

Pattern matcher 根据符号首次出现顺序自动产生三个 group：

```ts
{
  coefficient: 1,
  matches: [
    {
      groups: [
        outerRingIndices,
        middleRingIndices,
        innerRingIndices,
      ],
    },
  ],
}
```

### 整板判定

无法由局部证据自然表达的规则使用一个整板 group，例如：

- 行列式为 0；
- 总和为 162；
- 高效压缩；
- 所有 2×2 区域和为偶数；
- 数独；
- 音韵和谐。

```ts
{
  coefficient: 1,
  matches: [
    { groups: [wholeBoardGroup(grid)] },
  ],
}
```

如果某条整板规则有更适合展示的内部结构，之后可以细分 groups，而不改变结果接口。

## 为什么暂不增加 Group 名称

当前设计不为 group 增加 `role` 或名称：

```ts
interface MatchEvidence {
  groups: CellIndex[][]
}
```

原因是：

- 前端可以按数组索引分配颜色或播放顺序；
- 当前需求可完全由稳定顺序表达；
- 避免匹配逻辑携带颜色或动画领域概念；
- 接口简单，测试和序列化都更直接。

代价是前端需要知道某条规则各 group 索引的含义。例如围棋约定第 0 组为被提棋子，第 1 组为包围棋子。

因此，每个具有多组语义的 matcher 必须在文档中固定顺序。只有未来出现无法通过稳定顺序维护的场景时，再考虑增加可选元数据。

## 迁移方案

当前所有 matcher 返回 `number`。建议一次性迁移，避免长期维护两套接口。

### 第一阶段：基础类型与工具

新增：

```ts
type CellIndex = number
type ActivationGroup = CellIndex[]

interface MatchEvidence {
  groups: ActivationGroup[]
}

interface RuleMatchResult {
  coefficient: number
  matches: MatchEvidence[]
}
```

以及：

- 坐标与索引转换；
- 整板 group；
- group 合并；
- 匹配结果构造函数；
- 开发模式下的索引范围和重复值校验。

### 第二阶段：Pattern matcher

Pattern matcher 是稀疏激活数据的主要基础，应先完成：

- 保存每个候选位置中各模板符号对应的索引；
- 每个符号生成一个 group；
- 多候选位置生成多个 `MatchEvidence`；
- coefficient 继续根据总匹配次数计算；
- `allowOverlap: false` 继续只保留实际计分的匹配。

### 第三阶段：其他 matcher

依次迁移：

1. `digit-constraints`；
2. 对称与区域 matcher；
3. 连通块与形状 matcher；
4. 路径和对应关系 matcher；
5. 整板 matcher。

### 第四阶段：计分与测试

计分入口改为：

```ts
const result = matcher(grid, rule.params)
const score = result.coefficient * rule.baseScore
```

每个 matcher 的测试同时验证：

- `coefficient`；
- `matches.length`；
- 每次命中的 group 数量；
- group 包含的具体索引；
- 未命中时 `matches` 为空；
- 索引都在合法范围内；
- 单个 group 内没有重复索引；
- 相同输入的顺序稳定。

## 总结

匹配结果统一为：

```ts
{
  coefficient: number,
  matches: Array<{
    groups: number[][],
  }>,
}
```

该接口只表达：

- 计分系数；
- 独立命中；
- 每次命中中有序的格子组。

前端自主决定：

- 多个 group 使用不同颜色同时显示；
- 按 group 顺序逐个播放；
- 累积、合并或循环显示；
- 针对特定规则使用专用视觉效果。

因此，无需为路径、配对、颜色或动画分别增加匹配接口。所有格子级展示信息都可以由有序的稀疏索引分组统一表达。
