# 规则 JSON 规范

本文档定义规则数据、参数化匹配器和测试样例的具体 JSON 格式。规则系统的总体设计见 [README.md](README.md)。

## 文件职责

规则数据和测试数据分开保存：

```text
src/game/rules/rules.json        # 生产规则数据，随应用构建
tests/fixtures/rules.json        # 测试样例，不属于规则定义
tests/rules.test.ts              # 读取样例并执行匹配器
```

`rules.json` 是生产规则数据的唯一来源，不包含测试样例。测试样例通过 `ruleId` 引用规则，因此不会增加生产资源体积，也不会把测试职责混入规则定义。

## 规则文件

`rules.json` 的顶层是规则数组：

```json
[
  {
    "id": "rule-002",
    "label": "cage",
    "name": {
      "zh": "笼中鸟",
      "en": "Cage"
    },
    "description": {
      "zh": "外围数字相同，中心不同",
      "en": "Outer ring identical, center different."
    },
    "baseScore": 200,
    "matcherKey": "pattern-matcher",
    "params": {
      "pattern": [
        "###",
        "#*#",
        "###"
      ],
      "coefficient": {
        "type": "constant",
        "value": 1
      }
    }
  }
]
```

### 公共字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 稳定且唯一的数据身份 |
| `label` | `string` | 是 | 稳定且唯一的语义标识 |
| `name.zh` | `string` | 是 | 中文名称 |
| `name.en` | `string` | 是 | 英文名称 |
| `description.zh` | `string` | 是 | 中文描述 |
| `description.en` | `string` | 是 | 英文描述 |
| `baseScore` | `number` | 是 | 非负基础分数 |
| `matcherKey` | `string` | 是 | 注册表中的匹配算法键 |
| `params` | `object` | 否 | 匹配器参数，结构由 `matcherKey` 决定 |

`id`、`label` 和 `matcherKey` 的职责不同：

- `id` 标识一条规则的数据身份；
- `label` 标识具体规则的语义；
- `matcherKey` 标识匹配算法，多条规则可以共享同一个算法。

## Pattern 匹配参数

当 `matcherKey` 为 `pattern-matcher` 时，`params` 使用以下结构：

```ts
interface PatternParams {
  pattern: string[]
  symbolValues?: Record<string, number[]>
  allowSameWith?: Record<string, string[]>
  groupOrder?: string[]
  multiple?: boolean
  allowOverlap?: boolean
  coefficient?: CoefficientConfig
}
```

### `pattern`

`pattern` 是由等长字符串组成的非空数组：

- 数组长度为模板高度；
- 每个字符串的字符数为模板宽度；
- 模板可以是任意矩形尺寸，但不能大于待匹配矩阵；
- 字符按单个 Unicode code point 解释，建议符号使用单字符 ASCII，避免视觉和长度歧义。

每个字符的语义：

| 字符 | 语义 |
| --- | --- |
| 空格 ` ` | 任意数字，不参与符号约束 |
| `0`–`9` | 固定数字，位置上的数字必须与之相等 |
| 其他字符 | 符号变量 |

同一个符号在整个 pattern 中必须绑定同一个数字。默认情况下，不同符号必须绑定不同数字。

### `symbolValues`

`symbolValues` 分别限制各符号允许绑定的数字：

```json
{
  "symbolValues": {
    "#": [1, 2, 3],
    "*": [0, 4, 5],
    "@": [6, 7, 8, 9]
  }
}
```

约束如下：

- 键必须是 `pattern` 中出现的单个符号；
- 数组元素必须是 `0`–`9` 的整数；
- 数字使用 JSON number，不使用字符串；
- 未配置的符号默认允许绑定任意 `0`–`9`；
- 各符号的候选集合可以重叠，但默认仍不能实际绑定同一个数字；
- 空数组表示该符号没有合法取值，因此规则不会匹配。

### `allowSameWith`

`allowSameWith` 声明不同符号之间允许绑定相同数字：

```json
{
  "symbolValues": {
    "#": [1, 2, 3],
    "*": [2, 3, 4]
  },
  "allowSameWith": {
    "#": ["*"]
  }
}
```

