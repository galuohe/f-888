<template>
  <div class="zt-view">
    <!-- 筛选栏 -->
    <div class="zt-filters">
      <div class="zt-filter-row">
        <span class="zt-filter-label">板块类别：</span>
        <button v-for="c in categoryOptions" :key="c.value"
          class="zt-chip" :class="{ active: category === c.value }"
          @click="category = c.value; expandedCode = null; fetchData()">{{ c.label }}</button>
      </div>
      <div class="zt-filter-row">
        <span class="zt-filter-label">阶段：</span>
        <button v-for="p in periodOptions" :key="p.value"
          class="zt-chip" :class="{ active: period === p.value }"
          @click="period = p.value; expandedCode = null; fetchData()">{{ p.label }}</button>
      </div>
    </div>

    <!-- 加载 -->
    <div v-if="loading && !items.length" class="zt-loading">
      <span class="spinner"></span>&nbsp;加载中…
    </div>

    <!-- 主题网格 -->
    <div v-if="items.length" class="zt-grid">
      <div
        v-for="item in items" :key="item.code"
        class="zt-card"
        :class="[item.ret >= 0 ? 'up' : 'down', { expanded: expandedCode === item.code }]"
        :style="cardStyle(item.ret)"
        @click="toggleExpand(item.code)"
      >
        <div class="zt-card-name">{{ item.name }}</div>
        <div class="zt-card-ret">{{ item.ret >= 0 ? '+' : '' }}{{ item.ret.toFixed(2) }}%</div>
      </div>
    </div>

    <!-- 展开详情面板 -->
    <div v-if="expandedCode" class="zt-detail">
      <div v-if="detailLoading" class="zt-loading" style="padding:20px 0">
        <span class="spinner"></span>&nbsp;加载中…
      </div>
      <template v-else>
        <!-- 板块名称 -->
        <div class="zt-detail-title">{{ detailInfo.SEC_NAME || expandedName }}</div>

        <!-- 各阶段涨跌幅 -->
        <div class="zt-metrics">
          <div v-for="m in metricFields" :key="m.key" class="zt-metric-card">
            <div class="zt-metric-label">{{ m.label }}</div>
            <div class="zt-metric-value" :class="detailVal(m.key) >= 0 ? 'up' : 'down'">
              {{ fmtPct(detailVal(m.key)) }}
            </div>
            <div class="zt-metric-rank" v-if="detailRank(m.rankKey, m.scKey)">
              排名：{{ detailRank(m.rankKey, m.scKey) }}
            </div>
          </div>
        </div>

        <!-- 关联基金 -->
        <div class="zt-funds-header">主题基金（{{ relFunds.length }}）</div>
        <div v-if="relFunds.length" class="zt-funds-scroll">
          <table class="zt-funds-table">
            <thead>
              <tr>
                <th class="sticky-col">基金名称</th>
                <th>净值</th>
                <th>日增长率</th>
                <th>类型</th>
                <th>近1周</th>
                <th>近1月</th>
                <th>近3月</th>
                <th>近6月</th>
                <th>今年来</th>
                <th>近1年</th>
                <th>成立来</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in relFunds" :key="f.FCODE">
                <td class="sticky-col">
                  <div class="fund-name">{{ f.SHORTNAME }}</div>
                  <div class="fund-code">{{ f.FCODE }}</div>
                </td>
                <td>{{ f.DWJZ }}</td>
                <td :class="colorClass(f.RZDF)">{{ fmtPct(f.RZDF) }}</td>
                <td class="fund-type">{{ f.FTYPE }}</td>
                <td :class="colorClass(f.SYL_Z)">{{ fmtRate(f.SYL_Z) }}</td>
                <td :class="colorClass(f.SYL_Y)">{{ fmtRate(f.SYL_Y) }}</td>
                <td :class="colorClass(f.SYL_3Y)">{{ fmtRate(f.SYL_3Y) }}</td>
                <td :class="colorClass(f.SYL_6Y)">{{ fmtRate(f.SYL_6Y) }}</td>
                <td :class="colorClass(f.SYL_JN)">{{ fmtRate(f.SYL_JN) }}</td>
                <td :class="colorClass(f.SYL_1N)">{{ fmtRate(f.SYL_1N) }}</td>
                <td :class="colorClass(f.SYL_LN)">{{ fmtRate(f.SYL_LN) }}</td>
                <td class="action-col">
                  <span v-if="isInFunds(f.FCODE)" class="zt-action muted">已持仓</span>
                  <span v-else-if="isInWatch(f.FCODE)" class="zt-action muted">已监控</span>
                  <span v-else class="zt-action add" @click="addToWatch(f)">添加监控</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="zt-loading" style="padding:16px 0">暂无关联基金</div>
      </template>
    </div>

    <!-- 空 -->
    <div v-else-if="!loading && !items.length" class="zt-loading">暂无数据</div>

    <!-- 底部统计 -->
    <div v-if="items.length" class="zt-footer">
      共 {{ items.length }} 个主题
      <span v-if="upCount">&nbsp;·&nbsp;<span style="color:var(--loss)">{{ upCount }} 涨</span></span>
      <span v-if="downCount">&nbsp;·&nbsp;<span style="color:var(--profit)">{{ downCount }} 跌</span></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'

