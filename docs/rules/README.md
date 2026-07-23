# 规则系统设计

## 背景

RNG²dle 是一个以静态网页为主的 Vue 应用。玩家每天生成一个 $6 \times 6$ 的数字矩阵，应用根据内置规则匹配矩阵并计算分数。

在暂不实现用户注册、分数上传和后台管理的情况下，项目不需要引入数据库服务。规则随前端代码一起构建和发布即可。

## 设计目标

规则系统需要满足以下需求：

- 规则的展示信息可以序列化；
- 同一份规则定义可以用于界面展示和分数计算；
- 简单规则与复杂规则采用一致的调用方式；
- 规则元数据与具体匹配算法相互分离；
- 将来接入 JSON、数据库或后台管理时，不必重写匹配算法。

## 规则的组成

一条规则由两部分组成：

1. **规则定义**：可以序列化的元数据；
2. **匹配函数**：判断矩阵是否符合规则的代码。

### 规则定义

建议用统一的 `RuleDefinition` 类型表示规则元数据：

```ts
interface RuleDefinition {
  id: string
  label: string
  name: {
    zh: string
    en: string
  }
  description: {
    zh: string
    en: string
  }
  baseScore: number
  matcherKey: string
  params?: unknown
}
```

字段含义：

| 字段                                | 含义                                                |
| ----------------------------------- | --------------------------------------------------- |
| `id`                                | 规则的稳定身份标识，不应随展示名称变化              |
| `label`                             | 规则的唯一标识，供界面和代码引用，应保持稳定        |
| `name.zh` / `name.en`               | 中英文名称                                          |
| `description.zh` / `description.en` | 中英文描述                                          |
| `baseScore`                         | 规则的基础分数                                      |
| `matcherKey`                        | 匹配算法类型的键，多个规则可以共享同一个算法        |
| `params`                            | 可选，传递给匹配函数的参数，类型由`matcherKey` 决定 |

`matcherKey` 与 `label` 的职责不同：`matcherKey` 标识**算法类型**，数量少且稳定；`label` 标识**具体规则**，每个规则唯一。多条规则可以共享同一个 `matcherKey` 但使用不同的 `params`。

示例——参数化规则：

```ts
const cage: RuleDefinition = {
  id: 'rule-002',
  label: 'cage',
  name: { zh: '笼中鸟', en: 'Cage' },
  description: { zh: '外围数字相同，中心不同', en: 'Outer ring identical, center different.' },
  baseScore: 200,
  matcherKey: 'pattern-matcher',
  params: {
    pattern: ["###", "#*#", "###"],
    coefficient: { type: 'constant', value: 1 },
  },
}

const cross: RuleDefinition = {
  id: 'rule-003',
  label: 'cross',
  name: { zh: '十字', en: 'Cross' },
  description: { zh: '一个数字的上下左右是相等的不同数字', en: 'A digit surrounded by four equal digits.' },
  baseScore: 150,
  matcherKey: 'pattern-matcher',
  params: {
    pattern: [" # ", "#*#", " # "],
    coefficient: { type: 'constant', value: 1 },
  },
}
```

示例——纯算法规则（不需要 `params`）：

```ts
const sixQueens: RuleDefinition = {
  id: 'rule-001',
  label: 'six-queens',
  name: { zh: '六皇后', en: 'Six Queens' },
  description: {
    zh: '棋盘中的某个数字满足六皇后问题的排布',
    en: 'One digit on the board forms a solution to the six queens puzzle.',
  },
  baseScore: 100,
  matcherKey: 'six-queens',
}
```

`id` 与 `label` 都应稳定，但职责不同：`id` 表示身份，`label` 供人阅读并用于界面或代码引用。不要将名称、描述等可能变化的展示内容作为身份标识。

### 匹配函数

函数无法可靠地序列化为 JSON，而且部分规则可能包含复杂算法，因此匹配实现应保留在 TypeScript 代码中。

所有匹配函数返回匹配系数（`number`），**最终分数 = 匹配系数 × `baseScore`**：

