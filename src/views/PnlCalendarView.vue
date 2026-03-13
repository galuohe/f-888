<template>
  <div class="pnl-calendar-view">
    <!-- Cal Nav -->
    <div class="cal-nav">
      <button class="cal-nav-btn" @click="prevMonth" title="上月">&#8249;</button>
      <span class="cal-month-label">{{ calYear }}年{{ calMonth + 1 }}月</span>
      <button class="cal-nav-btn" @click="nextMonth" title="下月">&#8250;</button>
      <button class="btn btn-refresh" style="margin-left:auto;" :disabled="fundStore.isRefreshing" @click="handleRefresh">
        <span v-if="fundStore.isRefreshing">刷新中…</span>
        <span v-else>刷新日历</span>
      </button>
      <button class="btn btn-remove" style="font-size:12px;" @click="handleClear">清空记录</button>
    </div>

    <!-- Monthly Summary -->
    <div class="monthly-summary">
      <span class="summary-item">
        本月交易日：<strong>{{ monthlyTradingDays }}</strong> 天
      </span>
      <span class="summary-sep">｜</span>
      <span class="summary-item">
        本月合计：
        <strong :class="monthlyTotal > 0 ? 'profit' : monthlyTotal < 0 ? 'loss' : 'neutral'">
          {{ monthlyTotal > 0 ? '+' : '' }}¥{{ fmtNum(monthlyTotal) }}
        </strong>
      </span>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-wrapper">
      <table class="cal-table">
        <thead>
          <tr>
            <th v-for="d in weekDays" :key="d" class="cal-th">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(week, wi) in calendarWeeks" :key="wi">
            <td
              v-for="(day, di) in week"
              :key="di"
              :class="dayCellClass(day)"
              @click="day ? selectDay(day) : null"
            >
              <template v-if="day">
                <div class="cal-date-num">{{ parseInt(day.split('-')[2]) }}</div>
                <div class="cal-pnl" v-if="pnlHistory[day]">
                  {{ pnlHistory[day].total > 0 ? '+' : '' }}{{ fmt(pnlHistory[day].total) }}
                </div>
                <div class="cal-pnl no-data-pnl" v-else>0.00</div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Day Detail Panel (always visible, defaults to today) -->
    <div class="day-detail">
      <div class="day-detail-header">
        <span class="day-detail-title">当日盈亏明细</span>
        <span class="day-detail-date" v-if="selectedDay">{{ fmtMD(selectedDay) }}</span>
      </div>

      <template v-if="selectedDay && selectedDayFunds.length > 0">
        <div class="day-detail-list">
          <div
            v-for="(item, idx) in selectedDayFunds"
            :key="item.code + '_' + idx"
            class="day-rank-row"
          >
            <div class="day-rank-idx" :class="idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : ''">{{ idx + 1 }}</div>
            <div class="day-rank-name">{{ item.name }}</div>
            <div class="day-rank-bar-wrap">
              <div class="day-rank-bar" :style="{ width: barWidth(item) + '%', background: item.profit >= 0 ? 'var(--profit)' : 'var(--loss)' }"></div>
            </div>
            <div class="day-rank-amt" :style="{ color: item.profit >= 0 ? 'var(--profit)' : 'var(--loss)' }">
              {{ item.profit >= 0 ? '+' : '' }}{{ fmtNum(item.profit) }}
            </div>
          </div>
        </div>
        <div class="day-detail-total-row">
          <span class="muted">当日合计</span>
          <span
            class="day-detail-total"
            :class="selectedDayTotal > 0 ? 'profit' : selectedDayTotal < 0 ? 'loss' : 'neutral'"
          >
            {{ selectedDayTotal > 0 ? '+' : '' }}¥{{ fmtNum(selectedDayTotal) }} 元
          </span>
        </div>
      </template>

      <div class="day-detail-empty" v-else>
        <span class="muted">暂无数据，等待交易日确认净值后自动记录</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fmt, fmtNum, fmtMD, getTodayStr } from '@/utils/format'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})

const fundStore = useFundStore()
const watchStore = useWatchStore()

const pnlHistory = computed(() => fundStore.pnlHistory)

const today = computed(() => getTodayStr())
const todayDate = new Date()

const calYear = ref(todayDate.getFullYear())
const calMonth = ref(todayDate.getMonth())
const selectedDay = ref(getTodayStr())

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

