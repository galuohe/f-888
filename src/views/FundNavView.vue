<template>
  <div class="fn-view">
    <!-- 类型筛选 -->
    <div class="fn-filters">
      <div class="fn-filter-row">
        <span class="fn-label">类型</span>
        <div class="fn-chips">
          <button
            v-for="(label, key) in NAV_FUND_TYPES" :key="key"
            class="fn-chip" :class="{ active: filterType === Number(key) }"
            @click="setType(Number(key))"
          >{{ label }}</button>
        </div>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="fn-info">
      <div>
        <span class="fn-total">共 {{ total.toLocaleString() }} 只基金</span>
        <span class="fn-page-info">第 {{ page }} / {{ pages }} 页</span>
      </div>
      <button class="fn-refresh-btn" :disabled="loading" @click="reload()">
        {{ loading ? '刷新中…' : '刷新数据' }}
      </button>
    </div>

    <!-- 表格 -->
    <div class="fn-table-wrap">
      <table class="fn-table">
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-code">基金代码</th>
            <th class="col-name">基金简称</th>
            <th colspan="2" class="col-group">最新净值</th>
            <th colspan="2" class="col-group">上期净值</th>
            <th class="col-num">日增长值</th>
            <th class="col-pct col-sortable" :class="{ 'col-active': sortBy === 'rzdf' }" @click="toggleSort('rzdf')">
              日增长率
              <span class="sort-arrow" v-if="sortBy === 'rzdf'">{{ order === 'desc' ? '▼' : '▲' }}</span>
            </th>
            <th class="col-status">申购状态</th>
            <th class="col-status">赎回状态</th>
            <th class="col-fee">手续费</th>
            <th class="col-action">操作</th>
          </tr>
          <tr class="sub-header">
            <th></th>
            <th></th>
            <th></th>
            <th class="col-nav col-sortable" :class="{ 'col-active': sortBy === 'dwjz' }" @click="toggleSort('dwjz')">
              单位净值
              <span class="sort-arrow" v-if="sortBy === 'dwjz'">{{ order === 'desc' ? '▼' : '▲' }}</span>
            </th>
            <th class="col-nav">累计净值</th>
            <th class="col-nav">单位净值</th>
            <th class="col-nav">累计净值</th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="!loading && list.length > 0">
          <tr v-for="(f, i) in list" :key="f.code">
            <td class="col-idx">{{ (page - 1) * size + i + 1 }}</td>
            <td class="col-code">{{ f.code }}</td>
            <td class="col-name">
              <span class="fund-name">{{ f.name }}</span>
            </td>
            <td class="col-nav">
              <div class="nav-val">{{ f.dwjz || '--' }}</div>
              <div class="nav-date" v-if="showday[0]">{{ shortDate(showday[0]) }}</div>
            </td>
            <td class="col-nav">
              <div class="nav-val">{{ f.ljjz || '--' }}</div>
              <div class="nav-date" v-if="showday[0]">{{ shortDate(showday[0]) }}</div>
            </td>
            <td class="col-nav col-prev">
              <div class="nav-val">{{ f.prevDwjz || '--' }}</div>
              <div class="nav-date" v-if="showday[1]">{{ shortDate(showday[1]) }}</div>
            </td>
            <td class="col-nav col-prev">
              <div class="nav-val">{{ f.prevLjjz || '--' }}</div>
              <div class="nav-date" v-if="showday[1]">{{ shortDate(showday[1]) }}</div>
            </td>
            <td class="col-num" :class="growClass(f.dailyGrow)">{{ fmtGrow(f.dailyGrow) }}</td>
            <td class="col-pct" :class="growClass(f.dailyRate)">{{ fmtRate(f.dailyRate) }}</td>
            <td class="col-status">{{ f.buyStatus || '--' }}</td>
            <td class="col-status">{{ f.sellStatus || '--' }}</td>
            <td class="col-fee">{{ f.fee ? f.fee + '%' : '--' }}</td>
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

      <div class="fn-loading" v-if="loading">加载中…</div>
      <div class="fn-empty" v-else-if="list.length === 0 && !error">暂无数据</div>
      <div class="fn-error" v-if="error">{{ error }} <button class="fn-retry" @click="reload()">重试</button></div>
    </div>

    <!-- 分页 -->
    <div class="fn-pager" v-if="pages > 1">
      <button class="fn-pg-btn" :disabled="page <= 1" @click="goPage(1)">首页</button>
      <button class="fn-pg-btn" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
      <button
        v-for="p in visiblePages" :key="p"
        class="fn-pg-btn" :class="{ active: p === page }"
        @click="goPage(p)"
      >{{ p }}</button>
      <button class="fn-pg-btn" :disabled="page >= pages" @click="goPage(page + 1)">下一页</button>
      <button class="fn-pg-btn" :disabled="page >= pages" @click="goPage(pages)">末页</button>
      <div class="fn-pg-jump">
        <span>跳至</span>
        <input
          type="number" min="1" :max="pages" v-model.number="jumpPage"
          class="fn-pg-input" @keyup.enter="goPage(jumpPage)"
        />
        <span>页</span>
        <button class="fn-pg-btn" @click="goPage(jumpPage)">GO</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { fetchFundNav, NAV_FUND_TYPES } from '@/services/fundNav'
import { useFundActions } from '@/composables/useFundActions'
import SuggestModal from '@/components/common/SuggestModal.vue'

const props = defineProps({
  active: { type: Boolean, default: false }
})

const { isInFunds, isInWatch, addToWatch, suggestModal, openSuggest, quickSuggest } = useFundActions()