- 系数为 `0` 表示未命中；
- 系数为正整数表示命中次数或倍数；
- 系数也可以用于实现更复杂的计分逻辑（如匹配位置加权）。

匹配函数接口：

```ts
type Grid = number[][]

type RuleMatcher = (grid: Grid, params?: unknown) => number
```

## 匹配函数注册表

注册表按 `matcherKey` 组织，每个算法类型对应一个匹配函数：

```ts
const matchers: Record<string, RuleMatcher> = {
  'pattern-matcher': matchByPattern,
  'six-queens':      matchSixQueens,
  'all-same':        matchAllSame,
}
```

计算时根据 `matcherKey` 定位函数，并传入 `params`：

```ts
function scoreRule(rule: RuleDefinition, grid: Grid): number {
  const matcher = matchers[rule.matcherKey]

  if (!matcher) {
    throw new Error(`Unknown matcher key: ${rule.matcherKey}`)
  }

  const coefficient = matcher(grid, rule.params)
  return coefficient * rule.baseScore
}
```

### 参数化匹配器

参数化匹配器用 `params` 区分不同规则，不需要重复注册函数。例如：

- `pattern-matcher` 使用 JSON 描述任意尺寸的矩形模板，并支持符号约束、多次匹配和系数策略；
- `digit-constraints` 检查矩阵必须包含或不能包含的数字。

新增一条采用现有算法的规则时，只需在 JSON 中增加规则定义及对应参数，不需要修改注册表。各匹配器完整的参数结构、默认值、校验规则和示例见 [规则 JSON 规范](json-schema.md)。

### 纯算法匹配器

自定义算法不需要 `params`，直接注册函数引用：

```ts
function matchSixQueens(grid: Grid): number {
  // 未命中返回 0，命中返回对应系数
}

function matchAllSame(grid: Grid): number {
  // 未命中返回 0，命中返回对应系数
}
```

新增一种算法类型只需要写一个函数并在注册表加一行，**不需要改现有规则定义**。

### 注册表的好处

- 规则定义不需要引用或包含函数，可序列化；
- 简单规则与复杂规则采用一致的调用方式；
- 文件重构不会改变已保存的规则定义；
- 将来从 JSON 或数据库加载规则时，仍可通过 `matcherKey` 复用同一套匹配代码；
- `params` 只存在于参数化规则，纯算法规则不需要这个字段。

## 数据来源

### 当前方案：JSON 作为唯一数据源

规则定义使用 JSON 文件保存，随静态网页构建和发布。JSON 是规则数据的唯一来源，TypeScript 不再复制维护一份规则列表。

```json
[
  {
    "id": "rule-001",
    "label": "all-same",
    "name": { "zh": "全部相同", "en": "All Same" },
    "description": { "zh": "矩阵中的数字全部相同", "en": "All digits in the matrix are identical." },
    "baseScore": 100,
    "matcherKey": "all-same"
  },
  {
    "id": "rule-002",
    "label": "cage",
    "name": { "zh": "笼中鸟", "en": "Cage" },
    "description": { "zh": "外围数字相同，中心不同", "en": "Outer ring identical, center different." },
    "baseScore": 200,
    "matcherKey": "pattern-matcher",
    "params": {
      "pattern": ["###", "#*#", "###"],
      "coefficient": { "type": "constant", "value": 1 }
    }
  }
]
```

保留 JSON 的原因：

- 规则参数（如 `pattern`、`symbolValues`）本身已经是 JSON 结构，用 TypeScript 额外包装一层没有意义；
- 规则定义与匹配函数自然分离，降低耦合；
- 在开发过程中可以更容易地增加或修改规则参数，而不需要调整 TypeScript 类型；
- 未来有后台编辑规则的场景时，JSON 可以直接写入数据库。

规则的完整 JSON 字段、Pattern 参数和测试样例格式见 [规则 JSON 规范](json-schema.md)。生产规则 JSON 不包含测试样例；测试数据独立保存，并通过规则 `id` 引用规则。

### 加载与校验

JSON 文件在加载时需要进行运行时校验，确保其符合 `RuleDefinition` 类型约束：

