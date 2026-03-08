<template>
  <div class="mo-view">
    <!-- ═══ 标题 ═══ -->
    <div class="mo-header">
      <span class="mo-title">📊 市场全景</span>
    </div>

    <!-- ═══ 全球核心指数 ═══ -->
    <div class="mo-section">
      <div class="mo-section-header">
        <span class="mo-section-icon">📈</span>
        <span class="mo-section-title">全球核心指数 (实时)</span>
        <button class="mo-refresh-btn" :disabled="loading" @click="loadData">
          <span v-if="loading" class="spinner"></span>
          <span v-else>↻</span>
        </button>
      </div>
      <div class="mo-indices-grid">
        <div
          v-for="idx in data.indices"
          :key="idx.code"
          class="mo-index-card"
          :class="idx.changePercent >= 0 ? 'card-up' : 'card-down'"
        >
          <div class="mo-index-name">{{ idx.name }}</div>
          <div class="mo-index-value">{{ fmtVal(idx.value) }}</div>
          <div class="mo-index-change" :class="idx.changePercent >= 0 ? 'profit' : 'loss'">
            {{ idx.changePercent >= 0 ? '+' : '' }}{{ idx.changePercent.toFixed(2) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 板块风向标 ═══ -->
    <div v-if="data.sectors" class="mo-section">
      <div class="mo-section-header">
        <span class="mo-section-icon">🧭</span>
        <span class="mo-section-title">板块风向标</span>
      </div>
      <div class="mo-sector-wrap">
        <!-- 领涨 -->
        <div class="mo-sector-card sector-up">
          <div class="mo-sector-card-header">
            <span class="mo-sector-tag tag-up">领涨板块 (Top 5)</span>
            <span class="mo-sector-arrow">📈</span>
          </div>
          <div
            v-for="(s, i) in data.sectors.top"
            :key="s.name"
            class="mo-sector-row"
          >
            <span class="mo-sector-rank" :class="'r' + (i + 1)">{{ i + 1 }}</span>
            <span class="mo-sector-name">{{ s.name }}</span>
            <span class="mo-sector-pct profit">+{{ s.changePercent.toFixed(2) }}%</span>
          </div>
        </div>
        <!-- 领跌 -->
        <div class="mo-sector-card sector-down">
          <div class="mo-sector-card-header">
            <span class="mo-sector-tag tag-down">领跌板块 (Top 5)</span>
            <span class="mo-sector-arrow">📉</span>
          </div>
          <div
            v-for="(s, i) in data.sectors.bottom"
            :key="s.name"
            class="mo-sector-row"
          >
            <span class="mo-sector-rank" :class="'r' + (i + 1)">{{ i + 1 }}</span>
            <span class="mo-sector-name">{{ truncate(s.name, 6) }}</span>
            <span class="mo-sector-pct loss">{{ s.changePercent.toFixed(2) }}%</span>
          </div>
        </div>
      </div>
      <div class="mo-source">数据来源：同花顺行业一览表</div>
    </div>

    <!-- ═══ 昨日公布涨跌榜 ═══ -->
    <div v-if="data.fundRankings" class="mo-section">
      <div class="mo-section-header">
        <span class="mo-section-icon">🏆</span>
        <span class="mo-section-title">昨日公布涨跌榜 (Top 20)</span>
        <div class="mo-rank-tabs">
          <button
            class="mo-rank-tab"
            :class="{ active: rankTab === 'gainers' }"
            @click="rankTab = 'gainers'"
          >涨幅榜</button>
          <button
            class="mo-rank-tab"
            :class="{ active: rankTab === 'losers' }"
            @click="rankTab = 'losers'"
          >跌幅榜</button>
        </div>
      </div>

      <!-- 排行表头 -->
      <div class="mo-rank-header">
        <span class="mo-rank-col-no">排名</span>
        <span class="mo-rank-col-name">基金名称</span>
        <span class="mo-rank-col-chg">涨跌幅</span>
      </div>

      <!-- 排行列表 -->
      <div class="mo-rank-list">
        <div
          v-for="(f, i) in currentRankList"
          :key="f.code"
          class="mo-rank-row"
        >
          <span class="mo-rank-no" :class="rankNoClass(i + 1)">{{ i + 1 }}</span>
          <div class="mo-rank-info">
            <div class="mo-rank-name">{{ f.name }}</div>
            <div class="mo-rank-code">{{ f.code }}</div>
          </div>
          <span
            class="mo-rank-chg"
            :class="f.changePercent >= 0 ? 'profit' : 'loss'"
          >
            {{ f.changePercent >= 0 ? '+' : '' }}{{ fmtPct(f.changePercent) }}%
          </span>
          <button class="mo-add-btn" @click.stop="handleAdd(f)" :title="isInPortfolio(f.code) ? '已持有' : '添加到自选'">
            <span v-if="isInPortfolio(f.code)">✓</span>
            <span v-else>⊕</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading && !data.indices.length" class="mo-empty">
      <span class="spinner"></span> 加载中…
    </div>
    <div v-if="error" class="mo-empty mo-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { fetchMarketOverview } from '@/services/marketApi'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fetchOne } from '@/services/fundApi'

const props = defineProps({
  active: { type: Boolean, default: false }
})

const fundStore = useFundStore()
const watchStore = useWatchStore()

const loading = ref(false)
const error = ref(null)
const data = ref({ indices: [], sectors: null, fundRankings: null })
const rankTab = ref('gainers')
let _loaded = false

const currentRankList = computed(() => {
  if (!data.value.fundRankings) return []
  return rankTab.value === 'gainers'
    ? data.value.fundRankings.gainers
    : data.value.fundRankings.losers
})

watch(() => props.active, (val) => {
  if (val && !_loaded) loadData()
})

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchMarketOverview()
    data.value = res
    _loaded = true
  } catch (e) {
    error.value = '数据加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

function fmtVal(v) {
  if (v == null) return '--'
  return v >= 10000 ? v.toFixed(2) : v < 100 ? v.toFixed(2) : v.toFixed(2)
}

function fmtPct(v) {
  if (v == null) return '--'
  const abs = Math.abs(v)
  return abs === Math.floor(abs) ? abs.toFixed(0) : abs.toFixed(2)
}

function truncate(s, len) {
  return s && s.length > len ? s.slice(0, len) + '…' : s
}

function rankNoClass(n) {
  if (n === 1) return 'r1'
  if (n === 2) return 'r2'
  if (n === 3) return 'r3'
  return ''
}

function isInPortfolio(code) {
  return fundStore.funds.some(f => f.code === code) ||
    watchStore.watchlist.some(w => w.code === code)
}

async function handleAdd(f) {
  if (isInPortfolio(f.code)) return
  watchStore.addWatch({ code: f.code, name: f.name, tag: null })
  window.$toast?.('已添加到自选: ' + f.name, 'success')
  // 立即获取实时数据填充
  try {
    const d = await fetchOne(f.code)
    const patch = {}
    if (d.name) patch.name = d.name
    if (d.dwjz) patch.prevNav = parseFloat(d.dwjz)
    if (d.gsz) patch.gsz = parseFloat(d.gsz)
    if (d.gszzl !== undefined) patch.gszzl = parseFloat(d.gszzl)
    if (d.gztime) patch.gztime = d.gztime
    if (d.jzrq) patch.jzrq = d.jzrq
    watchStore.updateWatch(f.code, patch)
    watchStore.save()
  } catch (_) {}
}
</script>

<style scoped>
.mo-view {
  padding: 12px 0;
}

/* ══════ Header ══════ */
.mo-header {
  padding: 0 16px 10px;
}
.mo-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ══════ Section ══════ */
.mo-section {
  margin-bottom: 16px;
}
.mo-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
}
.mo-section-icon { font-size: 14px; }
.mo-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.mo-refresh-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 14px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.mo-refresh-btn:hover { color: var(--accent); border-color: var(--accent); }
.mo-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ══════ 指数网格 ══════ */
.mo-indices-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 0 16px;
}
.mo-index-card {
  padding: 10px 12px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.06);
  transition: all 0.15s;
}
.mo-index-card.card-up {
  background: rgba(240, 64, 64, 0.06);
  border-color: rgba(240, 64, 64, 0.15);
}
.mo-index-card.card-down {
  background: rgba(34, 196, 94, 0.06);
  border-color: rgba(34, 196, 94, 0.15);
}
.mo-index-name {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.mo-index-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}
.mo-index-change {
  font-size: 12px;
  font-weight: 600;
  margin-top: 2px;
}

