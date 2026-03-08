<template>
  <BaseModal v-model="open" :title="isPrefillMode ? '快捷建仓' : step === 1 ? '搜索基金' : '持仓设置'">

    <!-- ── Step 1: 搜索（prefill 模式不显示）── -->
    <template v-if="step === 1 && !isPrefillMode">
      <div class="search-wrap">
        <input
          ref="searchInput"
          v-model="keyword"
          class="search-input"
          type="text"
          placeholder="输入基金代码或名称"
          autocomplete="off"
          @input="onInput"
        />
        <span v-if="searching" class="spinner search-spinner"></span>
      </div>

      <div class="search-results">
        <div v-if="!keyword.trim()" class="search-hint">请输入代码或名称关键词</div>
        <div v-else-if="searching && results.length === 0" class="search-hint">搜索中…</div>
        <div v-else-if="!searching && results.length === 0" class="search-hint">未找到相关基金</div>
        <div
          v-else
          v-for="r in results"
          :key="r.CODE"
          class="result-item"
          :class="{ selected: selected && selected.CODE === r.CODE }"
          @click="pickFund(r)"
        >
          <span class="result-code">{{ r.CODE }}</span>
          <span class="result-name">{{ r.NAME }}</span>
        </div>
      </div>
    </template>

    <!-- ── Step 2: 持仓设置 ── -->
    <template v-else-if="step === 2 || isPrefillMode">
      <div class="fund-label">
        <span class="result-code">{{ selected.CODE }}</span>
        <span class="result-name" style="margin-left:8px;">{{ selected.NAME }}</span>
        <span v-if="latestNav" style="margin-left:auto;color:var(--text-muted);font-size:12px;">
          最新净值 {{ latestNav }}
        </span>
      </div>

      <!-- 模式切换 -->
      <div class="mode-tabs">
        <button :class="['mode-tab', mode === 'amount' ? 'active' : '']" @click="mode = 'amount'">按金额</button>
        <button :class="['mode-tab', mode === 'shares' ? 'active' : '']" @click="mode = 'shares'">按份额</button>
      </div>

      <!-- 按金额 -->
      <div v-if="mode === 'amount'" class="form-fields">
        <div class="form-group">
          <label>持仓总金额（元）</label>
          <input v-model.number="iAmount" type="number" placeholder="例：10000" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label>累计盈亏（元，选填）</label>
          <input v-model.number="iProfit" type="number" placeholder="亏损填负数，如 -500" step="0.01" />
        </div>
        <div v-if="previewShares" class="preview-line">
          预计份额 <b>{{ previewShares }}</b>，成本净值 <b>{{ previewCostNav }}</b>
        </div>
      </div>

      <!-- 按份额 -->
      <div v-else class="form-fields">
        <div class="form-group">
          <label>持有份额</label>
          <input v-model.number="iShares" type="number" placeholder="例：3000" min="0" step="0.0001" />
        </div>
        <div class="form-group">
          <label>成本净值（默认用最新净值）</label>
          <input v-model.number="iCostNav" type="number" :placeholder="latestNav || '自动获取'" step="0.0001" />
        </div>
        <div v-if="previewAmount" class="preview-line">
          预计持仓金额 <b>¥{{ previewAmount }}</b>
        </div>
      </div>

      <!-- 共用标签 -->
      <div class="form-group" style="margin-top:4px;">
        <label>标签（选填，多个用逗号分隔）</label>
        <input v-model="iTag" type="text" placeholder="例：指数、科技板块（添加后可继续编辑）" @keydown.enter="confirm" />
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <button class="btn btn-cancel-modal" @click="onCancel">{{ (step === 1 && !isPrefillMode) ? '取消' : isPrefillMode ? '取消' : '返回' }}</button>
      <button v-if="step === 1 && !isPrefillMode" class="btn btn-primary" :disabled="!selected" @click="goStep2">
        下一步
      </button>
      <button v-else class="btn btn-primary" :disabled="confirmLoading" @click="confirm">
        <span v-if="confirmLoading" class="spinner"></span>
        <span v-else>添加</span>
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { searchFunds, fetchOne } from '@/services/fundApi'
import { fmt } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  prefill: { type: Object, default: null }  // { code, name } 跳过搜索步骤
})
const emit = defineEmits(['update:modelValue', 'added'])

const isPrefillMode = computed(() => !!props.prefill)

const fundStore = useFundStore()
const watchStore = useWatchStore()

const open = ref(props.modelValue)
watch(() => props.modelValue, v => {
  open.value = v
  if (v) reset()
})
watch(open, v => emit('update:modelValue', v))
watch(() => props.prefill, v => {
  if (v && open.value) reset()
})

// ── state ──
const step = ref(1)
const keyword = ref('')
const results = ref([])
const searching = ref(false)
const selected = ref(null)
const latestNav = ref(null)
const mode = ref('amount')

const iAmount = ref(null)
const iProfit = ref(null)
const iShares = ref(null)
const iCostNav = ref(null)
const iTag = ref('')
const confirmLoading = ref(false)

const searchInput = ref(null)
let _searchTimer = null