- `id` 和 `label` 不重复；
- 每个 `matcherKey` 在注册表中可以找到对应的匹配函数；
- 每条规则的 `params` 格式符合对应 `matcherKey` 的预期类型；
- `baseScore` 在合法范围内，中英文名称和描述完整。

### 何时使用数据库

只有在出现服务端状态或动态管理需求时，数据库才有明显价值，例如：

- 用户注册和登录；
- 上传、保存或排行玩家分数；
- 后台动态新增、停用规则或调整分数；
- 不重新发布网页即可修改规则；
- 记录规则版本或修改历史。

接入数据库后，数据库只负责规则定义的持久化，匹配算法仍由代码和注册表提供。数据库表可以映射为：

| 列               | 对应字段                   |
| ---------------- | -------------------------- |
| `id`             | `id`                       |
| `label`          | `label`                    |
| `name_zh`        | `name.zh`                  |
| `name_en`        | `name.en`                  |
| `description_zh` | `description.zh`           |
| `description_en` | `description.en`           |
| `base_score`     | `baseScore`                |
| `matcher_key`    | `matcherKey`               |
| `params`         | `params`，以 JSON 类型存储 |

无论采用 JSON 还是数据库，都应该确定一个唯一数据源，避免手工维护内容相同的两份规则数据。

## 推荐目录结构

```text
src/
├── game/
│   └── rules/
│       ├── rules.json
│       ├── types.ts
│       ├── loadRules.ts
│       ├── registry.ts
│       └── matchers/
│           ├── matchByPattern.ts
│           ├── matchSixQueens.ts
│           └── matchAllSame.ts
└── ...
```

各文件职责：

- `rules.json`：规则定义及其参数，是规则数据的唯一来源；
- `types.ts`：规则、矩阵、匹配参数和系数策略等公共类型；
- `loadRules.ts`：读取并校验 JSON，返回可供应用使用的 `RuleDefinition[]`；
- `registry.ts`：`matcherKey` 到匹配函数的映射；
- `matchers/`：具体匹配算法，复杂规则可以各自使用独立文件。

如果简单规则数量很多，可以按规则类别组织文件，而不必强制每条规则对应一个文件。目录划分应以可读性和可测试性为准。

## 分数计算

匹配与计分应保持概念上的分离：

1. 匹配函数根据矩阵和参数返回非负整数系数；
2. 未命中时系数为 `0`，命中一次时通常为 `1`，允许多次匹配的规则可以返回匹配次数或由匹配次数计算出的系数；
3. 计分逻辑使用 `coefficient × baseScore` 计算该规则的最终分数；
4. 展示层只消费规则定义、系数与最终分数，不直接实现匹配算法。

```ts
const coefficient = matcher(grid, rule.params)
const score = coefficient * rule.baseScore
```

匹配函数不应直接读取 `baseScore`，这样同一个匹配算法和参数可以独立于计分配置进行测试和复用。

## 校验与测试

规则系统至少应校验：

- `id` 不重复；
- `label` 不重复；
- 每个规则的 `matcherKey` 都能在注册表中找到对应的匹配函数；
- 每种 `matcherKey` 的 `params` 都通过运行时校验；
- `baseScore` 是允许范围内的数值；
- 中英文名称和描述完整；
- 每个匹配函数包含命中和不命中的测试用例；
- 复杂规则包含边界情况测试。

可以在开发模式或测试中遍历规则列表，提前发现定义与注册表不一致的问题。

## 设计原则总结

- 当前项目使用 JSON 作为规则数据的唯一来源，不引入数据库；
- 数据与行为分离：规则定义可序列化，匹配函数保留在代码中，通过 `matcherKey` 关联；
- 参数化规则与纯算法规则统一使用相同的定义接口，`params` 只存在于参数化规则；
- 使用一个唯一数据源，不同时手工维护 JSON 和数据库；
- 匹配、计分和界面展示分层；
- 为未来的 JSON 或数据库适配保留清晰边界，但不提前实现暂时用不到的基础设施。
