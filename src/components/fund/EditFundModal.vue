<template>
  <BaseModal v-model="open" title="编辑持仓">
    <!-- 基金信息头 -->
    <div class="fund-label">
      <span class="result-code">{{ fund?.code }}</span>
      <span class="result-name" style="margin-left:8px;">{{ fund?.name || fund?.code }}</span>
      <span v-if="latestNav" style="margin-left:auto;color:var(--text-muted);font-size:12px;">
        最新净值 {{ latestNav }}
      </span>
    </div>

    <!-- 模式切换 -->
    <div class="mode-tabs">
      <button :class="['mode-tab', mode === 'shares' ? 'active' : '']" @click="mode = 'shares'">按份额</button>
      <button :class="['mode-tab', mode === 'amount' ? 'active' : '']" @click="mode = 'amount'">按金额</button>
    </div>

    <!-- 按份额 -->
    <div v-if="mode === 'shares'" class="form-fields">
      <div class="form-group">
        <label>持有份额</label>
        <input v-model.number="iShares" type="number" placeholder="例：3000" min="0" step="0.0001" />
      </div>
      <div class="form-group">
        <label>成本净值</label>
        <input v-model.number="iCostNav" type="number" :placeholder="latestNav || '自动获取'" step="0.0001" />
      </div>
      <div v-if="previewAmount" class="preview-line">
        预计持仓金额 <b>¥{{ previewAmount }}</b>
      </div>
    </div>

    <!-- 按金额 -->
    <div v-else class="form-fields">
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

    <!-- 标签 -->
    <div class="form-group" style="margin-top:4px;">
      <label>板块标签（选填）</label>
      <input v-model="iTag" type="text" maxlength="10" placeholder="例：CPO、黄金、AI算力" @keydown.enter="confirm" />
    </div>

    <template #footer>
      <button class="btn btn-cancel-modal" @click="open = false">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="confirm">
        <span v-if="saving" class="spinner"></span>
        <span v-else>保存</span>
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useFundStore } from '@/stores/fundStore'
import { fetchOne } from '@/services/fundApi'
import { fmt, getTodayStr } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fund: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

const fundStore = useFundStore()
const open = ref(props.modelValue)

watch(() => props.modelValue, v => {
  open.value = v
  if (v && props.fund) init()
})
watch(open, v => emit('update:modelValue', v))

const latestNav = ref(null)
const mode = ref('shares')
const iShares = ref(null)
const iCostNav = ref(null)
const iAmount = ref(null)
const iProfit = ref(null)
const iTag = ref('')
const saving = ref(false)

async function init() {
  const f = props.fund
  if (!f) return

  // 按份额模式预填
  mode.value = f.holdingShares > 0 ? 'shares' : 'amount'
  iShares.value = f.holdingShares ?? null
  iCostNav.value = f.costBasis ?? f.costNav ?? null
  iTag.value = f.tag || ''

  // 按金额模式预填：amount + 推算累计盈亏
  iAmount.value = f.amount ?? null
  const principal = (f.holdingShares > 0 && f.costBasis) ? f.holdingShares * f.costBasis : null
  iProfit.value = (principal && f.amount) ? parseFloat((f.amount - principal).toFixed(2)) : null

  // 异步获取最新净值（今日确认净值 > 今日估值 > 上次确认净值）
  latestNav.value = null
  try {
    const data = await fetchOne(f.code)
    const dwjz = data.dwjz ? parseFloat(data.dwjz) : null
    const gsz  = data.gsz  ? parseFloat(data.gsz)  : null
    const nav  = (data.jzrq === getTodayStr() && dwjz) ? dwjz
               : (gsz && gsz > 0) ? gsz
               : dwjz
    latestNav.value = nav ? fmt(nav, 4) : null
    if (nav && !iCostNav.value) iCostNav.value = nav
  } catch { /* 静默 */ }
}

// ── 预览 ──
const previewAmount = computed(() => {
  if (mode.value !== 'shares') return null
  const nav = iCostNav.value || parseFloat(latestNav.value)
  if (!iShares.value || !nav) return null
  return fmt(iShares.value * nav, 2)
})
const previewShares = computed(() => {
  if (mode.value !== 'amount') return null
  const nav = parseFloat(latestNav.value) || iCostNav.value
  if (!iAmount.value || !nav) return null
  return fmt(iAmount.value / nav, 2)
})
const previewCostNav = computed(() => {
  if (mode.value !== 'amount') return null
  const nav = parseFloat(latestNav.value) || iCostNav.value
  if (!iAmount.value || !nav) return null
  const profit = iProfit.value || 0
  const shares = iAmount.value / nav
  return shares ? fmt((iAmount.value - profit) / shares, 4) : null
})

// ── 保存 ──
async function confirm() {
  const f = props.fund
  if (!f) return
  const latestNavNum = parseFloat(latestNav.value) || null
  const tag = iTag.value.trim() || null

  let patch

  if (mode.value === 'shares') {
    const s = Number(iShares.value)
    if (!s || s <= 0) { window.$toast?.('请输入有效的持有份额', 'error'); return }
    const cn = Number(iCostNav.value) || latestNavNum
    if (!cn) { window.$toast?.('请输入成本净值', 'error'); return }
    const amount = parseFloat((s * (latestNavNum || cn)).toFixed(2))
    patch = {
      holdingShares: s, holdingSharesLocked: true,
      costBasis: cn, costBasisLocked: true,
      costNav: cn,
      amount, tag
    }
  } else {
    const a = Number(iAmount.value)
    if (!a || a <= 0) { window.$toast?.('请输入有效的持仓金额', 'error'); return }
    const nav = latestNavNum
    if (!nav) { window.$toast?.('未能获取净值，请稍后重试', 'error'); return }
    const profit = Number(iProfit.value) || 0
    const shares = parseFloat((a / nav).toFixed(4))
    const costNav = parseFloat(((a - profit) / shares).toFixed(4))
    patch = {
      amount: a,
      holdingShares: shares, holdingSharesLocked: false,
      costBasis: costNav, costBasisLocked: true,
      costNav, tag
    }
  }

  saving.value = true
  fundStore.updateFund(f.code, patch)
  fundStore.save()
  saving.value = false
  window.$toast?.('修改已保存', 'success')
  open.value = false
}
</script>

<style scoped>
.fund-label {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 13px;
}
.result-code {
  font-size: 12px;
  color: var(--text-muted);
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
.preview-line b { color: var(--text-primary); }
</style>
