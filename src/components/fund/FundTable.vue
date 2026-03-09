<template>
  <div>
    <!-- Table -->
    <div class="table-wrapper">
      <div class="table-scroll">
        <table style="table-layout:fixed;" :style="tableStyle">
          <thead>
            <tr>
              <th
                v-for="(col, idx) in columns"
                :key="idx"
                :style="{ width: colWidths[idx] ? colWidths[idx] + 'px' : col.defaultWidth }"
              >
                {{ col.label }}
                <span
                  class="col-resizer"
                  :class="{ dragging: resizingCol === idx }"
                  @mousedown.prevent="startResize($event, idx)"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Empty state -->
            <tr v-if="fundStore.funds.length === 0">
              <td :colspan="columns.length">
                <div class="empty-state">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                  <p>暂无持仓基金<br>点击上方「添加基金」开始记录</p>
                </div>
              </td>
            </tr>

            <!-- Fund rows -->
            <template v-for="f in fundStore.funds" :key="f.code">
            <tr
              class="fund-row"
              :class="{ 'row-expanded': expandedCode === f.code }"
              @click="toggleExpand(f.code)"
            >

              <!-- Col 0: 基金名称 -->
              <td style="text-align:left;">
                <div class="fund-name">
                  <span
                    class="fund-name-text"
                    :title="f.name || f.code"
                  >{{ f.name || f.code }}</span>
                  <template v-if="f.tags && f.tags.length > 0">
                    <span
                      v-for="t in f.tags"
                      :key="t"
                      class="fund-tag"
                      title="点击管理标签"
                      @click.stop="openTagModal(f)"
                    >{{ t }}</span>
                    <span class="fund-tag-add" title="管理标签" @click.stop="openTagModal(f)">✎</span>
                  </template>
                  <span
                    v-else
                    class="fund-tag-add"
                    @click.stop="openTagModal(f)"
                  >+ 标签</span>
                </div>
                <div class="fund-meta">
                  {{ f.code }}
                  <template v-if="!f.loading">
                    <span v-if="!f.navConfirmed && f.gztime" style="color:var(--text-muted);font-size:11px;">
                      &nbsp;·&nbsp;估值 {{ fmtMD(getTodayStr()) }}
                    </span>
                    <span v-if="f.navConfirmed" class="conf-badge" style="margin-left:4px;">
                      ✓ 已出净值
                    </span>
                    <span v-else-if="f.confirmedDate || f.jzrq" style="color:var(--text-muted);font-size:11px;margin-left:4px;">
                      净值 {{ fmtMD(f.confirmedDate || f.jzrq) }}
                    </span>
                  </template>
                </div>
              </td>

              <!-- Col 1: 持仓金额 -->
              <td :class="{ masked: props.hiddenCols.amount }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <span v-else>{{ getHoldingAmount(f) != null ? '¥' + fmt(getHoldingAmount(f), 2) : '--' }}</span>
              </td>

              <!-- Col 2: 涨跌幅 · 净值（合并列） -->
              <td :class="{ masked: props.hiddenCols.changenav }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <template v-else>
                  <div class="two-line-cell">
                    <span
                      v-if="getDisplayChangeRate(f) !== null"
                      :class="changePillClass(getDisplayChangeRate(f))"
                      class="cell-main"
                    >
                      {{ getDisplayChangeRate(f) > 0 ? '+' : '' }}{{ fmt(getDisplayChangeRate(f), 2) }}%
                    </span>
                    <span v-else class="neutral cell-main">--</span>
                    <span class="cell-sub cell-sub-muted">{{ getDisplayNav(f) != null ? fmt(getDisplayNav(f), 4) : '--' }}</span>
                  </div>
                </template>
              </td>

              <!-- Col 3: 盈亏（今日/昨日/MM-DD） -->
              <td :class="{ masked: props.hiddenCols.profit }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <template v-else>
                  <div class="two-line-cell">
                    <span :class="profitClass(getDisplayProfit(f).value)" class="cell-main">
                      {{ getDisplayProfit(f).value >= 0 ? '+' : '-' }}{{ fmtNum(Math.abs(getDisplayProfit(f).value)) }}
                    </span>
                    <span class="cell-sub cell-sub-muted">{{ getDisplayProfit(f).label }}</span>
                  </div>
                </template>
              </td>

              <!-- Col 4: 持有收益（金额在上 + 收益率在下） -->
              <td :class="{ masked: props.hiddenCols.holdprofit }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <template v-else>
                  <div class="two-line-cell">
                    <span v-if="getAccumProfit(f) !== null" :class="profitClass(getAccumProfit(f))" class="cell-main">
                      {{ getAccumProfit(f) >= 0 ? '+' : '-' }}{{ fmtNum(Math.abs(getAccumProfit(f))) }}
                    </span>
                    <span v-else class="neutral cell-main">--</span>
                    <span v-if="getAccumRate(f) !== null" :class="profitClass(getAccumProfit(f))" class="cell-sub">
                      {{ getAccumRate(f) >= 0 ? '+' : '' }}{{ fmt(getAccumRate(f), 2) }}%
                    </span>
                    <span v-else class="neutral cell-sub">--</span>
                  </div>
                </template>
              </td>

              <!-- Col 6: 持仓份额 -->
              <td :class="{ masked: props.hiddenCols.shares }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <span v-else>
                  {{ f.holdingShares != null ? fmt(f.holdingShares, 2) : '待刷新' }}
                  <span v-if="f.holdingSharesLocked" style="margin-left:4px;color:var(--text-muted);font-size:10px;">🔒</span>
                  <span v-else-if="f.holdingShares != null" style="margin-left:4px;color:var(--text-muted);font-size:10px;">预估</span>
                </span>
              </td>

              <!-- Col 7: 持仓成本 -->
              <td :class="{ masked: props.hiddenCols.cost }">
                <span v-if="f.loading"><span class="skel"></span></span>
                <span v-else>
                  {{ f.costBasis != null ? fmt(f.costBasis, 4) : '待刷新' }}
                  <span v-if="f.costBasisLocked" style="margin-left:4px;color:var(--text-muted);font-size:10px;">🔒</span>
                  <span v-else-if="f.costBasis != null" style="margin-left:4px;color:var(--text-muted);font-size:10px;">预估</span>
                </span>
              </td>

              <!-- Col 8: 操作 -->
              <td @click.stop>
                <div class="op-btns">
                  <button class="btn btn-edit" @click.stop="openEdit(f)">编辑</button>
                  <button class="btn btn-remove" @click.stop="removeFund(f.code)">删除</button>
                </div>
              </td>
            </tr>

            <!-- Expand row -->
            <tr v-if="expandedCode === f.code" class="expand-row">
              <td :colspan="columns.length" style="padding:0;background:var(--bg-secondary);">
                <FundExpandPanel :code="f.code" :item="f" />
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tag Modal -->
    <TagModal
      v-model="tagModalOpen"
      :initial-tags="tagModalInitialTags"
      @confirm="onTagConfirm"
    />

    <!-- Edit Modal -->
    <EditFundModal
      v-model="editModalOpen"
      :fund="editingFund"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { fmt, fmtNum, fmtMD, getTodayStr } from '@/utils/format'
