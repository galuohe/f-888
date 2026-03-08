<template>
  <div class="portfolio-view">
    <!-- Summary Grid -->
    <div class="card" style="margin-bottom:16px;">
      <div class="summary-grid" v-if="fundStore.summary">
        <div class="summary-item">
          <div class="summary-label">总持仓金额（元）</div>
          <div class="summary-value neutral" :class="{ masked: hiddenCols.amount }">
            ¥{{ fmt(fundStore.summary.totalAmount, 2) }}
          </div>
          <div
            v-if="fundStore.summary.totalAccumRate != null"
            class="summary-sub"
            :class="profitClass(fundStore.summary.totalAccumRate)"
          >
            {{ fundStore.summary.totalAccumRate >= 0 ? '+' : '' }}{{ fmt(fundStore.summary.totalAccumRate, 2) }}%
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">今日总盈亏（元）</div>
          <div
            class="summary-value"
            :class="[fundStore.summary.hasLive ? profitClass(fundStore.summary.todayProfit) : 'neutral', { masked: hiddenCols.profit }]"
          >
            <span v-if="!fundStore.summary.hasLive">--</span>
            <span v-else>
              {{ fundStore.summary.todayProfit >= 0 ? '+¥' : '-¥' }}{{ fmt(Math.abs(fundStore.summary.todayProfit), 2) }}
            </span>
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">今日涨跌幅</div>
          <div
            class="summary-value"
            :class="[fundStore.summary.hasLive ? profitClass(fundStore.summary.change) : 'neutral', { masked: hiddenCols.change }]"
          >
            <span v-if="!fundStore.summary.hasLive">--</span>
            <span v-else>
              {{ fundStore.summary.change >= 0 ? '+' : '' }}{{ fmt(fundStore.summary.change, 2) }}%
            </span>
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">总持仓累计收益（元）</div>
          <div
            class="summary-value"
            :class="[profitClass(fundStore.summary.totalAccum), { masked: hiddenCols.accum }]"
          >
            {{ fundStore.summary.totalAccum >= 0 ? '+¥' : '-¥' }}{{ fmt(Math.abs(fundStore.summary.totalAccum), 2) }}
          </div>
        </div>
      </div>

      <!-- Summary Skeleton when no data -->
      <div class="summary-grid" v-else>
        <div class="summary-item" v-for="i in 4" :key="i">
          <div class="summary-label skeleton-text" style="width: 50px;"></div>
          <div class="summary-value">
            <span class="skeleton-text" style="width: 80px;"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="actions-bar">
      <div class="fund-count">已添加 <span>{{ fundStore.funds.length }}</span> 只基金</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <!-- Nav mode badge -->
        <span :class="marketBadge.cls">
          <span class="badge-dot"></span>
          {{ marketBadge.label }}
        </span>

        <!-- Privacy toggle -->
        <div style="position:relative;" ref="privacyWrapRef">
          <button
            class="privacy-toggle"
            :class="{ on: isAnyHidden }"
            @click.stop="showPrivacyMenu = !showPrivacyMenu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <template v-if="isAnyHidden">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </template>
              <template v-else>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </template>
            </svg>
            隐私
          </button>
          <div class="privacy-dropdown" :class="{ show: showPrivacyMenu }">
            <!-- Toggle all -->
            <div
              class="privacy-opt"
              style="border-bottom:1px solid var(--border);margin-bottom:4px;padding-bottom:9px;"
              @click.stop="toggleAllPrivacy"
            >
              <div class="privacy-chk" :class="{ checked: isAnyHidden }"></div>
              <span>{{ isAnyHidden ? '显示全部' : '隐藏全部' }}</span>
            </div>
            <!-- Individual columns -->
            <div
              v-for="col in PRIVACY_COLS"
              :key="col.key"
              class="privacy-opt"
              @click.stop="togglePrivacyCol(col.key)"
            >
              <div class="privacy-chk" :class="{ checked: hiddenCols[col.key] }"></div>
              <span>{{ col.label }}</span>
            </div>
          </div>
        </div>

        <!-- Add fund button -->
        <button class="btn btn-add-open" @click="showAddModal = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          添加基金
        </button>

        <!-- Refresh button -->
        <button
          class="btn btn-refresh"
          :disabled="fundStore.isRefreshing"
          @click="handleRefresh"
        >
          <span v-if="fundStore.isRefreshing">刷新中…</span>
          <span v-else>刷新估值</span>
        </button>
      </div>
    </div>

    <!-- Fund Table -->
    <FundTable :hidden-cols="hiddenCols" />

    <!-- Add Fund Modal -->
    <AddFundModal v-model="showAddModal" @added="handleFundAdded" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fmt } from '@/utils/format'