// Reset selectedDay to today when this tab becomes active
watch(() => props.active, (val) => {
  if (val) {
    selectedDay.value = getTodayStr()
  }
})

function prevMonth() {
  if (calMonth.value === 0) {
    calMonth.value = 11
    calYear.value--
  } else {
    calMonth.value--
  }
  selectedDay.value = null
}

function nextMonth() {
  if (calMonth.value === 11) {
    calMonth.value = 0
    calYear.value++
  } else {
    calMonth.value++
  }
  selectedDay.value = null
}

function selectDay(dateStr) {
  selectedDay.value = selectedDay.value === dateStr ? null : dateStr
}

// Build the calendar weeks array for the current month
// Each week is an array of 7 items: date string (YYYY-MM-DD) or null for empty cells
const calendarWeeks = computed(() => {
  const year = calYear.value
  const month = calMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0, ... Sunday = 6
  let startDow = firstDay.getDay() // 0=Sun,1=Mon,...,6=Sat
  // Convert Sunday-based to Monday-based (Mon=0, ..., Sun=6)
  startDow = (startDow + 6) % 7

  const weeks = []
  let week = []

  // Fill leading empty cells
  for (let i = 0; i < startDow; i++) {
    week.push(null)
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr =
      year +
      '-' +
      String(month + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0')
    week.push(dateStr)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  // Fill trailing empty cells
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
})

function dayCellClass(day) {
  if (!day) return 'cal-cell cal-cell-empty'
  const classes = ['cal-cell']
  const rec = pnlHistory.value[day]
  if (!rec) {
    classes.push('no-data')
  } else if (rec.total > 0) {
    classes.push('profit-day')
  } else if (rec.total < 0) {
    classes.push('loss-day')
  } else {
    classes.push('no-data')
  }
  if (day === today.value) classes.push('is-today')
  if (day === selectedDay.value) classes.push('selected-day')
  return classes.join(' ')
}

const monthlyTotal = computed(() => {
  const year = calYear.value
  const month = calMonth.value
  const prefix =
    year + '-' + String(month + 1).padStart(2, '0')
  let total = 0
  for (const [date, rec] of Object.entries(pnlHistory.value)) {
    if (date.startsWith(prefix) && rec) total += rec.total || 0
  }
  return parseFloat(total.toFixed(2))
})

const monthlyTradingDays = computed(() => {
  const year = calYear.value
  const month = calMonth.value
  const prefix =
    year + '-' + String(month + 1).padStart(2, '0')
  return Object.keys(pnlHistory.value).filter(d => d.startsWith(prefix)).length
})

// 判断日期是否为交易日（周一~周五）
function isTradingDay(dateStr) {
  if (!dateStr) return false
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  return dow >= 1 && dow <= 5
}

// 今日特殊处理：用持仓基金实时数据计算盈亏（与原版一致）
const selectedDayFunds = computed(() => {
  if (!selectedDay.value) return []
  const todayStr = getTodayStr()

  // 今日 + 交易日：从持仓基金实时数据计算
  if (selectedDay.value === todayStr && isTradingDay(todayStr) && fundStore.funds.length > 0) {
    // 需要有实时估值或已确认净值才展示
    const hasAnyData = fundStore.funds.some(f =>
      (f.confirmedDate === todayStr && f.confirmedNav) ||
      (f.gztime && f.gztime.slice(0, 10) === todayStr && f.gsz != null)
    )
    if (!hasAnyData) return []

    const items = []
    for (const f of fundStore.funds) {
      const sh = f.holdingShares
      const prev = f.prevNav
      const todayNav = (f.confirmedDate === todayStr && f.confirmedNav) ? f.confirmedNav : f.gsz
      if (sh == null || sh <= 0 || prev == null || prev <= 0 || todayNav == null) continue
      const profit = parseFloat((sh * (todayNav - prev)).toFixed(2))
      items.push({ code: f.code, name: f.name || f.code, profit })
    }
    return [...items].sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
  }

  // 非今日 / 非交易日：从 pnlHistory 读取
  const rec = pnlHistory.value[selectedDay.value]
  if (!rec || !rec.funds) return []
  return [...rec.funds].sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
})

const selectedDayTotal = computed(() => {
  if (!selectedDay.value) return 0
  // 今日用实时计算的结果
  if (selectedDay.value === getTodayStr() && selectedDayFunds.value.length > 0) {
    return parseFloat(selectedDayFunds.value.reduce((s, x) => s + x.profit, 0).toFixed(2))
  }
  return pnlHistory.value[selectedDay.value]?.total ?? 0
})

function barWidth(item) {
  const maxAbs = Math.max(...selectedDayFunds.value.map(f => Math.abs(f.profit)), 1)
  return Math.round(Math.abs(item.profit) / maxAbs * 100)
}

async function handleRefresh() {
  await fundStore.refreshAll(watchStore)
  await fundStore.checkAndRecordPnl()
  window.$toast?.('已刷新并记录盈亏', 'success')
}

function handleClear() {
  if (!confirm('确定清空全部盈亏记录？此操作不可撤销。')) return
  fundStore.pnlHistory = {}
  fundStore.savePnl()
  selectedDay.value = null
  window.$toast?.('已清空盈亏记录', 'info')
}
</script>

<style scoped>
.pnl-calendar-view {
  padding: 12px 0;
}

.monthly-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 16px 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.summary-sep {
  color: var(--border);
}

.summary-item strong {
  color: var(--text-primary);
}

.calendar-wrapper {
  overflow-x: auto;
  padding: 0 8px;
}

.cal-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.cal-th {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 6px 0;
  font-weight: 500;
}

.cal-cell {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 4px 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  height: 60px;
  vertical-align: top;
  position: relative;
}

.cal-cell-empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
}

.cal-cell:not(.cal-cell-empty):hover {
  opacity: 0.85;
  border-color: var(--accent);
}

.cal-date-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.cal-pnl {
  font-size: 11px;
  font-weight: 500;
}

.no-data-pnl {
  color: var(--text-muted);
}

/* Chinese convention: profit = red, loss = green */
.profit-day {
  background: rgba(240, 64, 64, 0.15);
  border-color: rgba(240, 64, 64, 0.3);
}

.profit-day .cal-pnl {
  color: var(--profit);
}

.loss-day {
  background: rgba(34, 196, 94, 0.12);
  border-color: rgba(34, 196, 94, 0.3);
}

.loss-day .cal-pnl {
  color: var(--loss);
}

.no-data .cal-date-num {
  color: var(--text-muted);
}

.is-today {
  border-color: var(--accent) !important;
}

.is-today .cal-date-num {
  color: var(--accent);
}

.selected-day {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

/* Day Detail Panel */
.day-detail {
  margin: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.day-detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.day-detail-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.day-detail-date {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
}

.day-detail-total-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  margin-top: 4px;
  border-top: 1px solid var(--border);
  font-size: 13px;
}

.day-detail-total {
  font-size: 13px;
  font-weight: 700;
}

.day-detail-empty {
  padding: 20px;
  text-align: center;
}

.day-detail-list {
  margin: 0;
  padding: 0;
}

/* 日历明细排行行（与原版一致，带进度条） */
.day-rank-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.day-rank-row:last-child {
  border-bottom: none;
}

.day-rank-idx {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.day-rank-idx.r1 { color: #ffd700; }
.day-rank-idx.r2 { color: #c0c0c0; }
.day-rank-idx.r3 { color: #cd7f32; }

.day-rank-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  font-size: 13px;
}

.day-rank-bar-wrap {
  width: 60px;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.day-rank-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.day-rank-amt {
  font-size: 13px;
  font-weight: 600;
  min-width: 70px;
  text-align: right;
  flex-shrink: 0;
}

.fund-name {
  flex: 1;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fund-code {
  font-size: 11px;
  flex-shrink: 0;
}

.fund-profit {
  font-weight: 600;
  flex-shrink: 0;
}

/* Shared profit/loss/neutral colors */
.profit { color: var(--profit); }
.loss   { color: var(--loss); }
.neutral { color: var(--text-muted); }
.muted  { color: var(--text-muted); }

/* ── Mobile: 768px ── */
@media (max-width: 768px) {
  .monthly-summary { font-size: 11px; gap: 4px; padding: 4px 8px 8px; flex-wrap: wrap; justify-content: center; }
  .calendar-wrapper { padding: 0 2px; }
  .cal-th { font-size: 10px; padding: 4px 0; }
  .cal-cell { height: 48px; padding: 4px 2px 2px; border-radius: 4px; }
  .cal-day { font-size: 10px; }
  .cal-val { font-size: 10px; }
}
</style>