import TagModal from '@/components/common/TagModal.vue'
import FundExpandPanel from '@/components/fund/FundExpandPanel.vue'
import EditFundModal from '@/components/fund/EditFundModal.vue'


const props = defineProps({
  hiddenCols: { type: Object, default: () => ({}) }
})

const fundStore = useFundStore()

// ── Row expand ──
const expandedCode = ref(null)
function toggleExpand(code) {
  expandedCode.value = expandedCode.value === code ? null : code
}

// ── Column definitions ──
const columns = [
  { label: '基金名称',      defaultWidth: '180px' },
  { label: '持仓金额',      defaultWidth: '110px' },
  { label: '涨跌幅 · 净值', defaultWidth: '120px' },
  { label: '盈亏',          defaultWidth: '110px' },
  { label: '持有收益',      defaultWidth: '120px' },
  { label: '持仓份额',      defaultWidth: '105px' },
  { label: '持仓成本',      defaultWidth: '110px' },
  { label: '操作',          defaultWidth: '160px' },
]

// ── Column resize ──
const COL_WIDTHS_KEY = 'fund_col_widths'
const colWidths = ref((() => {
  try { return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) || '{}') } catch { return {} }
})())
const resizingCol = ref(null)
let _resizeStartX = 0
let _resizeStartW = 0

function startResize(e, idx) {
  resizingCol.value = idx
  _resizeStartX = e.clientX
  const thList = document.querySelectorAll('.table-scroll table thead th')
  _resizeStartW = thList[idx] ? thList[idx].offsetWidth : 100

  function onMove(ev) {
    const delta = ev.clientX - _resizeStartX
    const newW = Math.max(60, _resizeStartW + delta)
    colWidths.value = { ...colWidths.value, [idx]: newW }
  }
  function onUp() {
    resizingCol.value = null
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths.value))
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const tableStyle = computed(() => {
  const totalW = columns.reduce((sum, col, idx) => {
    return sum + (colWidths.value[idx] || parseInt(col.defaultWidth))
  }, 0)
  return { minWidth: totalW + 'px' }
})