以上配置允许 `#` 与 `*` 同时绑定 `2` 或同时绑定 `3`。它不会使 `#` 可以绑定 `4`，也不会使 `*` 可以绑定 `1`；每个符号仍然受到自身 `symbolValues` 的限制。

相等许可具有以下性质：

- **无向**：声明 `"#": ["*"]` 即同时允许 `# = *` 和 `* = #`，无需反向重复；
- **不传递**：允许 `# = *` 且允许 `* = @`，不代表允许 `# = @`；
- 键和值都必须是 `pattern` 中实际出现的符号；
- 符号不能引用自身，重复关系应在加载时去重。

相等关系必须无向，是因为数学相等具有对称性。如果只允许 `A → B`，但从 `B` 的约束看仍要求 `B ≠ A`，那么 `A = B` 无法满足全部约束，单向许可最终等价于没有许可。

### 多次匹配

`multiple` 决定是否统计所有候选位置：

- 省略或设为 `false`：找到第一个匹配后停止；
- 设为 `true`：扫描所有候选起点并统计匹配次数。

候选起点按从上到下、从左到右的顺序扫描。

### 重叠匹配

`allowOverlap` 只在 `multiple: true` 时有意义：

- 省略或设为 `true`：每个合法起点都计为一次，允许匹配区域重叠；
- 设为 `false`：已计数的匹配区域不能与后续匹配区域共享单元格，按扫描顺序贪心选取。

显式规定扫描顺序可以避免非重叠匹配结果因实现方式不同而变化。

### Group 顺序

`groupOrder` 控制模板中非空格 token 在匹配结果中的分组顺序，只影响前端展示，不影响匹配语义。

默认情况下，group 按 token 在模板中**从上到下、从左到右首次出现**的顺序排列。省略 `groupOrder` 时采用此默认行为。

```json
{
  "pattern": [
    "###",
    "#*#",
    "###"
  ],
  "groupOrder": ["*", "#"]
}
```

以上配置使 `*` 中心格在 `#` 外围格之前出现，前端可先高亮中心，再高亮外围。

`groupOrder` 的校验规则：

- 必须是非空字符串数组；
- 每项必须是单个 Unicode code point；
- 不能包含空格，不能重复；
- 每项必须实际出现在 `pattern` 中；
- `pattern` 中每个非空格唯一 token 必须恰好出现一次；
- 固定数字（`0`–`9`）和符号变量都可以出现在 `groupOrder` 中；
- 空格不参与 `groupOrder`。

例如套圈模板若希望从内圈向外圈播放：

```json
{
  "pattern": [
    "aaaaaa",
    "abbbba",
    "abccba",
    "abccba",
    "abbbba",
    "aaaaaa"
  ],
  "groupOrder": ["c", "b", "a"]
}
```

若省略 `groupOrder`，则按 `a`、`b`、`c` 的首次出现顺序排列，即外圈、中圈、内圈。

`groupOrder` 对所有候选位置采用相同的分组顺序，不影响外层匹配的排列顺序。

### 系数策略

匹配器先计算匹配次数 `x`，再由 `coefficient` 将 `x` 转换为非负整数系数。最终分数为：

```text
最终分数 = 系数 × baseScore
```

所有函数型策略采用统一的零匹配语义：

```text
x = 0 时，系数固定为 0
x > 0 时，系数为 f(x)
```

因此，规则未匹配时永远不会因为函数的常数项或指数函数的初值而获得分数。

`coefficient` 支持以下可序列化策略：

```ts
type CoefficientConfig =
  | { type: 'constant'; value: number }
  | { type: 'match-count' }
  | { type: 'match-count-table'; values: number[] }
  | { type: 'polynomial'; coefficients: number[] }
  | {
      type: 'exponential'
      base: number
      scale?: number
      offset?: number
    }
  | {
      type: 'power'
      exponent: number
      scale?: number
      offset?: number
    }
```

省略 `coefficient` 时等价于：

```json
{ "type": "constant", "value": 1 }
```

#### 固定系数

```json
{
  "type": "constant",
  "value": 2
}
```

只要至少匹配一次就返回系数 `2`，完全未匹配时返回 `0`。

#### 匹配次数

```json
{
  "type": "match-count"
}
```

直接返回匹配次数，即 `f(x) = x`。

#### 有限表