import { getMarketBadge } from '@/utils/market'
import { loadHiddenCols, saveHiddenCols } from '@/utils/storage'
import FundTable from '@/components/fund/FundTable.vue'
import AddFundModal from '@/components/fund/AddFundModal.vue'

const fundStore = useFundStore()
const watchStore = useWatchStore()

const showAddModal = ref(false)
const privacyWrapRef = ref(null)

// ── Privacy / column visibility ──
const PRIVACY_COLS = [
  { key: 'amount',     label: '持仓金额'    },
  { key: 'changenav',  label: '涨跌幅·净值' },
  { key: 'profit',     label: '盈亏'        },
  { key: 'holdprofit', label: '持有收益'    },
  { key: 'shares',     label: '持仓份额'    },
  { key: 'cost',       label: '持仓成本'    },
]

const hiddenCols = ref(loadHiddenCols())
const showPrivacyMenu = ref(false)

const isAnyHidden = computed(() =>
  Object.values(hiddenCols.value).some(v => v)
)

function togglePrivacyCol(key) {
  hiddenCols.value = { ...hiddenCols.value, [key]: !hiddenCols.value[key] }
  saveHiddenCols(hiddenCols.value)
}

function toggleAllPrivacy() {
  const hide = !isAnyHidden.value
  const next = {}
  PRIVACY_COLS.forEach(c => { next[c.key] = hide })
  hiddenCols.value = next
  saveHiddenCols(hiddenCols.value)
}