function reset() {
  keyword.value = ''
  results.value = []
  latestNav.value = null
  mode.value = 'amount'
  iAmount.value = null
  iProfit.value = null
  iShares.value = null
  iCostNav.value = null
  iTag.value = ''
  if (props.prefill) {
    // prefill 模式：直接设置 selected，进入 step 2
    selected.value = { CODE: props.prefill.code, NAME: props.prefill.name }
    step.value = 2
    // 异步获取最新净值
    fetchOne(props.prefill.code).then(data => {
      const gszNum = parseFloat(data.gsz)
      const nav = (gszNum > 0) ? gszNum : (data.dwjz ? parseFloat(data.dwjz) : null)
      latestNav.value = nav ? fmt(nav, 4) : null
      if (nav && !iCostNav.value) iCostNav.value = nav
    }).catch(() => {})
  } else {
    step.value = 1
    selected.value = null
    nextTick(() => searchInput.value?.focus())
  }
}

// ── 搜索 ──
function onInput() {
  selected.value = null
  if (_searchTimer) clearTimeout(_searchTimer)
  if (!keyword.value.trim()) { results.value = []; return }
  searching.value = true
  _searchTimer = setTimeout(async () => {
    try {
      results.value = await searchFunds(keyword.value)
    } finally {
      searching.value = false
    }
  }, 300)
}

function pickFund(r) {
  selected.value = r
}

// ── Step 2 ──
async function goStep2() {
  if (!selected.value) return
  step.value = 2
  latestNav.value = null
  try {
    const data = await fetchOne(selected.value.CODE)
    const gszNum = parseFloat(data.gsz)
    const nav = (gszNum > 0) ? gszNum : (data.dwjz ? parseFloat(data.dwjz) : null)
    latestNav.value = nav ? fmt(nav, 4) : null
    if (nav && !iCostNav.value) iCostNav.value = nav
  } catch { /* 静默，允许手动输入 */ }
}

// ── 预览计算 ──
const previewShares = computed(() => {
  if (mode.value !== 'amount') return null
  const nav = iCostNav.value || parseFloat(latestNav.value)
  if (!iAmount.value || !nav) return null
  return fmt(iAmount.value / nav, 2)
})
const previewCostNav = computed(() => {
  if (mode.value !== 'amount') return null
  const nav = parseFloat(latestNav.value) || iCostNav.value
  if (!iAmount.value || !nav) return null
  const profit = iProfit.value || 0
  const shares = iAmount.value / nav
  if (!shares) return null
  return fmt((iAmount.value - profit) / shares, 4)
})
const previewAmount = computed(() => {
  if (mode.value !== 'shares') return null
  const nav = iCostNav.value || parseFloat(latestNav.value)
  if (!iShares.value || !nav) return null
  return fmt(iShares.value * nav, 2)
})

// ── 确认 ──
async function confirm() {
  if (!selected.value) return
  const code = selected.value.CODE
  // 将逗号/顿号分隔的标签字符串转为数组
  const tags = iTag.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
  const latestNavNum = parseFloat(latestNav.value) || null

  let amount, costNavVal, holdingShares, holdingSharesLocked

  if (mode.value === 'amount') {
    const a = Number(iAmount.value)
    if (!a || a <= 0) { window.$toast?.('请输入有效的持仓金额', 'error'); return }
    amount = a
    const nav = latestNavNum
    if (!nav) { window.$toast?.('未能获取净值，请稍后重试', 'error'); return }
    const profit = Number(iProfit.value) || 0
    const shares = parseFloat((a / nav).toFixed(4))
    const costNav = parseFloat(((a - profit) / shares).toFixed(4))
    costNavVal = costNav
    holdingShares = shares
    holdingSharesLocked = false   // 等确认净值后再锁定
  } else {
    const s = Number(iShares.value)
    if (!s || s <= 0) { window.$toast?.('请输入有效的持有份额', 'error'); return }
    const cn = Number(iCostNav.value) || latestNavNum
    if (!cn) { window.$toast?.('未能获取净值，请手动填入成本净值', 'error'); return }
    holdingShares = s
    costNavVal = cn
    holdingSharesLocked = true
    amount = parseFloat((s * (latestNavNum || cn)).toFixed(2))
  }

  confirmLoading.value = true
  const added = fundStore.addFund({ code, amount, tags, costNav: costNavVal, holdingShares, holdingSharesLocked })
  if (!added) {
    window.$toast?.('该基金已在持仓列表中', 'error')
    confirmLoading.value = false
    return
  }
  // 如果自选中不存在该基金，自动加入自选（会出现在「已持仓」分组）
  const fundName = selected.value?.NAME || selected.value?.name || code
  if (!watchStore.watchlist.some(w => w.code === code)) {
    watchStore.addWatch({ code, name: fundName })
  }
  try {
    await fundStore.refreshAll(watchStore)
    window.$toast?.('基金添加成功', 'success')
    open.value = false
    emit('added')
  } catch {
    window.$toast?.('添加成功，但刷新数据失败', 'error')
    open.value = false
    emit('added')
  } finally {
    confirmLoading.value = false
  }
}

function onCancel() {
  if (isPrefillMode.value) {
    open.value = false
  } else if (step.value === 2) {
    step.value = 1
  } else {
    open.value = false
  }
}
</script>

<style scoped>
.search-wrap {
  position: relative;
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  padding-right: 36px;
}
.search-spinner {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
}
.search-results {
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
}
.search-hint {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.12s;
}
.result-item:last-child { border-bottom: none; }
.result-item:hover, .result-item.selected {
  background: rgba(99, 102, 241, 0.12);
}
.result-code {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 52px;
  font-family: monospace;
}
.result-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fund-label {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 13px;
}
.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.mode-tab {
  flex: 1;
  padding: 8px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-tab.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #a5b4fc;
  font-weight: 500;
}
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview-line {
  font-size: 12px;
  color: var(--text-muted);
  padding: 6px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
}
.preview-line b {
  color: var(--text-primary);
}
</style>