/* ══════ 板块风向标 ══════ */
.mo-sector-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px;
}
.mo-sector-card {
  border-radius: 10px;
  padding: 10px 12px;
  border: 1px solid;
}
.mo-sector-card.sector-up {
  background: rgba(240, 64, 64, 0.04);
  border-color: rgba(240, 64, 64, 0.2);
}
.mo-sector-card.sector-down {
  background: rgba(34, 196, 94, 0.04);
  border-color: rgba(34, 196, 94, 0.2);
}
.mo-sector-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.mo-sector-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.mo-sector-tag.tag-up {
  background: rgba(240, 64, 64, 0.15);
  color: var(--profit);
}
.mo-sector-tag.tag-down {
  background: rgba(34, 196, 94, 0.15);
  color: var(--loss);
}
.mo-sector-arrow { font-size: 14px; opacity: 0.6; }
.mo-sector-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}
.mo-sector-rank {
  width: 16px;
  text-align: center;
  font-weight: 600;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.mo-sector-rank.r1 { color: #ffd700; }
.mo-sector-rank.r2 { color: #c0c0c0; }
.mo-sector-rank.r3 { color: #cd7f32; }
.mo-sector-name {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mo-sector-pct {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 55px;
  text-align: right;
}
.mo-source {
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.6;
  padding: 6px 0 0;
}

/* ══════ 涨跌榜 ══════ */
.mo-rank-tabs {
  margin-left: auto;
  display: flex;
  gap: 0;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  overflow: hidden;
}
.mo-rank-tab {
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.mo-rank-tab.active {
  background: var(--accent);
  color: #fff;
  border-radius: 5px;
}
.mo-rank-header {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  font-size: 10px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  margin: 0 16px;
}
.mo-rank-col-no { width: 36px; text-align: center; }
.mo-rank-col-name { flex: 1; }
.mo-rank-col-chg { width: 80px; text-align: right; }

.mo-rank-list {
  padding: 0 16px;
}
.mo-rank-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.mo-rank-row:last-child { border-bottom: none; }
.mo-rank-no {
  width: 36px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}
.mo-rank-no.r1 { color: #ffd700; }
.mo-rank-no.r2 { color: #c0c0c0; }
.mo-rank-no.r3 { color: #cd7f32; }
.mo-rank-info {
  flex: 1;
  min-width: 0;
}
.mo-rank-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
.mo-rank-code {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.4;
}
.mo-rank-chg {
  width: 70px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.mo-add-btn {
  margin-left: 8px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.mo-add-btn:hover { opacity: 1; color: var(--accent); }

/* ══════ Shared ══════ */
.profit { color: var(--profit); }
.loss { color: var(--loss); }
.mo-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.mo-error { color: var(--loss); }
</style>