const props = defineProps({ active: Boolean })

const fundStore = useFundStore()
const watchStore = useWatchStore()

const categoryOptions = [
  { value: '0', label: '全部' },
  { value: '001002', label: '行业' },
  { value: '001003', label: '概念' },
]
const periodOptions = [
  { value: 'D', label: '实时' },
  { value: 'W', label: '近1周' },
  { value: 'M', label: '近1月' },
  { value: 'Q', label: '近3月' },
  { value: 'Y', label: '近1年' },
  { value: 'SY', label: '今年来' },
]
const metricFields = [
  { key: 'D', label: '日涨幅', rankKey: null, scKey: null },
  { key: 'W', label: '近1周', rankKey: 'RANKW', scKey: 'WSC' },
  { key: 'M', label: '近1月', rankKey: 'RANKM', scKey: 'MSC' },
  { key: 'Q', label: '近3月', rankKey: 'RANKQ', scKey: 'QSC' },
  { key: 'Y', label: '近1年', rankKey: 'RANKY', scKey: 'YSC' },
  { key: 'SY', label: '今年来', rankKey: 'RANKSY', scKey: 'SYSC' },
]

const category = ref('0')
const period = ref('D')
const items = ref([])
const loading = ref(false)

// 展开相关
const expandedCode = ref(null)
const expandedName = ref('')
const detailInfo = ref({})
const relFunds = ref([])
const detailLoading = ref(false)

let _seq = 0

const upCount = computed(() => items.value.filter(i => i.ret >= 0).length)
const downCount = computed(() => items.value.filter(i => i.ret < 0).length)
const maxAbsRet = computed(() => Math.max(...items.value.map(i => Math.abs(i.ret)), 1))

function cardStyle(ret) {
  // sqrt 映射放大小幅涨跌的差异，透明度范围 0.03~0.45
  const ratio = Math.sqrt(Math.min(Math.abs(ret) / maxAbsRet.value, 1))
  const bgAlpha = (0.03 + ratio * 0.42).toFixed(3)
  const borderAlpha = (0.08 + ratio * 0.52).toFixed(3)
  const textAlpha = (0.45 + ratio * 0.55).toFixed(3)
  const rgb = ret >= 0 ? '240,64,64' : '34,196,94'
  return {
    background: `rgba(${rgb},${bgAlpha})`,
    borderColor: `rgba(${rgb},${borderAlpha})`,
    '--card-text': `rgba(${rgb},${textAlpha})`
  }
}

/* ---------- 通用请求（开发用 JSONP，生产用 Cloudflare Worker 代理） ---------- */
const IS_DEV = import.meta.env.DEV
const WORKER_BASE = 'https://cold-block-3400.eastmoney-proxy.workers.dev'

function ztFetch(url) {
  if (IS_DEV) return _jsonpFetch(url)
  // 生产环境：通过 Cloudflare Worker 代理
  const u = new URL(url)
  const proxyUrl = `${WORKER_BASE}${u.pathname}${u.search}${u.search ? '&' : '?'}_=${Date.now()}`
  return fetch(proxyUrl).then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
}