function onDocClick(e) {
  if (privacyWrapRef.value && !privacyWrapRef.value.contains(e.target)) {
    showPrivacyMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// ── Market badge ──
const confirmedCount = computed(() =>
  fundStore.funds.filter(f => f.navConfirmed).length
)
const marketBadge = computed(() =>
  getMarketBadge(confirmedCount.value, fundStore.funds.length)
)

// ── Profit class ──
function profitClass(val) {
  if (val == null || isNaN(val)) return 'neutral'
  if (val > 0) return 'profit'
  if (val < 0) return 'loss'
  return 'neutral'
}

// ── Refresh ──
async function handleRefresh() {
  await fundStore.refreshAll(watchStore)
  window.$toast?.('估值已刷新', 'success')
}

function handleFundAdded() {
  // AddFundModal already handles refresh and success toast
}

// ── Suggest modal ──
function openSuggestModal(code) {
  const f = fundStore.funds.find(f => f.code === code)
  if (!f) return

  const currentNav   = (f.navConfirmed && f.confirmedNav) ? f.confirmedNav : (f.gsz || f.prevNav)
  const costBasisNav = (f.costBasisLocked && f.costBasis > 0) ? f.costBasis : (f.costNav || f.prevNav)

  if (!currentNav || !costBasisNav) {
    suggestModal.value = { open: true, data: null }
    return
  }

  const shares      = (f.holdingShares > 0) ? f.holdingShares : (f.amount / costBasisNav)
  const principal   = shares * costBasisNav
  const valueNow    = shares * currentNav
  const profitTotal = valueNow - principal
  const rTotal      = principal > 0 ? (profitTotal / principal * 100) : 0
  const rToday      = (f.gszzl != null && !isNaN(f.gszzl)) ? f.gszzl : 0

  const fundName  = (f.name && f.name !== f.code) ? f.name : f.code
  const navLabel  = f.navConfirmed ? '确认净值' : '预估净值'
  const navDateHint = f.confirmedDate ? `（${f.confirmedDate.slice(5)} 确认）` : (f.gztime ? `（${f.gztime.slice(5, 10)} 估值）` : '')

  const fmtY = (n) => (n >= 0 ? '+¥' : '-¥') + Math.abs(n).toFixed(2)
  const fmtP = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  let actionType, actionLabel, badgeClass, reasonHtml

  if (rTotal >= 40) {
    const sellAmt = valueNow * 0.5
    const sellSh  = sellAmt / currentNav
    actionType  = 'sell'; actionLabel = '🔴 建议分批止盈（较大幅度）'; badgeClass = 'sell'
    reasonHtml  = `当前持仓累计盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，已达到非常可观的收益水平。<br><br>
今天涨跌幅 <strong>${fmtP(rToday)}</strong>，在高位时及时落袋是保护收益的明智做法。<br><br>
建议：先卖出约 <strong>50% 仓位</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，把一半盈利落袋为安，剩余一半继续享受后续上涨空间。`
  } else if (rTotal >= 20) {
    const sellAmt = valueNow * 0.3
    const sellSh  = sellAmt / currentNav
    actionType  = 'sell'; actionLabel = '🟡 建议小幅止盈'; badgeClass = 'sell'
    reasonHtml  = `当前持仓累计盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，收益已经不小了。<br><br>
今天涨跌幅 <strong>${fmtP(rToday)}</strong>，市场有一定不确定性。对于新手投资者，到了一定盈利后先锁定部分利润是很好的习惯。<br><br>
建议：卖出约 <strong>30% 仓位</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，部分止盈，余下继续观察。`
  } else if (rTotal >= 5 && rToday >= 2) {
    const sellAmt = valueNow * 0.15
    const sellSh  = sellAmt / currentNav
    actionType  = 'sell'; actionLabel = '🟡 今日可小幅减仓'; badgeClass = 'sell'
    reasonHtml  = `当前持仓盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天单日涨幅达到 <strong>${fmtP(rToday)}</strong>，短期情绪偏热。<br><br>
在已有盈利且今日大涨的情况下，可以考虑小幅减仓锁定部分利润，避免短期回调侵蚀收益。<br><br>
建议：减仓约 <strong>15%</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，不用全部卖出，保留大头继续持有。`
  } else if (rTotal <= -15 && rToday <= -2) {
    const buyAmt = principal * 0.2
    const buySh  = buyAmt / currentNav
    actionType  = 'buy'; actionLabel = '🟢 可考虑分批低位加仓'; badgeClass = 'buy'
    reasonHtml  = `当前持仓亏损约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天又跌了 <strong>${fmtP(rToday)}</strong>，已处于相对低位区间。<br><br>
如果你依然看好这只基金的中长期走势，逢跌加仓是摊薄成本的好时机。<br><br>
建议：可以考虑补仓约 <strong>¥${buyAmt.toFixed(2)} 元（约 ${buySh.toFixed(2)} 份）</strong>，即原始本金的 20% 左右，不要一次性重仓，以免越跌越套。`
  } else if (rTotal <= -8 && rToday <= -1.5) {
    const buyAmt = principal * 0.1
    const buySh  = buyAmt / currentNav
    actionType  = 'buy'; actionLabel = '🟢 可小额定投补仓'; badgeClass = 'buy'
    reasonHtml  = `当前持仓亏损约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天跌了 <strong>${fmtP(rToday)}</strong>，处于回调区间。<br><br>
在亏损期间适量加仓，可以帮助降低持仓成本，为后续反弹创造更好的条件。<br><br>
建议：少量加仓约 <strong>¥${buyAmt.toFixed(2)} 元（约 ${buySh.toFixed(2)} 份）</strong>，用定投的方式分散风险，不要用超过总仓位 10% 的资金一次性追加。`
  } else {
    actionType = 'hold'; actionLabel = '⚪ 建议观望，暂不操作'; badgeClass = 'hold'
    let holdDetail = ''
    if (rTotal > 0) holdDetail = `盈利约 <strong>${fmtP(rTotal)}</strong>，虽然有收益，但还不到需要止盈的水平，继续持有等待更好时机。`
    else if (rTotal < 0) holdDetail = `目前小幅亏损约 <strong>${fmtP(Math.abs(rTotal))}</strong>，还没有跌到明显的低位补仓区域，保持现有仓位等待修复更稳妥。`
    else holdDetail = `当前接近成本价附近，盈亏基本持平，维持现状即可。`
    reasonHtml = `今日涨跌幅 <strong>${fmtP(rToday)}</strong>，属于正常波动范围。<br><br>
${holdDetail}<br><br>
对于新手投资者来说，不频繁操作、避免追涨杀跌是最重要的原则之一，耐心等待是最好的策略。`
  }

  suggestModal.value = {
    open: true,
    data: {
      name: fundName, code,
      valueNow: valueNow.toFixed(2),
      costBasisNav: costBasisNav.toFixed(4),
      currentNav: currentNav.toFixed(4),
      navLabel, navDateHint,
      profitTotal,
      profitTotalStr: `${fmtY(profitTotal)}（${fmtP(rTotal)}）`,
      rToday,
      rTodayStr: fmtP(rToday),
      actionLabel, badgeClass, reasonHtml,
      logicHtml: buildSuggestLogicHtml({ rTotal, rToday, fmtP }),
      ruleTableHtml: buildSuggestRuleTableHtml(),
    }
  }
}

function buildSuggestLogicHtml({ rTotal, rToday, fmtP }) {
  const tick = (ok) => ok
    ? '<span style="color:var(--profit);font-weight:700;">✅</span>'
    : '<span style="color:var(--loss);font-weight:700;">❌</span>'
  const val = (v, ok) => `<strong style="color:${ok ? 'var(--profit)' : 'var(--loss)'}">${v}</strong>`
  const green = 'var(--profit)', red = 'var(--loss)', yellow = '#f0a500', gray = 'var(--text-muted)'

  const rules = [
    {
      label: '累计盈利 ≥ 40% → 建议大幅止盈（50%仓位）', color: red,
      checks: [{ name: `累计收益率 ≥ 40%（当前 ${val(fmtP(rTotal), rTotal >= 40)}）`, pass: rTotal >= 40 }],
      triggered: rTotal >= 40,
    },
    {
      label: '累计盈利 20%–40% → 建议小幅止盈（30%仓位）', color: yellow,
      checks: [
        { name: `累计收益率 ≥ 20%（当前 ${val(fmtP(rTotal), rTotal >= 20)}）`, pass: rTotal >= 20 },
        { name: `累计收益率 < 40%（当前 ${val(fmtP(rTotal), rTotal < 40)}）`, pass: rTotal < 40 },
      ],
      triggered: rTotal >= 20 && rTotal < 40,
      note: rTotal >= 40 ? `<span style="color:${gray}">已被上一条规则命中，该条跳过。</span>` : null,
    },
    {
      label: '盈利 5%+ 且今日大涨 ≥ 2% → 小幅减仓（15%）', color: yellow,
      checks: [
        { name: `累计收益率 ≥ 5%（当前 ${val(fmtP(rTotal), rTotal >= 5)}）`, pass: rTotal >= 5 },
        { name: `今日涨幅 ≥ +2%（当前 ${val(fmtP(rToday), rToday >= 2)}）`, pass: rToday >= 2 },
      ],
      triggered: rTotal >= 5 && rToday >= 2 && rTotal < 20,
      note: rTotal >= 20 ? `<span style="color:${gray}">累计盈利已超 20%，已被止盈规则命中，该条跳过。</span>` : null,
    },
    {
      label: '亏损 ≥ 15% 且今日跌 ≥ 2% → 分批加仓（本金20%）', color: green,
      checks: [
        { name: `累计亏损 ≥ -15%（当前 ${val(fmtP(rTotal), rTotal <= -15)}）`, pass: rTotal <= -15 },
        { name: `今日跌幅 ≤ -2%（当前 ${val(fmtP(rToday), rToday <= -2)}）`, pass: rToday <= -2 },
      ],
      triggered: rTotal <= -15 && rToday <= -2,
    },
    {
      label: '亏损 8%–15% 且今日跌 ≥ 1.5% → 小额定投补仓（本金10%）', color: green,
      checks: [
        { name: `累计亏损 ≥ -8%（当前 ${val(fmtP(rTotal), rTotal <= -8)}）`, pass: rTotal <= -8 },
        { name: `累计亏损 < -15%（当前 ${val(fmtP(rTotal), rTotal > -15)}）`, pass: rTotal > -15 },
        { name: `今日跌幅 ≤ -1.5%（当前 ${val(fmtP(rToday), rToday <= -1.5)}）`, pass: rToday <= -1.5 },
      ],
      triggered: rTotal <= -8 && rTotal > -15 && rToday <= -1.5,
      note: rTotal <= -15 ? `<span style="color:${gray}">亏损已超 -15%，已被上一条规则命中，该条跳过。</span>` : null,
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
    if (rule.triggered) html += ` <span style="font-size:10px;background:${rule.color};color:#fff;border-radius:4px;padding:1px 6px;margin-left:4px;">命中</span>`
    html += '</div>'
    rule.checks.forEach(c => {
      html += `<div style="font-size:11px;padding:2px 0;display:flex;gap:6px;align-items:flex-start;min-width:0;overflow:hidden;">${tick(c.pass)}<span style="color:var(--text-secondary);min-width:0;word-break:break-all;overflow-wrap:anywhere;flex:1;">${c.name}</span></div>`
    })
    if (rule.note) html += `<div style="font-size:11px;margin-top:6px;">${rule.note}</div>`
    html += '</div>'
  })
  const anyTriggered = rules.some(r => r.triggered)
  if (!anyTriggered) html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">以上所有规则均未命中 → 默认建议：观望，暂不操作</div>'
  html += '</div>'
  return html
}

function buildSuggestRuleTableHtml() {
  const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px;flex-shrink:0;"></span>`
  const green = 'var(--profit)', red = 'var(--loss)', yellow = '#f0a500', gray = 'var(--text-muted)'
  const rows = [
    { bg: red,    label: '累计盈利 ≥ 40%',              action: '分批止盈（卖出 50% 仓位）' },
    { bg: yellow, label: '累计盈利 20%–40%',             action: '小幅止盈（卖出 30% 仓位）' },
    { bg: yellow, label: '盈利 5%+ 且今日涨幅 ≥ 2%',    action: '今日小幅减仓（减 15%）'    },
    { bg: green,  label: '亏损 ≥ 15% 且今日跌 ≥ 2%',   action: '分批低位加仓（本金 20%）'  },
    { bg: green,  label: '亏损 8%–15% 且今日小跌',      action: '小额定投补仓（本金 10%）'  },
    { bg: gray,   label: '其他',                         action: '观望，暂不操作'            },
  ]
  const tdBase = 'font-size:11px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;word-break:break-all;overflow-wrap:anywhere;'
  let h = `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.5px;">📖 判断规则一览</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead><tr>
        <th style="text-align:left;font-size:11px;font-weight:normal;color:var(--text-muted);padding:3px 6px;border-bottom:1px solid var(--border);width:50%;">情况</th>
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
}
</script>

<style scoped>
/* Skeleton loader */
.skeleton-text {
  display: inline-block;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--border) 25%,
    rgba(255, 255, 255, 0.05) 50%,
    var(--border) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  vertical-align: middle;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