const list = ref([])
const total = ref(0)
const page = ref(1)
const pages = ref(0)
const size = 200
const sortBy = ref('rzdf')
const order = ref('desc')
const filterType = ref(1)
const loading = ref(false)
const error = ref('')
const jumpPage = ref(1)
const showday = ref([])
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
    const res = await fetchFundNav({
      sortBy: sortBy.value,
      order: order.value,
      type: filterType.value,
      page: page.value,
      size,
      text: '',
    })
    list.value = res.list
    total.value = res.total
    pages.value = res.pages
    jumpPage.value = page.value
    if (res.showday && res.showday.length > 0) showday.value = res.showday
  } catch (e) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

const visiblePages = computed(() => {
  const p = page.value
  const max = pages.value
  if (max <= 7) return Array.from({ length: max }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(p - 3, max - 6))
  return Array.from({ length: 7 }, (_, i) => start + i)
})

function handleSuggest(f) {
  openSuggest({ code: f.code, name: f.name, nav: f.dwjz, ret: f.dailyRate })
}

function getQuickSuggest(f) {
  return quickSuggest({ ret: f.dailyRate })
}

function handleAddWatch(f) {
  addToWatch({ code: f.code, name: f.name, nav: f.dwjz, ret: f.dailyRate, jzrq: showday.value[0] })
}

function shortDate(d) {
  if (!d) return ''
  // "2026-03-13" → "03-13"
  return d.slice(5)
}

function fmtGrow(val) {
  if (val === '' || val == null || val === '--') return '--'
  const n = parseFloat(val)
  if (isNaN(n)) return '--'
  return (n >= 0 ? '+' : '') + n.toFixed(4)
}

function fmtRate(val) {
  if (val === '' || val == null || val === '--') return '--'
  const n = parseFloat(val)
  if (isNaN(n)) return '--'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function growClass(val) {
  if (val === '' || val == null) return ''
  const n = parseFloat(val)
  if (isNaN(n)) return ''
  return n > 0 ? 'pct-up' : n < 0 ? 'pct-down' : ''
}
</script>

<style scoped>
.fn-view {
  padding: 12px 0;
}

/* ── 筛选栏 ── */
.fn-filters {
  padding: 0 12px 8px;
}

.fn-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fn-label {
  font-size: 12px;
  color: var(--text-muted);
  width: 32px;
  flex-shrink: 0;
}

.fn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fn-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.fn-chip:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.fn-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* ── 信息栏 ── */
.fn-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.fn-info > div { display: flex; gap: 12px; }
.fn-refresh-btn {
  padding: 3px 12px;
  font-size: 12px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.fn-refresh-btn:hover:not(:disabled) { filter: brightness(1.15); }
.fn-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 表格 ── */
.fn-table-wrap {
  overflow-x: auto;
  padding: 0 8px;
}

.fn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 900px;
}

.fn-table th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  padding: 6px 6px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.fn-table .sub-header th {
  top: 28px;
  font-size: 10px;
  font-weight: 500;
  padding: 4px 6px;
  border-bottom: 2px solid var(--border);
}

.col-group {
  text-align: center !important;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.col-group .col-date {
  display: block;
  font-size: 10px;
  font-weight: 400;
  opacity: 0.7;
  margin-top: 1px;
}

.fn-table th.col-sortable {
  cursor: pointer;
  transition: color 0.15s;
}

.fn-table th.col-sortable:hover {
  color: var(--text-primary);
}

.fn-table th.col-active {
  color: var(--accent);
}

.sort-arrow {
  font-size: 9px;
  margin-left: 2px;
  vertical-align: middle;
}

.fn-table td {
  padding: 7px 6px;
  text-align: right;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  color: var(--text-primary);
}

.fn-table tbody tr:hover {
  background: rgba(85, 113, 245, 0.05);
}

.col-idx {
  text-align: center !important;
  width: 40px;
  color: var(--text-muted) !important;
  font-size: 12px;
}

.col-code {
  text-align: center !important;
  width: 72px;
  font-size: 12px;
  color: var(--accent) !important;
}

.col-name {
  text-align: left !important;
  min-width: 140px;
  max-width: 200px;
}

.fund-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 180px;
}

.col-nav {
  width: 72px;
}

.nav-val {
  line-height: 1.3;
}

.nav-date {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.2;
}

.col-prev {
  color: var(--text-muted) !important;
}

.col-num {
  width: 80px;
}

.col-pct {
  width: 80px;
}

.col-status {
  width: 64px;
  text-align: center !important;
  font-size: 11px;
  color: var(--text-muted) !important;
}

.col-fee {
  width: 56px;
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
.act-add:hover { background: rgba(99, 102, 241, 0.12); }
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
.fn-loading, .fn-empty, .fn-error {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 14px;
}

.fn-error { color: var(--profit); }

.fn-retry {
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
.fn-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 12px 16px;
}

.fn-pg-btn {
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

.fn-pg-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.fn-pg-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.fn-pg-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.fn-pg-jump {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.fn-pg-input {
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

.fn-pg-input:focus {
  border-color: var(--accent);
}

.fn-pg-input::-webkit-inner-spin-button,
.fn-pg-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .fn-filters { padding: 0 8px 4px; }
  .fn-chip { padding: 2px 7px; font-size: 11px; }
.fn-table { font-size: 12px; }
  .fn-table th, .fn-table td { padding: 5px 4px; }
  .fund-name { max-width: 120px; font-size: 12px; }
  .fn-pager { gap: 2px; padding: 8px; }
  .fn-pg-btn { min-width: 28px; height: 26px; font-size: 11px; }
}
</style>