function _jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cbName = '_ztjj_d_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const fullUrl = url + (url.includes('?') ? '&' : '?') + `callback=${cbName}&_=${Date.now()}`
    const cleanup = () => { delete window[cbName]; const s = document.getElementById(cbName); if (s) s.remove() }
    const tid = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, 12000)
    window[cbName] = (resp) => { clearTimeout(tid); cleanup(); resolve(resp) }
    const script = document.createElement('script')
    script.id = cbName; script.src = fullUrl
    script.onerror = () => { clearTimeout(tid); cleanup(); reject(new Error('load error')) }
    document.head.appendChild(script)
  })
}

/* ---------- 列表接口 ---------- */
function fetchData() {
  loading.value = true
  const seq = ++_seq
  const url = `https://api.fund.eastmoney.com/ZTJJ/GetZTJJListNew?tt=${category.value}&dt=syl&st=${period.value}`

  ztFetch(url).then(resp => {
    if (seq !== _seq) return
    loading.value = false
    if (resp && resp.Data) {
      const field = period.value
      items.value = resp.Data
        .filter(d => d[field] != null)
        .sort((a, b) => b[field] - a[field])
        .map(d => ({ code: d.INDEXCODE, name: d.INDEXNAME, ret: d[field] }))
    }
  }).catch(() => {
    if (seq === _seq) loading.value = false
  })
}

/* ---------- 展开/收起 ---------- */
function toggleExpand(code) {
  if (expandedCode.value === code) {
    expandedCode.value = null
    return
  }
  expandedCode.value = code
  expandedName.value = items.value.find(i => i.code === code)?.name || ''
  detailInfo.value = {}
  relFunds.value = []
  detailLoading.value = true

  Promise.all([
    ztFetch(`https://api.fund.eastmoney.com/ZTJJ/GetBKDetailInfoNew?tp=${code}`),
    ztFetch(`https://api.fund.eastmoney.com/ZTJJ/GetBKRelTopicFundNew?sort=undefined&sorttype=DESC&pageindex=1&pagesize=10&tp=${code}&isbuy=1`),
  ]).then(([detailResp, fundsResp]) => {
    if (expandedCode.value !== code) return
    if (detailResp && detailResp.Data && typeof detailResp.Data === 'object') {
      detailInfo.value = detailResp.Data
    }
    if (fundsResp && Array.isArray(fundsResp.Data)) {
      relFunds.value = fundsResp.Data
    }
    detailLoading.value = false
  }).catch(() => {
    if (expandedCode.value === code) detailLoading.value = false
  })
}

/* ---------- 格式化工具 ---------- */
function detailVal(key) {
  const v = detailInfo.value[key]
  return v != null ? Number(v) : null
}

function detailRank(rankKey, scKey) {
  if (!rankKey) return ''
  const r = detailInfo.value[rankKey]
  const s = detailInfo.value[scKey]
  if (r == null) return ''
  return s ? `${Math.round(r)}/${Math.round(s)}` : Math.round(r)
}

