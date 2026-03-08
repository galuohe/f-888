<template>
  <div>
    <!-- Header bar -->
    <div class="mr-wrap">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary)">板块行情</div>
        <div class="mr-hint">{{ sectorRows.length }} 个板块，按今日平均涨幅降序</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span v-if="lastRefresh" style="font-size:11px;color:var(--text-muted);">
          上次刷新：{{ refreshTimeStr }}
        </span>
        <button
          class="btn btn-refresh"
          :disabled="isLoading"
          @click="handleRefresh"
        >
          <span v-if="isLoading">刷新中…</span>
          <span v-else>刷新</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && items.length === 0" class="mr-empty">
      <span class="spinner"></span>&nbsp;{{ statusMsg || '加载中…' }}
    </div>

    <!-- Progress overlay -->
    <div
      v-if="isLoading && items.length > 0"
      style="font-size:12px;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;"
    >
      <span class="spinner"></span>{{ statusMsg }}
    </div>

    <!-- Sector list -->
    <div v-if="sectorRows.length > 0">
      <div
        v-for="(row, idx) in sectorRows"
        :key="row.name"
        class="sector-row"
        :class="{ expanded: expandedSectors.has(row.name) }"
        @click="toggleSector(row.name)"
      >
        <!-- Sector header -->
        <div class="sector-row-head">
          <div class="sector-arrow">▶</div>
          <div class="mr-no" style="flex-shrink:0;" :class="rankClass(idx + 1)">{{ idx + 1 }}</div>
          <div style="flex:1;min-width:0;">
            <div class="sector-name">
              {{ row.name }}
              <span class="sector-count">{{ row.funds.length }} 只基金</span>
            </div>
          </div>
          <div
            class="sector-ret"
            :style="{ color: row.avgRet >= 0 ? 'var(--profit)' : 'var(--loss)' }"
          >
            {{ row.avgRet >= 0 ? '+' : '' }}{{ row.avgRet.toFixed(2) }}%
          </div>
        </div>

        <!-- Expanded: individual funds -->
        <div class="sector-funds" @click.stop>
          <div
            v-for="fund in row.funds"
            :key="fund.code"
            class="sector-fund-row"
          >
            <div class="sector-fund-name">
              {{ fund.name }}
              <span class="sector-fund-code">{{ fund.code }}</span>
            </div>
            <div
              class="sector-fund-ret"
              :style="{ color: fund.ret >= 0 ? 'var(--profit)' : 'var(--loss)' }"
            >
              {{ fund.ret >= 0 ? '+' : '' }}{{ fund.ret.toFixed(2) }}%
            </div>
            <div class="sector-fund-nav">{{ navStr(fund) }}</div>
            <div class="sector-fund-action" style="cursor:pointer;" @click.stop="openSuggest(fund, row)">
              <span
                class="sector-fund-suggest"
                :class="quickSuggestClass(fund, row)"
              >💡 买入建议</span>
            </div>
            <div class="sector-fund-action">
              <span
                v-if="isInFunds(fund.code)"
                style="color:var(--text-muted);font-size:11px;"
              >已在持仓</span>
              <span
                v-else-if="isInWatch(fund.code)"
                style="color:var(--text-muted);font-size:11px;"
              >已在监控</span>
              <span
                v-else
                style="color:var(--accent);cursor:pointer;font-size:11px;"
                @click.stop="addToWatch(fund)"
              >添加监控</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!isLoading" class="mr-empty">暂无数据，请点击刷新</div>

    <!-- Footer -->
    <div v-if="items.length > 0" class="mr-foot">
      共 {{ items.length }} 只基金 / {{ sectorRows.length }} 个板块，按板块平均涨幅降序
      <span v-if="refreshTimeStr">　更新于 {{ refreshTimeStr }}</span>
    </div>

    <!-- Buy Suggestion Modal -->
    <teleport to="body">
      <div
        v-if="suggestModal.open"
        style="display:flex;position:fixed;inset:0;z-index:2000;align-items:center;justify-content:center;"
      >
        <div class="modal-overlay" @click="suggestModal.open = false"></div>
        <div class="modal-box suggest-modal-box">
          <div class="modal-header">
            <span class="modal-title">💡 买入建议</span>
            <button class="modal-close" @click="suggestModal.open = false">✕</button>
          </div>
          <div class="modal-body">
            <!-- Loading -->
            <div
              v-if="suggestModal.loading"
              style="text-align:center;padding:28px 0;color:var(--text-muted);"
            >
              <span class="spinner"></span>&nbsp;分析中，正在获取历史走势…
            </div>

            <!-- Content -->
            <template v-else-if="suggestModal.data">
              <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">
                {{ suggestModal.data.name }}&nbsp;&nbsp;
                <span style="font-size:11px;">{{ suggestModal.data.code }}</span>&nbsp;&nbsp;
                <span class="mr-sector">{{ suggestModal.data.sector }}</span>
              </div>

              <div class="sg-info">
                <div class="sg-info-row">
                  <span>今日涨跌幅</span>
                  <span :style="{ color: suggestModal.data.todayRet >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.todayRet) }}
                  </span>
                </div>
                <div class="sg-info-row">
                  <span>当前净值</span>
                  <span>{{ suggestModal.data.currentNav > 0 ? suggestModal.data.currentNav.toFixed(4) : '--' }}</span>
                </div>
                <div class="sg-info-row">
                  <span>{{ suggestModal.data.sector }} 板块今日均值</span>
                  <span :style="{ color: suggestModal.data.sectorAvg >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.sectorAvg) }}（共 {{ suggestModal.data.sectorFunds }} 只）
                  </span>
                </div>
                <div class="sg-info-row">
                  <span>本基金板块内排名</span>
                  <span>第 {{ suggestModal.data.sectorRank }} / {{ suggestModal.data.sectorFunds }}</span>
                </div>
                <div class="sg-info-row">
                  <span>相对板块超额收益</span>
                  <span :style="{ color: suggestModal.data.relToSector >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.relToSector) }}
                  </span>
                </div>
              </div>

              <div class="sg-badge" :class="suggestModal.data.badgeCls" v-html="suggestModal.data.badge"></div>
              <div class="sg-reason" v-html="suggestModal.data.reason"></div>

              <div v-if="suggestModal.data.trendSummary" class="sg-info" style="margin-top:14px;">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
                  近期走势摘要（最近 {{ suggestModal.data.trendDays }} 个交易日）
                </div>
                <div v-if="suggestModal.data.totalRet != null" class="sg-info-row">
                  <span>期间累计涨幅</span>
                  <span :style="{ color: suggestModal.data.totalRet >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.totalRet) }}
                  </span>
                </div>
                <div v-if="suggestModal.data.dayAvg5 != null" class="sg-info-row">
                  <span>近 5 日日均涨幅</span>
                  <span :style="{ color: suggestModal.data.dayAvg5 >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.dayAvg5) }}
                  </span>
                </div>
                <div v-if="suggestModal.data.dayAvg20 != null" class="sg-info-row">
                  <span>近 20 日日均涨幅</span>
                  <span :style="{ color: suggestModal.data.dayAvg20 >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(suggestModal.data.dayAvg20) }}
                  </span>
                </div>
                <div v-if="suggestModal.data.drawdown < 0" class="sg-info-row">
                  <span>近期最大回撤</span>
                  <span style="color:var(--loss)">{{ suggestModal.data.drawdown.toFixed(1) }}%</span>
                </div>
              </div>

              <div v-html="suggestModal.data.rulesHtml" style="margin-top:16px;"></div>

              <div class="sg-hint">
                ⚠️ 建议基于历史净值走势与板块数据通过简单规则生成，<strong>不构成投资建议</strong>。
                基金有风险，投资需谨慎，建议结合当日财经新闻、宏观环境及个人风险承受能力综合判断。
              </div>

              <div v-html="ruleTableHtml" style="margin-top:16px;"></div>
            </template>

            <p
              v-else
              style="color:var(--text-muted);text-align:center;padding:20px 0;"
            >请先刷新基金大盘数据</p>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useMarketData } from '@/composables/useMarketData'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fetchPingzhongdata } from '@/services/pingzhongdata'