// ── Edit modal ──
const editModalOpen = ref(false)
const editingFund = ref(null)

function openEdit(f) {
  editingFund.value = f
  editModalOpen.value = true
}

function removeFund(code) {
  if (!confirm('确认删除该基金？')) return
  fundStore.removeFund(code)
  window.$toast?.('基金已删除', 'success')
}

// ── Tag modal ──
const tagModalOpen = ref(false)
const tagModalInitialTags = ref([])
const tagModalCode = ref('')

function openTagModal(f) {
  tagModalCode.value = f.code
  tagModalInitialTags.value = [...(f.tags || [])]
  tagModalOpen.value = true
}

function onTagConfirm(tags) {
  fundStore.updateFund(tagModalCode.value, { tags })
  fundStore.save()
}

// ── Calculation helpers ──

/** 今日是否有实时估值（gztime 为今天） */
function isLiveEstimate(f) {
  return !!(f.gztime && f.gztime.slice(0, 10) === getTodayStr())
}

/** 今日是否已出确认净值 */
function isConfirmedToday(f) {
  return !!(f.navConfirmed && f.confirmedDate === getTodayStr())
}

/** 当前有效净值：今日已确认 > 今日估值 > null（非交易日不返回旧数据） */
function getCurrentNav(f) {
  if (isConfirmedToday(f)) return f.confirmedNav
  if (isLiveEstimate(f)) return f.gsz
  return null
}

/** 今日持仓金额：优先 shares × 当前净值，兜底用存储的 amount */
function getHoldingAmount(f) {
  if (f.holdingShares > 0) {
    const nav = getCurrentNav(f) ?? f.confirmedNav ?? f.prevNav
    if (nav) return parseFloat((f.holdingShares * nav).toFixed(2))
  }
  return f.amount ?? null
}

/**
 * 涨跌幅·净值 合并列：
 *   优先今日实时/已确认数据，无今日数据时用最后两个确认净值计算
 */
function getDisplayChangeRate(f) {
  const r = getChangeRate(f)
  if (r !== null) return r
  // 历史：用最新确认净值 vs 倒数第二个确认净值（均来自 pingzhongdata trend）
  if (f.confirmedNav && f.prevNav && f.prevNav > 0) {
    return parseFloat(((f.confirmedNav - f.prevNav) / f.prevNav * 100).toFixed(4))
  }
  return null
}

function getDisplayNav(f) {
  if (isConfirmedToday(f)) return f.confirmedNav
  if (isLiveEstimate(f)) return f.gsz
  // 历史最后确认净值
  return f.confirmedNav ?? f.prevNav ?? null
}

/**
 * 盈亏显示：
 *   有今日净值 → 今日盈亏（交易日内 0 也显示），label = "今日"
 *   无今日净值 → 用 confirmedNav - prevNav 实时计算最后交易日盈亏
 *     label: confirmedDate = 昨天 → "昨日"；否则显示具体日期如 "3.06"
 */
function getDisplayProfit(f) {
  const hasTodayNav = isConfirmedToday(f) || isLiveEstimate(f)
  if (hasTodayNav) {
    return { value: getTodayProfit(f) ?? 0, label: '今日盈亏' }
  }
  // 最后一个交易日盈亏：shares × (confirmedNav - prevNav)
  const shares = getShares(f)
  if (shares > 0 && f.confirmedNav && f.prevNav && f.prevNav > 0) {
    const profit = parseFloat(((f.confirmedNav - f.prevNav) * shares).toFixed(2))
    return { value: profit, label: _profitDateLabel(f.confirmedDate) }
  }
  return { value: 0, label: _profitDateLabel(f.confirmedDate) }
}

/** 根据 confirmedDate 生成盈亏标签："今日"/"昨日"/"M.DD"
 *  全程使用本地时间（与 getTodayStr 保持一致，避免 UTC 时区偏差）
 */