```json
{
  "type": "match-count-table",
  "values": [0, 1, 3, 6, 10]
}
```

数组下标为匹配次数，数组值为系数，即 `values[x] = f(x)`。上例表示匹配 0、1、2、3、4 次时，系数分别为 0、1、3、6、10。

有限表必须覆盖该模板可能返回的完整匹配次数范围，不使用隐式越界行为。对于高度为 `H`、宽度为 `W` 的矩阵和高度为 `h`、宽度为 `w` 的模板，允许重叠时最大候选位置数为：

```text
(H - h + 1) × (W - w + 1)
```

加载器应根据矩阵和模板尺寸验证 `values` 长度。即使某些次数受符号约束影响实际上无法出现，仍可使用候选位置数作为保守上限，保证查表永不越界。

#### 多项式函数

```json
{
  "type": "polynomial",
  "coefficients": [0, 1, 2]
}
```

`coefficients` 按次数从低到高排列，上例表示：

```text
f(x) = 0 + 1x + 2x²
```

一般形式为：

```text
f(x) = c₀ + c₁x + c₂x² + … + cₙxⁿ
```

#### 指数函数

```json
{
  "type": "exponential",
  "base": 2,
  "scale": 3,
  "offset": 1
}
```

表示：

```text
f(x) = 3 × 2ˣ + 1
```

`scale` 默认为 `1`，`offset` 默认为 `0`。由于采用统一的零匹配语义，上例在 `x = 0` 时仍返回 `0`，而不是 `4`。

#### 幂函数

```json
{
  "type": "power",
  "exponent": 3,
  "scale": 2,
  "offset": 1
}
```

表示：

```text
f(x) = 2x³ + 1
```

`scale` 默认为 `1`，`offset` 默认为 `0`。幂函数也可以表示为多项式，但独立类型能让常见的平方、立方增长更容易阅读。

#### 校验规则

加载器应计算该模板可能产生的匹配次数范围，并穷举验证所有策略结果：

- 所有参数必须是有限的 JSON number；
- `constant.value` 必须是非负整数；
- `match-count-table.values` 必须覆盖完整匹配次数范围，且 `values[0]` 必须为 `0`；
- `polynomial.coefficients` 必须是非空整数数组；
- `exponential.base` 必须是非负整数；
- `power.exponent` 必须是非负整数；
- `scale` 和 `offset` 必须是整数；
- 对每个可能的正匹配次数，计算结果必须是非负安全整数；
- 计算结果不得超过 `Number.MAX_SAFE_INTEGER`。

多项式系数、`scale` 或 `offset` 可以为负数，只要该规则在完整匹配次数范围内的最终结果始终为非负整数。

JSON 不保存函数源码，也不提供按键注册特殊系数函数的机制。如果所需逻辑无法表示为有限表、多项式、指数函数或幂函数，应实现专用匹配函数并使用独立的 `matcherKey`，而不是继续扩展模板匹配器。

## 数字集合约束匹配参数

当 `matcherKey` 为 `digit-constraints` 时，匹配器检查整个矩阵是否包含或不包含指定数字：

```ts
interface DigitConstraintsParams {
  requiredDigits?: number[]
  forbiddenDigits?: number[]
}
```

两个字段都是可选的，因为规则可以只限制必须包含的数字，或只限制必须不包含的数字。但是 `params` 中至少要提供一个非空字段，否则该匹配器没有实际约束。

### `requiredDigits`

`requiredDigits` 列出矩阵中必须出现的数字：

```json
{
  "requiredDigits": [1, 2, 3]
}
```

以上配置要求 `1`、`2`、`3` **每个都至少出现一次**。只出现其中一部分不能匹配。

数组在语义上是集合，不通过重复元素表达出现次数。例如 `[1, 1, 2]` 是非法配置，而不是要求 `1` 出现两次。如果将来需要限制出现次数，应设计独立的计数参数，避免改变本字段的集合语义。

### `forbiddenDigits`

`forbiddenDigits` 列出矩阵中不能出现的数字：

```json
{
  "forbiddenDigits": [0, 9]
}
```

只要矩阵中出现任何一个被禁止的数字，规则就不匹配。

### 同时使用

两个字段可以同时使用：