function fmtPct(v) {
  if (v == null || v === '') return '---'
  const n = Number(v)
  if (isNaN(n)) return '---'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function fmtRate(v) {
  if (v == null || v === '') return '---'
  const n = Number(v)
  if (isNaN(n)) return '---'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function colorClass(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (isNaN(n)) return ''
  return n >= 0 ? 'up' : 'down'
}

/* ---------- 添加监控 ---------- */
function isInFunds(code) {
  return fundStore.funds.some(f => f.code === code)
}

function isInWatch(code) {
  return watchStore.watchlist.some(w => w.code === code)
}

function addToWatch(f) {
  const code = f.FCODE
  const name = f.SHORTNAME || code
  const added = watchStore.addWatch({ code, name, tags: expandedName.value ? [expandedName.value] : [] })
  if (!added) return

  // 用已有数据预填充
  const navNum = parseFloat(f.DWJZ)
  const retNum = parseFloat(f.RZDF)
  if (!isNaN(navNum) && navNum > 0) {
    const patch = { confirmedNav: navNum, confirmedDate: f.SYRQ }
    if (!isNaN(retNum)) {
      patch.gszzl = retNum
      patch.prevNav = parseFloat((navNum / (1 + retNum / 100)).toFixed(4))
    }
    watchStore.updateWatch(code, patch)
    watchStore.save()
  }

  window.$toast?.(`已添加监控：${name}`, 'success')
  fundStore.refreshAll(watchStore)
}

// 切到该 tab 时自动加载
watch(() => props.active, (v) => {
  if (v && !items.value.length) fetchData()
}, { immediate: true })
</script>

<style scoped>
.zt-view {
  padding: 12px 0;
}
.zt-filters {
  margin-bottom: 14px;
}
.zt-filter-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.zt-filter-label {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 60px;
}
.zt-chip {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: none;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.zt-chip:hover { color: var(--text-primary); border-color: var(--text-muted); }
.zt-chip.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.12);
  font-weight: 600;
}
.zt-loading {
  text-align: center;
  padding: 40px 0;
  color: var(--text-muted);
  font-size: 13px;
}
.zt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 6px;
}
.zt-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
}
.zt-card:hover {
  border-color: var(--text-muted);
}
.zt-card.expanded {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
/* up/down 背景和边框由 inline style 动态设置（根据涨跌幅深浅） */
.zt-card .zt-card-name { color: var(--card-text, var(--text-primary)); }
.zt-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
  margin-bottom: 4px;
}
.zt-card-ret {
  font-size: 14px;
  font-weight: 700;
}
.zt-card .zt-card-ret { color: var(--card-text, var(--text-primary)); }

/* ---- 展开详情面板 ---- */
.zt-detail {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card, #fff);
}
.zt-detail-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 12px;
}

/* 指标卡片行 */
.zt-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-bottom: 14px;
}
.zt-metric-card {
  text-align: center;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.zt-metric-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.zt-metric-value {
  font-size: 14px;
  font-weight: 700;
}
.zt-metric-value.up { color: var(--profit); }
.zt-metric-value.down { color: var(--loss); }
.zt-metric-rank {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 基金列表 */
.zt-funds-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.zt-funds-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.zt-funds-table {
  width: 100%;
  min-width: 700px;
  border-collapse: collapse;
  font-size: 12px;
}
.zt-funds-table th,
.zt-funds-table td {
  padding: 6px 8px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.zt-funds-table th {
  font-weight: 600;
  color: var(--text-muted);
  font-size: 11px;
  position: sticky;
  top: 0;
  background: var(--bg-card, #fff);
}
.zt-funds-table th.sticky-col,
.zt-funds-table td.sticky-col {
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--bg-card, #fff);
  z-index: 1;
}
.zt-funds-table td.up { color: var(--profit); }
.zt-funds-table td.down { color: var(--loss); }
.fund-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 12px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fund-code {
  font-size: 10px;
  color: var(--text-muted);
}
.fund-type {
  color: var(--text-muted);
  font-size: 11px;
}

/* 操作列 */
.action-col {
  text-align: center !important;
}
.zt-action {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}
.zt-action.muted {
  color: var(--text-muted);
}
.zt-action.add {
  color: var(--accent);
  cursor: pointer;
  border: 1px solid var(--accent);
}
.zt-action.add:hover {
  background: rgba(99, 102, 241, 0.12);
}

.zt-footer {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

/* ── Mobile: 768px ── */
@media (max-width: 768px) {
  .zt-filter-row { gap: 3px; }
  .zt-filter-label { font-size: 11px; width: 52px; }
  .zt-chip { padding: 3px 8px; font-size: 11px; }

  .zt-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 4px; }
  .zt-card { padding: 8px 4px; border-radius: 5px; }
  .zt-card-name { font-size: 11px; }
  .zt-card-ret { font-size: 12px; }

  .zt-detail { padding: 10px; }
  .zt-detail-title { font-size: 14px; margin-bottom: 8px; }
  .zt-metrics { grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .zt-metric-card { padding: 6px 3px; }
  .zt-metric-label { font-size: 10px; }
  .zt-metric-value { font-size: 12px; }
  .zt-metric-rank { font-size: 9px; }

  .zt-funds-table { min-width: 560px; font-size: 11px; }
  .zt-funds-table th, .zt-funds-table td { padding: 5px 5px; }
  .fund-name { max-width: 100px; font-size: 11px; }
}
</style>
