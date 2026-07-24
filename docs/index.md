# RNG²dle 规则系统文档

## 设计概览

- [规则系统设计](rules/README.md) — 规则定义、匹配函数注册表、数据来源与分层设计

## 格式规范

- [规则 JSON 规范](rules/json-schema.md) — 规则数据、模板匹配参数、数字约束参数、系数策略和测试样例的完整 JSON 格式

## 规则实现

- [全部规则实现说明](rules/rule-implementations.md) — 当前 72 条规则的算法、模板和参数
- [规则算法实现约定](rules/pending-rules.md) — 存在歧义时采用的实现解释

## 匹配结果

- [规则匹配结果与稀疏激活索引设计](rules/match-result.md) — 匹配函数返回结构化的有序格子分组，支持前端高亮、多色显示和逐帧动画