function _profitDateLabel(dateStr) {
  if (!dateStr) return '--'
  const todayStr = getTodayStr()                    // 本地 YYYY-MM-DD
  const [y, m, d] = todayStr.split('-').map(Number)
  const prevDay = new Date(y, m - 1, d - 1)         // 本地昨天
  const yesterdayStr =
    prevDay.getFullYear() + '-' +
    String(prevDay.getMonth() + 1).padStart(2, '0') + '-' +
    String(prevDay.getDate()).padStart(2, '0')
  if (dateStr === yesterdayStr) return '昨日盈亏'
  // MM-DD 格式：取 YYYY-MM-DD 的后5位，如 "03-06"
  return dateStr.slice(5) + '盈亏'                  // e.g. "03-06盈亏"
}

/** 今日涨跌幅：仅在有今日数据时返回，否则 null */
function getChangeRate(f) {
  if (isConfirmedToday(f) && f.confirmedNav && f.prevNav) {
    return parseFloat(((f.confirmedNav - f.prevNav) / f.prevNav * 100).toFixed(4))
  }
  if (isLiveEstimate(f)) {
    // gszzl=0 时 API 可能是未刷新的默认值，优先用 gsz/prevNav 自算
    if (f.gszzl && !isNaN(f.gszzl)) return f.gszzl
    if (f.gsz != null && f.prevNav && f.prevNav > 0) {
      return parseFloat(((f.gsz - f.prevNav) / f.prevNav * 100).toFixed(4))
    }
  }
  return null
}

function getShares(f) {
  const costNav = f.costNav || f.prevNav
  if (f.holdingShares !== null && f.holdingShares > 0) return f.holdingShares
  if (costNav && f.amount) return f.amount / costNav
  return 0
}

function getTodayProfit(f) {
  const currentNav = getCurrentNav(f)
  if (currentNav == null) return null
  const shares = getShares(f)
  if (!shares) return null
  // 盘中实时估值：优先用 gszzl 推算昨日净值，与涨跌幅展示保持一致
  // 避免因 prevNav 被误写为持仓成本而导致盈亏与涨跌幅方向矛盾
  if (isLiveEstimate(f) && f.gszzl && !isNaN(f.gszzl)) {
    const impliedPrevNav = currentNav / (1 + f.gszzl / 100)
    return (currentNav - impliedPrevNav) * shares
  }
  if (!f.prevNav) return null
  return (currentNav - f.prevNav) * shares
}

function getAccumProfit(f) {
  const costNav = f.costNav || f.prevNav
  const costBasisNav = (f.costBasisLocked && f.costBasis !== null && f.costBasis > 0)
    ? f.costBasis : costNav
  // 优先：今日实时 > 最新已确认 > 昨日净值
  const navForAccum = getCurrentNav(f) ?? f.confirmedNav ?? f.prevNav ?? null
  if (!navForAccum || !costBasisNav) return null
  const accumShares = (f.holdingShares !== null && f.holdingShares > 0)
    ? f.holdingShares : (f.amount / (costBasisNav || costNav))
  if (!accumShares) return null
  return accumShares * (navForAccum - costBasisNav)
}

function getAccumRate(f) {
  const accum = getAccumProfit(f)
  if (accum === null) return null
  const costNav = f.costNav || f.prevNav
  const costBasisNav = (f.costBasisLocked && f.costBasis !== null && f.costBasis > 0)
    ? f.costBasis : costNav
  const accumShares = (f.holdingShares !== null && f.holdingShares > 0)
    ? f.holdingShares : (f.amount / (costBasisNav || costNav))
  const costTotal = accumShares * (costBasisNav || costNav)
  if (!costTotal || costTotal <= 0) return null
  return (accum / costTotal) * 100
}


// ── CSS class helpers ──
function profitClass(val) {
  if (val === null || val === undefined) return 'neutral'
  return val > 0 ? 'profit' : val < 0 ? 'loss' : 'neutral'
}

function changePillClass(val) {
  if (val === null || val === undefined) return 'neutral'
  return val > 0 ? 'profit' : val < 0 ? 'loss' : 'neutral'
}

function navClass(f) {
  if (isConfirmedToday(f)) return 'loss'
  return 'neutral'
}
</script>

<style scoped>
.fund-row {
  cursor: pointer;
  transition: background 0.12s;
}
.fund-row:hover,
.fund-row.row-expanded {
  background: rgba(255, 255, 255, 0.03);
}
.expand-row td {
  padding: 0;
}

/* 双行单元格：主值大字 + 副标签小字右下角 */
.two-line-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.cell-main {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
}
.cell-sub {
  font-size: 11px;
  line-height: 1.2;
}
.cell-sub-muted {
  color: var(--text-secondary);
}
</style>