```json
{
  "id": "rule-004",
  "label": "middle-digits-only",
  "name": {
    "zh": "中间数字",
    "en": "Middle Digits"
  },
  "description": {
    "zh": "必须包含 4 和 5，且不能包含 0 和 9",
    "en": "Must contain 4 and 5, and must not contain 0 or 9."
  },
  "baseScore": 100,
  "matcherKey": "digit-constraints",
  "params": {
    "requiredDigits": [4, 5],
    "forbiddenDigits": [0, 9]
  }
}
```

匹配器按以下顺序理解约束：

1. `requiredDigits` 中的每个数字都必须至少出现一次；
2. `forbiddenDigits` 中的每个数字都必须完全不出现；
3. 两项约束同时满足时返回系数 `1`，否则返回 `0`。

因为该匹配器只判断整个矩阵是否满足一组约束，不存在多个候选位置，因此不使用 `multiple`、`allowOverlap` 或 Pattern 的系数策略。

### 校验规则

加载器应检查：

- `requiredDigits` 和 `forbiddenDigits` 至少有一个存在且非空；
- 提供的数组必须为非空数组；
- 每个元素都是 `0`–`9` 的整数，使用 JSON number；
- 同一数组中不能有重复数字；
- 同一个数字不能同时出现在 `requiredDigits` 与 `forbiddenDigits` 中；
- 不接受这两个字段之外的未知参数。

如果同一个数字同时为“必须包含”和“禁止包含”，规则永远无法命中，因此应在加载阶段将其视为配置错误，而不是保留一条永远返回 `0` 的规则。

## 测试样例文件

测试样例独立存放在 `tests/fixtures/rules.json`，顶层是按规则组织的数组：

```json
[
  {
    "ruleId": "rule-002",
    "cases": [
      {
        "name": "外围相同且中心不同",
        "grid": [
          [1, 1, 1, 0, 0, 0],
          [1, 2, 1, 0, 0, 0],
          [1, 1, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0]
        ],
        "expectedCoefficient": 1
      },
      {
        "name": "中心与外围相同",
        "grid": [
          [1, 1, 1, 0, 0, 0],
          [1, 1, 1, 0, 0, 0],
          [1, 1, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0]
        ],
        "expectedCoefficient": 0
      }
    ]
  }
]
```

### 测试字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ruleId` | `string` | 对应 `rules.json` 中的规则 `id` |
| `cases` | `array` | 该规则的测试用例 |
| `cases[].name` | `string` | 用例名称，说明验证意图 |
| `cases[].grid` | `number[][]` | 输入矩阵 |
| `cases[].expectedCoefficient` | `number` | 预期匹配系数，而不是最终分数 |

使用 `expectedCoefficient` 而不是简单的 `match` / `reject`，是因为规则可能返回大于 `1` 的系数。`0` 自然表示拒绝，正整数同时验证命中与计数逻辑。

测试运行器应：

1. 加载并校验 `rules.json`；
2. 通过 `ruleId` 找到规则；
3. 通过 `matcherKey` 找到匹配函数；
4. 使用规则自身的 `params` 执行样例矩阵；
5. 比较实际系数与 `expectedCoefficient`；
6. 另行验证最终分数等于 `expectedCoefficient × baseScore`。

参考项目将 `tests.match` 和 `tests.reject` 放在每条规则内部，这对一维布尔匹配很直观。本项目的输入是二维矩阵，而且匹配结果是系数，因此采用独立测试文件和 `expectedCoefficient` 更合适。

## 校验要求

加载器至少应拒绝以下数据：

- 重复或空的 `id`、`label`；
- 注册表中不存在的 `matcherKey`；
- 缺少中英文名称或描述；
- 非法的 `baseScore`；
- 空 pattern、非矩形 pattern 或超过矩阵尺寸的 pattern；
- `symbolValues` 中不存在于 pattern 的符号或 `0`–`9` 之外的值；
- `allowSameWith` 中不存在于 pattern 的符号、自引用或无效值；
- `digit-constraints` 缺少有效约束、包含重复或越界数字，或要求与禁止集合相交；
- 非法的系数策略或负系数；
- 测试文件中不存在的 `ruleId`、非法矩阵或负的 `expectedCoefficient`。
