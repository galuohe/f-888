<template>
  <div class="fr-view">
    <!-- 类型筛选 -->
    <div class="fr-filters">
      <div class="fr-filter-row">
        <span class="fr-label">类型</span>
        <div class="fr-chips">
          <button
            v-for="(label, key) in FUND_TYPES" :key="key"
            class="fr-chip" :class="{ active: filterType === key }"
            @click="setType(key)"
          >{{ label }}<span class="chip-count" v-if="typeCounts[key]">({{ typeCounts[key].toLocaleString() }})</span></button>
        </div>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="fr-info">
      <div>
        <span class="fr-total">共 {{ total.toLocaleString() }} 只基金</span>
        <span class="fr-page-info">第 {{ page }} / {{ pages }} 页</span>
      </div>
      <button class="fr-refresh-btn" :disabled="loading" @click="reload()">
        {{ loading ? '刷新中…' : '刷新数据' }}
      </button>
    </div>

    <!-- 表格 -->
    <div class="fr-table-wrap">
      <table class="fr-table">
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-name">基金名称</th>
            <th class="col-date">日期</th>
            <th class="col-nav">单位净值</th>
            <th class="col-nav">累计净值</th>
            <th v-for="col in sortCols" :key="col.key"
                class="col-pct col-sortable"
                :class="{ 'col-active': sortBy === col.key }"
                @click="toggleSort(col.key)"
            >
              {{ col.label }}
              <span class="sort-arrow" v-if="sortBy === col.key">{{ order === 'desc' ? '▼' : '▲' }}</span>
            </th>
            <th class="col-pct col-sortable"
                :class="{ 'col-active': sortBy === 'composite' }"
                @click="toggleCompositeSort"
            >
              综合评分
              <span class="sort-arrow" v-if="sortBy === 'composite'">{{ order === 'desc' ? '▼' : '▲' }}</span>
            </th>
            <th class="col-fee">手续费</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading && displayList.length > 0">
          <tr v-for="(f, i) in displayList" :key="f.code">
            <td class="col-idx">{{ (page - 1) * size + i + 1 }}</td>
            <td class="col-name">
              <div class="fund-name-cell">
                <span class="fn-name">{{ f.name }}</span>
                <span
                  v-if="signalCache[f.code]"
                  class="signal-badge"
                  :class="'sig-' + signalCache[f.code].zoneLevel"
                  :title="'综合评分 ' + signalCache[f.code].composite"
                >{{ signalCache[f.code].zone }}</span>
                <span class="fn-code">{{ f.code }}</span>
              </div>
            </td>
            <td class="col-date">{{ fmtDate(f.jzrq) }}</td>
            <td class="col-nav">{{ f.dwjz || '--' }}</td>
            <td class="col-nav">{{ f.ljjz || '--' }}</td>
            <td class="col-pct" :class="pctClass(f.rzdf)">{{ fmtPct(f.rzdf) }}</td>
            <td class="col-pct" :class="pctClass(f.zzf)">{{ fmtPct(f.zzf) }}</td>
            <td class="col-pct" :class="pctClass(f['1yzf'])">{{ fmtPct(f['1yzf']) }}</td>
            <td class="col-pct" :class="pctClass(f['3yzf'])">{{ fmtPct(f['3yzf']) }}</td>
            <td class="col-pct" :class="pctClass(f['6yzf'])">{{ fmtPct(f['6yzf']) }}</td>
            <td class="col-pct" :class="pctClass(f['1nzf'])">{{ fmtPct(f['1nzf']) }}</td>
            <td class="col-pct" :class="pctClass(f['2nzf'])">{{ fmtPct(f['2nzf']) }}</td>
            <td class="col-pct" :class="pctClass(f['3nzf'])">{{ fmtPct(f['3nzf']) }}</td>
            <td class="col-pct" :class="pctClass(f.jnzf)">{{ fmtPct(f.jnzf) }}</td>
            <td class="col-pct" :class="pctClass(f.lnzf)">{{ fmtPct(f.lnzf) }}</td>
            <td class="col-pct" :class="compositeClass(f.code)">{{ compositeText(f.code) }}</td>
            <td class="col-fee">{{ f.fee || '--' }}</td>
            <td class="col-action">
              <span class="act-btn suggest-btn" :class="getQuickSuggest(f).cls" @click.stop="handleSuggest(f)">{{ getQuickSuggest(f).label }}</span>
              <span v-if="isInFunds(f.code)" class="act-btn act-muted">已持仓</span>
              <span v-else-if="isInWatch(f.code)" class="act-btn act-muted">已监控</span>
              <span v-else class="act-btn act-add" @click.stop="handleAddWatch(f)">添加监控</span>
            </td>
          </tr>
        </tbody>
      </table>

      <SuggestModal :modal="suggestModal" />

      <div class="fr-loading" v-if="loading">加载中…</div>
      <div class="fr-empty" v-else-if="displayList.length === 0 && !error">暂无数据</div>
      <div class="fr-error" v-if="error">{{ error }} <button class="fr-retry" @click="reload()">重试</button></div>
    </div>

    <!-- 分页 -->
    <div class="fr-pager" v-if="pages > 1">
      <button class="fr-pg-btn" :disabled="page <= 1" @click="goPage(1)">首页</button>
      <button class="fr-pg-btn" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
      <button
        v-for="p in visiblePages" :key="p"
        class="fr-pg-btn" :class="{ active: p === page }"
        @click="goPage(p)"
      >{{ p }}</button>
      <button class="fr-pg-btn" :disabled="page >= pages" @click="goPage(page + 1)">下一页</button>
      <button class="fr-pg-btn" :disabled="page >= pages" @click="goPage(pages)">末页</button>
      <div class="fr-pg-jump">
        <span>跳至</span>
        <input
          type="number" min="1" :max="pages" v-model.number="jumpPage"
          class="fr-pg-input" @keyup.enter="goPage(jumpPage)"
        />
        <span>页</span>
        <button class="fr-pg-btn" @click="goPage(jumpPage)">GO</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { fetchFundRank, FUND_TYPES } from '@/services/fundRank'
