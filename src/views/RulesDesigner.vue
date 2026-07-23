<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

/* ── types ── */
interface RuleRow {
  id: string
  label: string
  nameCn: string
  nameEn: string
  descCn: string
  descEn: string
  baseScore: number
  matcherKey: string
  params: string
}

/* ── state ── */
const rules = ref<RuleRow[]>([])
const editingIndex = ref(-1) // -1 = new
const form = ref<RuleRow>(blankForm())

function blankForm(): RuleRow {
  return {
    id: '',
    label: '',
    nameCn: '',
    nameEn: '',
    descCn: '',
    descEn: '',
    baseScore: 100,
    matcherKey: 'pattern-matcher',
    params: '{}',
  }
}

/* ── CSV columns ── */
const CSV_COLUMNS = [
  'id', 'label', 'name.cn', 'name.en',
  'description.cn', 'description.en',
  'baseScore', 'matcherKey', 'params',
] as const
const COL_SEP = '\t'

/* ── text / CSV helpers ── */
function decodeRulesText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gb18030').decode(buffer)
  }
}

function parseDelimitedLine(line: string, separator: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const character = line[index]!
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (character === separator && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

function parseCsv(text: string): RuleRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if (lines.length < 2) return []

  return lines.slice(1).flatMap((line) => {
    const cols = parseDelimitedLine(line, COL_SEP)
    if (cols.every((value) => value.trim() === '')) return []

    return [{
      id: cols[0] ?? '',
      label: cols[1] ?? '',
      nameCn: cols[2] ?? '',
      nameEn: cols[3] ?? '',
      descCn: cols[4] ?? '',
      descEn: cols[5] ?? '',
      baseScore: Number(cols[6]) || 0,
      matcherKey: cols[7] ?? '',
      params: cols[8] ?? '{}',
    }]
  })
}

function rowValues(r: RuleRow): string[] {
  return [
    r.id, r.label, r.nameCn, r.nameEn,
    r.descCn, r.descEn, String(r.baseScore),
    r.matcherKey, r.params,
  ]
}

function toClipboardRow(r: RuleRow): string {
  return rowValues(r).join('\t')
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function toCsvRow(r: RuleRow): string {
  return rowValues(r).map(escapeCsvField).join(',')
}

function generateCsv(): string {
  return CSV_COLUMNS.join(',') + '\r\n' + rules.value.map(toCsvRow).join('\r\n')
}

function downloadCsv() {
  const blob = new Blob(['﻿', generateCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rules.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/* ── load tab-separated source file ── */
async function loadCsv() {
  try {
    const resp = await fetch('/src/game/rules/rules.txt')
    if (!resp.ok) return
    rules.value = parseCsv(decodeRulesText(await resp.arrayBuffer()))
  } catch {
    // file not found — start empty
  }
}
onMounted(() => {
  loadCsv()
  resetPatternEditor()
})

/* ── form ── */
function startNew() {
  editingIndex.value = -1
  form.value = blankForm()
  resetPatternEditor()
  resetDigitEditor()
}

function startEdit(index: number) {
  const r = rules.value[index]
  if (!r) return
  editingIndex.value = index
  form.value = { ...r }
  // init editors from params JSON
  try {
    const p = JSON.parse(r.params)
    if (r.matcherKey === 'pattern-matcher' && p.pattern) {
      initFromPattern(p)
    } else if (r.matcherKey === 'digit-constraints') {
      initFromDigitConstraints(p)
    }
  } catch {
    // ignore malformed params
  }
}

function copyRow() {
  const row = { ...form.value, params: paramsJson.value }
  navigator.clipboard.writeText(toClipboardRow(row))
}

function saveForm() {
  const row = { ...form.value, params: paramsJson.value }
  if (editingIndex.value === -1) {
    rules.value.push(row)
  } else {
    rules.value[editingIndex.value] = row
  }
  editingIndex.value = -1
}

function deleteRule(index: number) {
  rules.value.splice(index, 1)
  if (editingIndex.value === index) editingIndex.value = -1
}

/* ── params JSON (computed from editors) ── */
const paramsJson = computed(() => {
  if (form.value.matcherKey === 'pattern-matcher') return buildPatternParams()
  if (form.value.matcherKey === 'digit-constraints') return buildDigitParams()
  try {
    return JSON.stringify(JSON.parse(form.value.params))
  } catch {
    return form.value.params.trim() || '{}'
  }
})

/* ══════════════ Pattern-matcher editor ══════════════ */
const pWidth = ref(3)
const pHeight = ref(3)
const pCells = ref<string[][]>([])

function resetPatternEditor() {
  pWidth.value = 3
  pHeight.value = 3
  resizeGrid()
}

function initFromPattern(p: { pattern?: string[]; symbolValues?: Record<string, number[]>; allowSameWith?: Record<string, string[]>; multiple?: boolean; allowOverlap?: boolean; coefficient?: Record<string, unknown> }) {
  if (p.pattern && p.pattern.length > 0) {
    pHeight.value = p.pattern.length
    pWidth.value = Array.from(p.pattern[0]!).length
    resizeGrid()
    for (let r = 0; r < p.pattern.length; r++) {
      const chars = Array.from(p.pattern[r]!)
      for (let c = 0; c < chars.length; c++) {
        if (pCells.value[r] && pCells.value[r][c] !== undefined) {
          pCells.value[r][c] = chars[c] === ' ' ? '' : chars[c]!
        }
      }
    }
  }
  // symbolValues
  pSymbolEntries.value = []
  if (p.symbolValues) {
    for (const [sym, digits] of Object.entries(p.symbolValues)) {
      pSymbolEntries.value.push({ symbol: sym, digits: digits.join(',') })
    }
  }
  // allowSameWith
  pSameWithEntries.value = []
  if (p.allowSameWith) {
    for (const [sym, others] of Object.entries(p.allowSameWith)) {
      pSameWithEntries.value.push({ symbol: sym, others: others.join(',') })
    }
  }
  // flags
  pMultiple.value = p.multiple ?? false
  pOverlap.value = p.allowOverlap ?? false
  // coefficient
  if (p.coefficient) {
    const c = p.coefficient
    pCoeffType.value = (c.type as string) ?? 'constant'
    pCoeffValue.value = (c.value as number) ?? 1
    pCoeffTable.value = Array.isArray(c.values) ? c.values.join(', ') : '0, 1, 3, 6, 10'
    pCoeffPoly.value = Array.isArray(c.coefficients) ? c.coefficients.join(', ') : '0, 1, 2'
    pCoeffBase.value = (c.base as number) ?? 2
    pCoeffScale.value = (c.scale as number) ?? 1
    pCoeffOffset.value = (c.offset as number) ?? 0
    pCoeffExp.value = (c.exponent as number) ?? 2
  }
}

function resizeGrid() {
  const w = pWidth.value
  const h = pHeight.value
  const old = pCells.value
  const next: string[][] = []
  for (let r = 0; r < h; r++) {
    const row: string[] = []
    for (let c = 0; c < w; c++) {
      row.push(old[r]?.[c] ?? '')
    }
    next.push(row)
  }
  pCells.value = next
}

// pattern coefficient
const pCoeffType = ref('constant')
const pCoeffValue = ref(1)
const pCoeffTable = ref('0, 1, 3, 6, 10')
const pCoeffPoly = ref('0, 1, 2')
const pCoeffBase = ref(2)
const pCoeffScale = ref(1)
const pCoeffOffset = ref(0)
const pCoeffExp = ref(2)

// symbolValues
const pSymbolEntries = ref<{ symbol: string; digits: string }[]>([])
function addSymbolEntry() { pSymbolEntries.value.push({ symbol: '', digits: '' }) }
function removeSymbolEntry(i: number) { pSymbolEntries.value.splice(i, 1) }

// allowSameWith
const pSameWithEntries = ref<{ symbol: string; others: string }[]>([])
function addSameWithEntry() { pSameWithEntries.value.push({ symbol: '', others: '' }) }
function removeSameWithEntry(i: number) { pSameWithEntries.value.splice(i, 1) }

// flags
const pMultiple = ref(false)
const pOverlap = ref(false)

function buildPatternParams(): string {
  const pattern = pCells.value.map((r) => r.map((c) => c || ' ').join(''))
  const obj: Record<string, unknown> = { pattern }

  // symbolValues
  const sv: Record<string, number[]> = {}
  for (const e of pSymbolEntries.value) {
    const sym = e.symbol.trim()
    if (!sym) continue
    const digits = e.digits.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
    if (digits.length > 0) sv[sym] = digits
  }
  if (Object.keys(sv).length > 0) obj.symbolValues = sv

  // allowSameWith
  const asw: Record<string, string[]> = {}
  for (const e of pSameWithEntries.value) {
    const sym = e.symbol.trim()
    if (!sym) continue
    const others = e.others.split(',').map((s) => s.trim()).filter(Boolean)
    if (others.length > 0) asw[sym] = others
  }
  if (Object.keys(asw).length > 0) obj.allowSameWith = asw

  // flags
  if (pMultiple.value) {
    obj.multiple = true
    if (!pOverlap.value) obj.allowOverlap = false
  }

  // coefficient
  const coeff = buildCoefficient()
  if (coeff) obj.coefficient = coeff

  return JSON.stringify(obj)
}

function buildCoefficient(): Record<string, unknown> | null {
  switch (pCoeffType.value) {
    case 'constant':
      return { type: 'constant', value: pCoeffValue.value }
    case 'match-count':
      return { type: 'match-count' }
    case 'match-count-table': {
      const values = pCoeffTable.value.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
      return { type: 'match-count-table', values }
    }
    case 'polynomial': {
      const coeffs = pCoeffPoly.value.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
      return { type: 'polynomial', coefficients: coeffs }
    }
    case 'exponential': {
      const obj: Record<string, unknown> = { type: 'exponential', base: pCoeffBase.value }
      if (pCoeffScale.value !== 1) obj.scale = pCoeffScale.value
      if (pCoeffOffset.value !== 0) obj.offset = pCoeffOffset.value
      return obj
    }
    case 'power': {
      const obj: Record<string, unknown> = { type: 'power', exponent: pCoeffExp.value }
      if (pCoeffScale.value !== 1) obj.scale = pCoeffScale.value
      if (pCoeffOffset.value !== 0) obj.offset = pCoeffOffset.value
      return obj
    }
    default:
      return null
  }
}

/* ══════════════ Digit-constraints editor ══════════════ */
const dRequired = ref('')
const dForbidden = ref('')

function resetDigitEditor() {
  dRequired.value = ''
  dForbidden.value = ''
}

function initFromDigitConstraints(p: { requiredDigits?: number[]; forbiddenDigits?: number[] }) {
  dRequired.value = p.requiredDigits?.join(', ') ?? ''
  dForbidden.value = p.forbiddenDigits?.join(', ') ?? ''
}

function buildDigitParams(): string {
  const obj: Record<string, unknown> = {}
  const parse = (s: string) =>
    s.split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number).filter((n) => !isNaN(n))
  const req = parse(dRequired.value)
  const forb = parse(dForbidden.value)
  if (req.length > 0) obj.requiredDigits = req
  if (forb.length > 0) obj.forbiddenDigits = forb
  return JSON.stringify(obj)
}

/* ── matcher key change → init or reset editor ── */
function onMatcherKeyInput() {
  const key = form.value.matcherKey
  if (key === 'pattern-matcher') {
    try {
      const p = JSON.parse(form.value.params)
      if (p.pattern) { initFromPattern(p); return }
    } catch { /* ignore */ }
    resetPatternEditor()
  } else if (key === 'digit-constraints') {
    try {
      const p = JSON.parse(form.value.params)
      if (p.requiredDigits || p.forbiddenDigits) { initFromDigitConstraints(p); return }
    } catch { /* ignore */ }
    resetDigitEditor()
  }
}
</script>

<template>
  <div class="root">
    <h1>Rule Development Helper</h1>

    <!-- ── rule table ── -->
    <section class="panel">
      <h2>Saved Rules ({{ rules.length }})</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>id</th>
              <th>label</th>
              <th>name.cn</th>
              <th>name.en</th>
              <th>matcherKey</th>
              <th>baseScore</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rules" :key="r.id" :class="{ active: editingIndex === i }">
              <td>{{ r.id }}</td>
              <td>{{ r.label }}</td>
              <td>{{ r.nameCn }}</td>
              <td>{{ r.nameEn }}</td>
              <td><span class="tag">{{ r.matcherKey }}</span></td>
              <td class="num">{{ r.baseScore }}</td>
              <td class="actions">
                <button class="btn-sm" @click="startEdit(i)">Edit</button>
                <button class="btn-sm danger" @click="deleteRule(i)">Del</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-actions">
        <button class="btn" @click="startNew">+ New Rule</button>
        <button class="btn" @click="downloadCsv">Download CSV</button>
      </div>
    </section>

    <!-- ── editor ── -->
    <section class="panel">
      <h2>{{ editingIndex === -1 ? 'New Rule' : `Edit: ${form.id || '(new)'}` }}</h2>

      <div class="form-grid">
        <label>id <input v-model="form.id" class="inp" placeholder="rule-xxx" /></label>
        <label>label <input v-model="form.label" class="inp" placeholder="kebab-case" /></label>
        <label>name.cn <input v-model="form.nameCn" class="inp" /></label>
        <label>name.en <input v-model="form.nameEn" class="inp" /></label>
        <label class="span2">description.cn <input v-model="form.descCn" class="inp" /></label>
        <label class="span2">description.en <input v-model="form.descEn" class="inp" /></label>
        <label>baseScore <input v-model.number="form.baseScore" class="inp num" min="0" type="number" /></label>
        <label>matcherKey
          <input v-model="form.matcherKey" class="inp text" list="matcher-keys" placeholder="输入或选择 matcher key" @input="onMatcherKeyInput" />
          <datalist id="matcher-keys">
            <option value="pattern-matcher" />
            <option value="digit-constraints" />
          </datalist>
        </label>
      </div>

      <!-- ── pattern-matcher editor ── -->
      <template v-if="form.matcherKey === 'pattern-matcher'">
        <h3>Pattern Editor</h3>
        <div class="size-row">
          <label>Width <input v-model.number="pWidth" class="inp num" min="1" max="6" type="number" @input="resizeGrid" /></label>
          <label>Height <input v-model.number="pHeight" class="inp num" min="1" max="6" type="number" @input="resizeGrid" /></label>
        </div>
        <div class="grid-wrap">
          <div v-for="(row, ri) in pCells" :key="ri" class="grid-row">
            <input
              v-for="(_, ci) in row"
              :key="ci"
              v-model="pCells[ri][ci]"
              class="cell"
              maxlength="1"
              type="text"
            />
          </div>
        </div>

        <h3>Coefficient</h3>
        <div class="inline-row">
          <select v-model="pCoeffType" class="inp sel">
            <option value="constant">constant</option>
            <option value="match-count">match-count</option>
            <option value="match-count-table">match-count-table</option>
            <option value="polynomial">polynomial</option>
            <option value="exponential">exponential</option>
            <option value="power">power</option>
          </select>
          <template v-if="pCoeffType === 'constant'">
            <label>value <input v-model.number="pCoeffValue" class="inp num" min="0" type="number" /></label>
          </template>
          <template v-else-if="pCoeffType === 'match-count-table'">
            <label>values <input v-model="pCoeffTable" class="inp text" /></label>
          </template>
          <template v-else-if="pCoeffType === 'polynomial'">
            <label>coeffs <input v-model="pCoeffPoly" class="inp text" /></label>
          </template>
          <template v-else-if="pCoeffType === 'exponential'">
            <label>base <input v-model.number="pCoeffBase" class="inp num" min="0" type="number" /></label>
            <label>scale <input v-model.number="pCoeffScale" class="inp num" type="number" /></label>
            <label>offset <input v-model.number="pCoeffOffset" class="inp num" type="number" /></label>
          </template>
          <template v-else-if="pCoeffType === 'power'">
            <label>exponent <input v-model.number="pCoeffExp" class="inp num" min="0" type="number" /></label>
            <label>scale <input v-model.number="pCoeffScale" class="inp num" type="number" /></label>
            <label>offset <input v-model.number="pCoeffOffset" class="inp num" type="number" /></label>
          </template>
        </div>

        <h3>symbolValues</h3>
        <div class="inline-row">
          <button class="btn-sm" @click="addSymbolEntry">+ Add</button>
        </div>
        <div v-for="(e, i) in pSymbolEntries" :key="i" class="inline-row">
          <input v-model="e.symbol" class="inp char" maxlength="1" placeholder="符号" />
          <span class="dim">→</span>
          <input v-model="e.digits" class="inp text" placeholder="1, 2, 3" />
          <button class="btn-sm danger" @click="removeSymbolEntry(i)">✕</button>
        </div>

        <h3>allowSameWith</h3>
        <div class="inline-row">
          <button class="btn-sm" @click="addSameWithEntry">+ Add</button>
        </div>
        <div v-for="(e, i) in pSameWithEntries" :key="i" class="inline-row">
          <input v-model="e.symbol" class="inp char" maxlength="1" placeholder="符号" />
          <span class="dim">→</span>
          <input v-model="e.others" class="inp text" placeholder="@, $ 逗号分隔" />
          <button class="btn-sm danger" @click="removeSameWithEntry(i)">✕</button>
        </div>

        <div class="inline-row">
          <label class="chk"><input v-model="pMultiple" type="checkbox" /> multiple</label>
          <label v-if="pMultiple" class="chk"><input v-model="pOverlap" type="checkbox" /> allowOverlap</label>
        </div>
      </template>

      <!-- ── digit-constraints editor ── -->
      <template v-if="form.matcherKey === 'digit-constraints'">
        <h3>Digit Constraints</h3>
        <div class="inline-row">
          <label>requiredDigits <input v-model="dRequired" class="inp text" placeholder="如 4, 5, 6" /></label>
          <label>forbiddenDigits <input v-model="dForbidden" class="inp text" placeholder="如 0, 9" /></label>
        </div>
      </template>

      <!-- ── generic params editor ── -->
      <template v-if="form.matcherKey !== 'pattern-matcher' && form.matcherKey !== 'digit-constraints'">
        <h3>Matcher Params</h3>
        <label class="raw-params-label">
          JSON
          <textarea v-model="form.params" class="inp raw-params" spellcheck="false" placeholder="{}" />
        </label>
      </template>

      <!-- ── params preview ── -->
      <h3>params (JSON)</h3>
      <pre class="json">{{ paramsJson }}</pre>

      <div class="form-actions">
        <button class="btn primary" @click="saveForm">Save</button>
        <button class="btn" @click="copyRow">Copy Row</button>
        <button class="btn" @click="editingIndex = -1">Cancel</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.root {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
  font-family: 'Azeret Mono', monospace;
  color: var(--text-hi);
}
h1 { font-size: 22px; margin-bottom: 24px; }
h2 { font-size: 16px; margin: 0 0 12px; color: var(--text-dim); }
h3 { font-size: 14px; margin: 16px 0 8px; color: var(--text-dim); }

.panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}

.table-wrap {
  overflow-x: auto;
  margin-bottom: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th, td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--panel-border);
  white-space: nowrap;
}
th {
  color: var(--text-dim);
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
tr.active td {
  background: rgba(29, 78, 216, 0.15);
}
td.num {
  text-align: right;
}
td.actions {
  text-align: right;
}
.tag {
  background: #333;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-dim);
}

.table-actions {
  display: flex;
  gap: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
}
.form-grid .span2 {
  grid-column: 1 / -1;
}

.inp {
  height: 32px;
  padding: 0 8px;
  background: var(--cell-bg);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
  color: var(--text-hi);
  font-family: 'Azeret Mono', monospace;
  font-size: 13px;
}
.inp.num { width: 80px; text-align: center; }
.inp.text { min-width: 160px; }
.inp.char { width: 40px; text-align: center; }
.inp.sel { width: auto; min-width: 120px; cursor: pointer; }

.size-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}
.size-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-dim);
}

.grid-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.grid-row {
  display: flex;
  gap: 4px;
}
.cell {
  width: 48px;
  height: 48px;
  padding: 0;
  background: var(--cell-bg);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
  color: var(--text-hi);
  font-family: 'Azeret Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  transition: border-color 0.15s;
}
.cell:focus {
  border-color: var(--accent-blue);
  outline: none;
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.dim {
  color: var(--text-dim);
  font-size: 13px;
}

.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
}

.raw-params-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-dim);
  font-size: 12px;
}
.raw-params {
  width: 100%;
  min-height: 96px;
  padding: 10px;
  resize: vertical;
  line-height: 1.5;
}

.json {
  background: var(--cell-bg);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn, .btn-sm {
  height: 32px;
  padding: 0 16px;
  background: var(--btn-bg);
  border: none;
  border-radius: 6px;
  color: var(--text-hi);
  font-family: 'Azeret Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}
.btn:hover, .btn-sm:hover { background: var(--btn-bg-hover); }
.btn.primary { background: var(--accent-blue); }
.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn-sm.danger { color: #f87171; }
</style>