import { getTodayStr } from '@/utils/format'

const props = defineProps({ active: Boolean })

const { items, isLoading, lastRefresh, load, forceReload, MR_SECTORS } = useMarketData()
const fundStore  = useFundStore()
const watchStore = useWatchStore()

const statusMsg        = ref('')
const expandedSectors  = ref(new Set())

// ── Sector aggregation ────────────────────────────────────────────────────────

// 按 MR_SECTORS 字典分组（同一只基金可属于多板块，与源文件一致）
const sectorRows = computed(() => {
  const codeToItem = {}
  items.value.forEach(item => { codeToItem[item.code] = item })

  return Object.entries(MR_SECTORS)
    .map(([name, codes]) => {
      const funds = []
      codes.forEach(c => {
        const code = String(c).trim()
        if (codeToItem[code]) funds.push(codeToItem[code])
      })
      if (funds.length === 0) return null
      const validFunds = funds.filter(f => f.ret != null && !isNaN(f.ret))
      const avgRet = validFunds.length
        ? validFunds.reduce((s, f) => s + f.ret, 0) / validFunds.length
        : 0
      return { name, funds: [...funds].sort((a, b) => (b.ret ?? -999) - (a.ret ?? -999)), avgRet }
    })
    .filter(Boolean)
    .sort((a, b) => b.avgRet - a.avgRet)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function rankClass(rank) {
  if (rank === 1) return 'r1'
  if (rank === 2) return 'r2'
  if (rank === 3) return 'r3'
  return ''
}

function navStr(item) {
  const n = parseFloat(item.nav)
  return !isNaN(n) ? n.toFixed(4) : (item.nav || '--')
}

function toggleSector(name) {
  const s = new Set(expandedSectors.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedSectors.value = s
}

function isInFunds(code) {
  return fundStore.funds.some(f => f.code === code)
}

function isInWatch(code) {
  return watchStore.watchlist.some(w => w.code === code)
}

function addToWatch(fund) {
  const added = watchStore.addWatch({ code: fund.code, tag: fund.sector || null })
  if (added && window.$toast) window.$toast(`已添加监控：${fund.name}`, 'success')
}

function quickSuggestClass(fund, row) {
  const todayRet     = (fund.ret != null && !isNaN(fund.ret)) ? fund.ret : 0
  const sectorAvg    = row.avgRet
  const sectorWeak   = sectorAvg <= -2
  const sectorStrong = sectorAvg >= 2
  const bigDrop      = todayRet <= -3
  const bigRise      = todayRet >= 3
  const relToSector  = todayRet - sectorAvg
  const fundLag      = relToSector <= -1.5 && !bigDrop

  if (bigDrop && !sectorWeak)  return 'buy'
  if (bigRise && sectorStrong) return 'sell'
  if (fundLag)                 return 'sell'
  return 'hold'
}

const refreshTimeStr = computed(() => {
  if (!lastRefresh.value) return ''
  const d = lastRefresh.value
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

// ── Load ──────────────────────────────────────────────────────────────────────

async function doLoad(force = false) {
  statusMsg.value = ''
  await load(force, msg => { statusMsg.value = msg })
  statusMsg.value = ''
}

function handleRefresh() {
  forceReload(msg => { statusMsg.value = msg }).then(() => { statusMsg.value = '' })
}

watch(() => props.active, (active) => {
  if (active) doLoad()
})

onMounted(() => {
  if (props.active) doLoad()
})

// ── Buy Suggestion Modal ──────────────────────────────────────────────────────

const suggestModal = ref({ open: false, loading: false, data: null })

function dailyRet(arr) {
  const rets = []
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1].y > 0) rets.push((arr[i].y - arr[i - 1].y) / arr[i - 1].y * 100)
  }
  return rets
}

async function openSuggest(fund, row) {
  suggestModal.value = { open: true, loading: true, data: null }

  const todayRet   = (fund.ret != null && !isNaN(fund.ret)) ? fund.ret : 0
  const currentNav = parseFloat(fund.nav) || 0
  const sector     = fund.sector || row.name || '未知板块'

  // Sector analysis using cached items
  const sectorFunds_ = items.value.filter(r => r.sector === sector && r.ret != null && !isNaN(r.ret))
  const sectorAvg    = sectorFunds_.length
    ? sectorFunds_.reduce((s, r) => s + r.ret, 0) / sectorFunds_.length
    : row.avgRet
  const sectorRank   = sectorFunds_.filter(r => r.ret > todayRet).length + 1
  const relToSector  = todayRet - sectorAvg

  // History
  let dayAvg5 = null, dayAvg20 = null, drawdown = 0, rise5 = null, recentDays = []
  try {
    const pzd = await fetchPingzhongdata(fund.code)
    const trend = pzd.data || pzd
    if (trend && trend.length >= 5) {
      const sorted = [...trend].sort((a, b) => a.x - b.x)
      recentDays   = sorted.slice(-20)
      if (recentDays.length >= 5) {
        const last5  = recentDays.slice(-5)
        const rets5  = dailyRet(last5)
        const rets20 = dailyRet(recentDays)
        dayAvg5  = rets5.length  ? rets5.reduce((s, v) => s + v, 0)  / rets5.length  : null
        dayAvg20 = rets20.length ? rets20.reduce((s, v) => s + v, 0) / rets20.length : null
        const n5Start = last5[0].y
        const n5End   = last5[last5.length - 1].y
        rise5 = n5Start > 0 ? (n5End - n5Start) / n5Start * 100 : null
        let peak = recentDays[0].y
        recentDays.forEach(d => {
          if (d.y > peak) peak = d.y
          const dd = (d.y - peak) / peak * 100
          if (dd < drawdown) drawdown = dd
        })
      }
    }
  } catch (_) {}

  const isOversold   = dayAvg5 != null && dayAvg5 < -1.5 && todayRet <= -1
  const isMomentumUp = dayAvg5 != null && dayAvg5 > 0.5 && rise5 != null && rise5 > 3
  const sectorStrong = sectorAvg >= 2
  const sectorWeak   = sectorAvg <= -2
  const fundLagSect  = relToSector <= -1.5
  const bigDropToday = todayRet <= -3
  const bigRiseToday = todayRet >= 3
  const deepDrawdown = drawdown <= -8

  let badge, badgeCls, reason

  if (deepDrawdown && isOversold) {
    badge    = '🟢 建议关注买入时机'
    badgeCls = 'buy'
    reason   = `近期该基金从高点回撤约 <strong>${Math.abs(drawdown).toFixed(1)}%</strong>，近 5 日日均跌幅 <strong>${fmtPct(dayAvg5)}</strong>，今日跌 <strong>${fmtPct(todayRet)}</strong>，已进入超跌区间。
      <br><br>
      <strong>${sector}</strong> 板块今日平均 <strong>${fmtPct(sectorAvg)}</strong>，该基金在板块内排名 <strong>第 ${sectorRank} / ${sectorFunds_.length}</strong>。
      <br><br>
      建议：在超跌位置可以考虑小额试探性买入，或者分 2～3 批在不同价位建仓，每批不超过计划买入总额的 30%，以平均成本。当前净值约 <strong>${currentNav.toFixed(4)}</strong>，如果继续跌，可以按计划再分批补入。`
  } else if (bigDropToday && !sectorWeak) {
    badge    = '🟢 今日大跌，可关注逢低买入'
    badgeCls = 'buy'
    reason   = `今日下跌 <strong>${fmtPct(todayRet)}</strong>，幅度较大，但 <strong>${sector}</strong> 板块整体今日均值 <strong>${fmtPct(sectorAvg)}</strong>，板块基本面并无明显走弱。
      ${rise5 != null ? `<br><br>近 5 日累计 <strong>${fmtPct(rise5)}</strong>，` + (rise5 > 0 ? '短期整体仍向上，今日属于正常回调。' : '近期有所调整，今日下跌是延续。') : ''}
      <br><br>
      该基金在板块内今日排名 <strong>第 ${sectorRank} / ${sectorFunds_.length}</strong>（相对板块 <strong>${fmtPct(relToSector)}</strong>）。
      <br><br>
      建议：今日如果看好该板块中长期逻辑，可以考虑小额逢低买入，建议买入金额不超过你计划总仓位的 20%，分批操作更稳妥。`
  } else if (isMomentumUp && sectorStrong) {
    badge    = '🟡 板块强势但涨幅已大，谨慎追入'
    badgeCls = 'sell'
    reason   = `近 5 日日均涨幅 <strong>${fmtPct(dayAvg5)}</strong>，近 5 日累计涨幅约 <strong>${fmtPct(rise5)}</strong>，短期涨势明显。
      <strong>${sector}</strong> 板块今日整体也较强，均值 <strong>${fmtPct(sectorAvg)}</strong>。
      <br><br>
      <strong>⚠️ 追高风险提示</strong>：短期大幅上涨后往往存在回调压力，此时买入相当于在相对高位建仓，一旦情绪降温可能短期浮亏。
      <br><br>
      建议：<strong>当前不建议大额追入</strong>。如果你非常看好该基金，可以少量（不超过 5%～10% 仓位）持有观察，等回调至支撑位再考虑加仓。`
  } else if (bigRiseToday && dayAvg5 != null && dayAvg5 < 0) {
    badge    = '⚪ 今日反弹，观望为主'
    badgeCls = 'hold'
    reason   = `今日上涨 <strong>${fmtPct(todayRet)}</strong>，但近 5 日日均涨幅仅 <strong>${fmtPct(dayAvg5)}</strong>，整体趋势偏弱，今日可能只是短暂反弹。
      ${drawdown < 0 ? `<br><br>近期最大回撤约 <strong>${Math.abs(drawdown).toFixed(1)}%</strong>，` + (drawdown <= -5 ? '跌幅已不小。' : '仍在调整中。') : ''}
      <br><br>
      建议：<strong>暂时观望</strong>，不要因为今日大涨就急于买入，等趋势稳定后再做决定。`
  } else if (fundLagSect && !bigDropToday) {
    badge    = '🔴 板块内表现偏弱，暂不建议买入'
    badgeCls = 'sell'
    reason   = `今日该基金涨幅 <strong>${fmtPct(todayRet)}</strong>，而 <strong>${sector}</strong> 板块平均涨幅 <strong>${fmtPct(sectorAvg)}</strong>，
      该基金落后板块 <strong>${Math.abs(relToSector).toFixed(2)}%</strong>，在板块内排名 <strong>第 ${sectorRank} / ${sectorFunds_.length}</strong>。
      <br><br>
      建议：若想参与 <strong>${sector}</strong> 板块行情，可以优先考虑板块内涨幅靠前的基金，而非该基金。`
  } else {
    badge    = '⚪ 暂无明显信号，以观望为主'
    badgeCls = 'hold'
    const trendDesc = dayAvg5 != null
      ? (dayAvg5 > 0.3
          ? `近 5 日日均涨幅 <strong>${fmtPct(dayAvg5)}</strong>，短期偏多。`
          : dayAvg5 < -0.3
            ? `近 5 日日均跌幅 <strong>${fmtPct(Math.abs(dayAvg5))}</strong>，短期偏弱。`
            : `近 5 日走势较为平稳，日均 <strong>${fmtPct(dayAvg5)}</strong>。`)
      : ''
    reason   = `今日涨跌 <strong>${fmtPct(todayRet)}</strong>，<strong>${sector}</strong> 板块均值 <strong>${fmtPct(sectorAvg)}</strong>，相对板块 <strong>${fmtPct(relToSector)}</strong>。
      ${trendDesc ? '<br><br>' + trendDesc : ''}
      <br><br>
      当前没有明显的超跌买入或止盈卖出信号，属于正常震荡区间。建议观望，等待更明确的方向信号后再操作。`
  }

  let trendSummary = false, totalRet = null, trendDays = 0
  if (recentDays.length >= 5) {
    trendSummary = true
    trendDays    = recentDays.length
    const first  = recentDays[0]
    const last_  = recentDays[recentDays.length - 1]
    totalRet     = first.y > 0 ? (last_.y - first.y) / first.y * 100 : null
  }

  const rulesHtml = buildRulesHtml({
    todayRet, sectorAvg, sectorWeak, bigDropToday, bigRiseToday,
    deepDrawdown, isOversold, isMomentumUp, sectorStrong, fundLagSect,
    dayAvg5, rise5, drawdown, relToSector,
  })

  suggestModal.value = {
    open: true,
    loading: false,
    data: {
      name: fund.name || fund.code,
      code: fund.code,
      sector,
      todayRet,
      currentNav,
      sectorAvg,
      sectorFunds: sectorFunds_.length,
      sectorRank,
      relToSector,
      badge,
      badgeCls,
      reason,
      trendSummary,
      trendDays,
      totalRet,
      dayAvg5,
      dayAvg20,
      drawdown,
      rulesHtml,
    },
  }
}

// ── Rule detail HTML builder ──────────────────────────────────────────────────

function buildRulesHtml({
  todayRet, sectorAvg, sectorWeak, bigDropToday, bigRiseToday,
  deepDrawdown, isOversold, isMomentumUp, sectorStrong, fundLagSect,
  dayAvg5, rise5, drawdown, relToSector,
}) {
  const tick = (ok) => ok
    ? '<span style="color:var(--profit);font-weight:700;">✅</span>'
    : '<span style="color:var(--loss);font-weight:700;">❌</span>'
  const val  = (v, color) => `<strong style="color:${color}">${v}</strong>`
  const G = 'var(--profit)', R = 'var(--loss)', gray = 'var(--text-muted)'

  const rules = [
    {
      label:   '深度回调 + 连续下跌 → 超跌建仓',
      color:   G,
      checks:  [
        { name: `近期最大回撤 ≤ -8%（当前 ${val(drawdown.toFixed(1) + '%', drawdown <= -8 ? G : R)}）`, pass: deepDrawdown },
        { name: `近5日日均涨幅 < -1.5%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 < -1.5 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 < -1.5 },
        { name: `今日跌幅 ≤ -1%（当前 ${val(fmtPct(todayRet), todayRet <= -1 ? G : R)}）`, pass: todayRet <= -1 },
      ],
      triggered: deepDrawdown && isOversold,
    },
    {
      label:   '今日大跌但板块不弱 → 逢低买入',
      color:   G,
      checks:  [
        { name: `今日跌幅 ≤ -3%（当前 ${val(fmtPct(todayRet), bigDropToday ? G : R)}）`, pass: bigDropToday },
        { name: `板块今日均值 > -2%（当前 ${val(fmtPct(sectorAvg), !sectorWeak ? G : R)}）`, pass: !sectorWeak },
      ],
      triggered: bigDropToday && !sectorWeak,
      note: sectorWeak
        ? `<span style="color:var(--loss)">⚠️ 板块今日均值 ${fmtPct(sectorAvg)}，整个板块都在跌，说明是系统性下跌而非该基金超跌，此时买入风险较高。</span>`
        : null,
    },
    {
      label:   '近期动能强 + 板块强势 → 追高警示',
      color:   '#f0a500',
      checks:  [
        { name: `近5日日均涨幅 > 0.5%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 > 0.5 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 > 0.5 },
        { name: `近5日累计涨幅 > 3%（当前 ${val(rise5 != null ? fmtPct(rise5) : '--', rise5 != null && rise5 > 3 ? G : R)}）`, pass: rise5 != null && rise5 > 3 },
        { name: `板块今日均值 ≥ 2%（当前 ${val(fmtPct(sectorAvg), sectorStrong ? G : R)}）`, pass: sectorStrong },
      ],
      triggered: isMomentumUp && sectorStrong,
    },
    {
      label:   '今日大涨但近期趋势向下 → 疑似反弹',
      color:   gray,
      checks:  [
        { name: `今日涨幅 ≥ 3%（当前 ${val(fmtPct(todayRet), bigRiseToday ? G : R)}）`, pass: bigRiseToday },
        { name: `近5日日均涨幅 < 0%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 < 0 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 < 0 },
      ],
      triggered: bigRiseToday && dayAvg5 != null && dayAvg5 < 0,
    },
    {
      label:   '相对板块明显落后 → 弱势基金',
      color:   R,
      checks:  [
        { name: `相对板块落后 ≥ 1.5%（当前 ${val(fmtPct(relToSector), relToSector <= -1.5 ? G : R)}）`, pass: relToSector <= -1.5 },
        { name: `今日跌幅 > -3%（非大跌）（当前 ${val(fmtPct(todayRet), !bigDropToday ? G : R)}）`, pass: !bigDropToday },
      ],
      triggered: fundLagSect && !bigDropToday,
    },
  ]

  let html = '<div style="margin-top:16px;">'
  html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.5px;">📋 分析过程 — 规则匹配详情</div>'

  rules.forEach(rule => {
    const borderColor = rule.triggered ? rule.color : 'var(--border)'
    html += `<div style="border:1px solid ${borderColor};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${rule.triggered ? 'rgba(255,255,255,0.03)' : 'transparent'}">`
    html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:${rule.triggered ? rule.color : 'var(--text-muted)'}">`
    html += rule.triggered ? '▶ ' : '▷ '
    html += rule.label
    if (rule.triggered) {
      html += ` <span style="font-size:10px;background:${rule.color};color:#000;border-radius:4px;padding:1px 6px;margin-left:4px;">命中</span>`
    }
    html += '</div>'
    rule.checks.forEach(c => {
      html += `<div style="font-size:11px;padding:2px 0;display:flex;gap:6px;align-items:flex-start;">${tick(c.pass)}<span style="color:var(--text-secondary)">${c.name}</span></div>`
    })
    if (rule.note) html += `<div style="font-size:11px;margin-top:6px;">${rule.note}</div>`
    html += '</div>'
  })

  const anyTriggered = rules.some(r => r.triggered)
  if (!anyTriggered) {
    html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">以上所有规则均未命中 → 默认建议：观望</div>'
  }
  html += '</div>'
  return html
}

// ── Rule table (static) ───────────────────────────────────────────────────────

const ruleTableHtml = (() => {
  const G = 'var(--profit)', R = 'var(--loss)', Y = '#f0a500', gray = 'var(--text-muted)'
  const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px;flex-shrink:0;"></span>`
  const rows = [
    { bg: G,    label: '近期深度回调（≥-8%）+ 连跌',     action: '建议关注买入时机，给出分批建仓建议' },
    { bg: G,    label: '今日大跌（≤-3%）但板块不弱',      action: '今日大跌，可关注逢低买入' },
    { bg: Y,    label: '近 5 日强势 + 板块也强',          action: '谨慎追入，提示追高风险' },
    { bg: gray, label: '今日大涨但近期趋势向下',           action: '今日反弹，观望为主' },
    { bg: R,    label: '相对板块明显落后（≥1.5%）',       action: '板块内表现偏弱，暂不建议买入' },
    { bg: gray, label: '其他正常波动',                    action: '无明显信号，观望为主' },
  ]
  const tdBase = 'font-size:11px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.04);'
  let h = `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.5px;">📖 判断规则一览</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;font-size:11px;font-weight:normal;color:var(--text-muted);padding:3px 6px;border-bottom:1px solid var(--border);width:50%;">场景</th>
        <th style="text-align:left;font-size:11px;font-weight:normal;color:var(--text-muted);padding:3px 6px;border-bottom:1px solid var(--border);">建议</th>
      </tr></thead><tbody>`
  rows.forEach(r => {
    h += `<tr>
      <td style="${tdBase}color:var(--text-secondary);">${r.label}</td>
      <td style="${tdBase}"><span style="display:inline-flex;align-items:center;">${dot(r.bg)}<span style="color:${r.bg === gray ? gray : 'var(--text-primary)'}">${r.action}</span></span></td>
    </tr>`
  })
  h += '</tbody></table></div>'
  return h
})()
</script>