import { useFundActions } from '@/composables/useFundActions'
import SuggestModal from '@/components/common/SuggestModal.vue'
import { fetchPingzhongdata } from '@/services/pingzhongdata'
import { signalCache, calcTechIndicators, calcBandSignal, calcCompositeSignal } from '@/utils/signalCache'

const props = defineProps({
  active: { type: Boolean, default: false }
})

const { isInFunds, isInWatch, addToWatch, suggestModal, openSuggest, quickSuggest } = useFundActions()

// 可排序的列定义
const sortCols = [
  { key: 'rzdf',  label: '日涨幅' },
  { key: 'zzf',   label: '近1周' },
  { key: '1yzf',  label: '近1月' },
  { key: '3yzf',  label: '近3月' },
  { key: '6yzf',  label: '近6月' },
  { key: '1nzf',  label: '近1年' },
  { key: '2nzf',  label: '近2年' },
  { key: '3nzf',  label: '近3年' },
  { key: 'jnzf',  label: '今年来' },
  { key: 'lnzf',  label: '成立来' },
]

const list = ref([])
const total = ref(0)
const page = ref(1)
const pages = ref(0)
const size = 50
const sortBy = ref('rzdf')
const order = ref('desc')
const filterType = ref('all')
const loading = ref(false)
const error = ref('')
const jumpPage = ref(1)
const typeCounts = ref({})
let loaded = false

watch(() => props.active, (val) => {
  if (val && !loaded) {
    loaded = true
    reload()
  }
})

function setType(t) {
  filterType.value = t
  page.value = 1
  reload()
}

function toggleSort(key) {
  if (sortBy.value === key) {
    order.value = order.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = key
    order.value = 'desc'
  }
  page.value = 1
  reload()
}

function toggleCompositeSort() {
  if (sortBy.value === 'composite') {
    order.value = order.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'composite'
    order.value = 'desc'
  }
}

// 展示列表：综合评分排序时前端重排，其他走服务端排序
const displayList = computed(() => {
  if (sortBy.value !== 'composite') return list.value
  const sorted = [...list.value]
  sorted.sort((a, b) => {
    const sa = signalCache[a.code]?.composite ?? null
    const sb = signalCache[b.code]?.composite ?? null
    if (sa == null && sb == null) return 0
    if (sa == null) return 1
    if (sb == null) return -1
    return order.value === 'desc' ? sb - sa : sa - sb
  })
  return sorted
})

function compositeText(code) {
  const sig = signalCache[code]
  if (!sig) return '--'
  return (sig.composite > 0 ? '+' : '') + sig.composite
}

function compositeClass(code) {
  const sig = signalCache[code]
  if (!sig) return ''
  return sig.composite > 0 ? 'pct-up' : sig.composite < 0 ? 'pct-down' : ''
}

function goPage(p) {
  const n = Math.max(1, Math.min(p || 1, pages.value))
  if (n === page.value) return
  page.value = n
  jumpPage.value = n
  reload()
}

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchFundRank({
      sortBy: sortBy.value,
      order: order.value,
      type: filterType.value,
      page: page.value,
      size,
    })
    list.value = res.list
    total.value = res.total
    pages.value = res.pages
    jumpPage.value = page.value
    if (res.counts) typeCounts.value = res.counts
    _calcListSignals(res.list)
  } catch (e) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

async function _calcListSignals(funds) {
  for (const f of funds) {
    if (signalCache[f.code]) continue
    try {
      const pzd = await fetchPingzhongdata(f.code)
      const trend = pzd.data || pzd
      if (!trend || trend.length < 20) continue
      const fullTrend = trend.map(d => [d.x, d.y])
      const tech = calcTechIndicators(fullTrend)
      const band = calcBandSignal(fullTrend)
      const result = calcCompositeSignal(tech, band, null)
      if (result) {
        signalCache[f.code] = { zone: result.zone, zoneLevel: result.zoneLevel, confidence: result.confidence, composite: result.composite }
      }
    } catch (_) {}
  }
}

const visiblePages = computed(() => {
  const p = page.value
  const max = pages.value
  if (max <= 7) return Array.from({ length: max }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(p - 3, max - 6))
  return Array.from({ length: 7 }, (_, i) => start + i)
})

function fmtDate(val) {
  if (!val) return '--'
  // '2026-03-13' → '03-13'
  return val.slice(5)
}

function fmtPct(val) {
  if (val === '' || val == null || val === '--') return '--'
  const n = parseFloat(val)
  if (isNaN(n)) return '--'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function handleSuggest(f) {
  openSuggest({ code: f.code, name: f.name, nav: f.dwjz, ret: f.rzdf })
}

function getQuickSuggest(f) {
  return quickSuggest({ ret: f.rzdf })
}

function handleAddWatch(f) {
  addToWatch({ code: f.code, name: f.name, nav: f.dwjz, ret: f.rzdf, jzrq: f.jzrq })
}

function pctClass(val) {
  if (val === '' || val == null) return ''
  const n = parseFloat(val)
  if (isNaN(n)) return ''
  return n > 0 ? 'pct-up' : n < 0 ? 'pct-down' : ''
}
</script>

<style scoped>
.fr-view {
  padding: 12px 0;
}

/* ── 筛选栏 ── */
.fr-filters {
  padding: 0 12px 8px;
}

.fr-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fr-label {
  font-size: 12px;
  color: var(--text-muted);
  width: 32px;
  flex-shrink: 0;
}

.fr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fr-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.fr-chip:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.fr-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.chip-count {
  margin-left: 2px;
  font-size: 11px;
  opacity: 0.75;
}

/* ── 信息栏 ── */
.fr-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.fr-info > div { display: flex; gap: 12px; }
.fr-refresh-btn {
  padding: 3px 12px;
  font-size: 12px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.fr-refresh-btn:hover:not(:disabled) { filter: brightness(1.15); }
.fr-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 表格 ── */
.fr-table-wrap {
  overflow-x: auto;
  padding: 0 8px;
}

.fr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 800px;
}

.fr-table th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  padding: 8px 6px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.fr-table th.col-sortable {
  cursor: pointer;
  transition: color 0.15s;
}

.fr-table th.col-sortable:hover {
  color: var(--text-primary);
}

.fr-table th.col-active {
  color: var(--accent);
}

.sort-arrow {
  font-size: 9px;
  margin-left: 2px;
  vertical-align: middle;
}

.fr-table td {
  padding: 8px 6px;
  text-align: right;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  color: var(--text-primary);
}

.fr-table tbody tr:hover {
  background: rgba(85, 113, 245, 0.05);
}

.col-idx {
  text-align: center !important;
  width: 40px;
  color: var(--text-muted) !important;
  font-size: 12px;
}

.col-name {
  text-align: left !important;
  min-width: 160px;
  max-width: 200px;
}

.fund-name-cell {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.fn-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.fn-code {
  font-size: 11px;
  color: var(--text-muted);
}

.col-date {
  width: 52px;
  color: var(--text-muted) !important;
  font-size: 12px;
  text-align: center !important;
}

.col-nav {
  width: 70px;
  color: var(--text-secondary) !important;
}

.col-pct {
  width: 72px;
}

.col-fee {
  width: 60px;
  color: var(--text-muted) !important;
  font-size: 12px;
}

.col-action {
  text-align: center !important;
  white-space: nowrap;
  min-width: 120px;
}
.act-btn {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  margin: 0 2px;
}
.act-muted { color: var(--text-muted); }
.act-add {
  color: var(--accent);
  cursor: pointer;
  border: 1px solid var(--accent);
}
.act-add:hover { background: var(--accent-subtle); }
.suggest-btn {
  cursor: pointer;
  font-size: 10px !important;
  padding: 1px 6px !important;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.suggest-btn.buy        { color: #fff; background: #22c45e; border-color: #22c45e; }
.suggest-btn.buy-light  { color: #22c45e; border-color: #22c45e; }
.suggest-btn.warn       { color: #fff; background: #e6a23c; border-color: #e6a23c; }
.suggest-btn.warn-light { color: #e6a23c; border-color: #e6a23c; }
.suggest-btn.sell       { color: #fff; background: #f04040; border-color: #f04040; }
.suggest-btn.hold       { color: var(--text-muted); border-color: var(--border); }

.pct-up { color: var(--profit) !important; }
.pct-down { color: var(--loss) !important; }

/* ── 状态 ── */
.fr-loading, .fr-empty, .fr-error {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 14px;
}

.fr-error { color: var(--profit); }

.fr-retry {
  margin-left: 8px;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

/* ── 分页 ── */
.fr-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 12px 16px;
}

.fr-pg-btn {
  min-width: 32px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.fr-pg-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.fr-pg-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.fr-pg-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.fr-pg-jump {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.fr-pg-input {
  width: 50px;
  height: 30px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.fr-pg-input:focus {
  border-color: var(--accent);
}

.fr-pg-input::-webkit-inner-spin-button,
.fr-pg-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .fr-filters { padding: 0 8px 4px; }
  .fr-chip { padding: 2px 7px; font-size: 11px; }
  .fr-table { font-size: 12px; }
  .fr-table th, .fr-table td { padding: 6px 4px; }
  .fn-name { max-width: 120px; font-size: 12px; }
  .fr-pager { gap: 2px; padding: 8px; }
  .fr-pg-btn { min-width: 28px; height: 26px; font-size: 11px; }
}
</style>
