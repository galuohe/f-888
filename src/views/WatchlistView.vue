<template>
  <div>
    <!-- Actions Bar -->
    <div class="actions-bar">
      <div class="fund-count">共 <span>{{ watchStore.watchlist.length }}</span> 只基金</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span :class="marketBadge.cls">
          <span class="badge-dot"></span>
          {{ marketBadge.label }}
        </span>
        <button class="btn btn-add-open" @click="showAddModal = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          添加自选
        </button>
        <button
          class="btn btn-refresh"
          :disabled="fundStore.isRefreshing"
          @click="handleRefresh"
        >
          <span v-if="fundStore.isRefreshing">刷新中…</span>
          <span v-else>刷新行情</span>
        </button>
      </div>
    </div>

    <!-- 分组 Tab 栏 -->
    <div class="group-tabs">
      <button
        v-for="g in groupTabs"
        :key="g.key"
        class="group-tab"
        :class="{ active: activeGroup === g.key }"
        @click="activeGroup = g.key"
      >{{ g.label }}</button>
      <button class="group-tab group-tab-add" title="新建分组" @click="showNewGroupModal = true">+</button>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-if="watchStore.watchlist.length === 0">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="2" y="3" width="20" height="18" rx="2.5"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
      <p>暂无自选基金<br>点击上方「添加自选」开始记录</p>
    </div>
    <div v-else-if="sortedFilteredWatchlist.length === 0" style="padding:24px 0;text-align:center;color:var(--text-muted);font-size:13px;">
      该分组暂无基金
      <span v-if="activeGroup !== 'all' && activeGroup !== 'holding'">
        — <button class="btn-link" @click="showAddToGroupModal = true">添加基金到此分组</button>
      </span>
    </div>

    <!-- Table -->
    <div class="table-wrapper" v-else>
      <div class="table-scroll">
        <table style="table-layout:fixed;min-width:580px;">
          <thead>
            <tr>
              <th style="width:52px;">排名<span class="col-resizer"></span></th>
              <th>基金<span class="col-resizer"></span></th>
              <th class="th-sort" @click="toggleSort" style="cursor:pointer;">
                涨跌幅
                <span class="sort-arrows">
                  <button class="arr" :class="{ active: !watchStore.sortDesc }" @click.stop="setSortAsc">▲</button>
                  <button class="arr" :class="{ active: watchStore.sortDesc }" @click.stop="setSortDesc">▼</button>
                </span>
                <span class="col-resizer"></span>
              </th>
              <th>净值<span class="col-resizer"></span></th>
              <th>操作<span class="col-resizer"></span></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(item, idx) in sortedFilteredWatchlist" :key="item.code">
              <tr
                style="cursor:pointer;"
                :class="{ 'row-expanded': expandedCode === item.code }"
                @click="toggleExpand(item.code)"
              >
                <!-- 排名 -->
                <td style="text-align:center;">
                  <span class="rank-badge" :class="idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : ''">
                    {{ idx + 1 }}
                  </span>
                </td>

                <!-- 基金名+代码 -->
                <td style="text-align:left;">
                  <div class="fund-name">
                    <span class="fund-name-text" :title="item.name">{{ item.name || item.code }}</span>
                    <!-- 持仓标识 -->
                    <span v-if="isHolding(item.code)" class="holding-badge">持仓</span>
                    <!-- 标签（多标签数组） -->
                    <template v-if="item.tags && item.tags.length > 0">
                      <span
                        v-for="t in item.tags"
                        :key="t"
                        class="fund-tag"
                        title="点击管理标签"
                        @click.stop="openTagModal(item)"
                      >{{ t }}</span>
                      <span class="fund-tag-add" title="管理标签" @click.stop="openTagModal(item)">✎</span>
                    </template>
                    <span v-else class="fund-tag-add" @click.stop="openTagModal(item)">+ 标签</span>
                  </div>
                  <div class="fund-meta">
                    <span>{{ item.code }}</span>
                    <span v-if="isConfirmedToday(item)" class="conf-badge" style="margin-left:4px;">✓ 已出净值</span>
                    <span v-else-if="isLiveEstimate(item)" class="est-badge" style="margin-left:4px;">盘中估值</span>
                    <span v-else-if="item.confirmedDate || item.jzrq" style="color:var(--text-muted);font-size:11px;margin-left:4px;">
                      净值 {{ fmtMD(item.confirmedDate || item.jzrq) }}
                    </span>
                  </div>
                </td>

                <!-- 涨跌幅 -->
                <td>
                  <span v-if="item.loading"><span class="skel"></span></span>
                  <span v-else-if="item.error" class="neutral">--</span>
                  <span v-else class="change-pill" :class="changeClass(getDisplayChangeRate(item))">
                    {{ formatChange(getDisplayChangeRate(item)) }}
                  </span>
                </td>

                <!-- 净值 -->
                <td>
                  <span v-if="item.loading"><span class="skel"></span></span>
                  <span v-else-if="item.error" style="color:var(--text-muted);font-size:12px;">获取失败</span>
                  <template v-else>
                    <div class="two-line-cell">
                      <span class="neutral cell-main">{{ getDisplayNav(item) != null ? fmt(getDisplayNav(item), 4) : '--' }}</span>
                      <span v-if="getDisplayNav(item) != null" class="cell-sub cell-sub-muted">
                        {{ getNavSourceLabel(item) }} {{ fmtMD(getNavDate(item)) }}
                      </span>
                    </div>
                  </template>
                </td>

                <!-- 操作 -->
                <td @click.stop>
                  <div class="row-actions">
                    <!-- 分组管理按钮 -->
                    <button
                      class="btn btn-group-assign"
                      :class="{ 'has-groups': item.groups && item.groups.length > 0 }"
                      :title="item.groups && item.groups.length > 0 ? '所属分组：' + item.groups.join('、') : '添加到分组'"
                      @click="openGroupModal(item)"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span v-if="item.groups && item.groups.length > 0" class="group-count-dot">{{ item.groups.length }}</span>
                    </button>
                    <!-- 快捷建仓 -->
                    <button
                      class="btn btn-build"
                      :disabled="isHolding(item.code)"
                      :title="isHolding(item.code) ? '已持仓' : '快捷建仓'"
                      @click="handleBuild(item)"
                    >建仓</button>
                    <!-- 移除 -->
                    <button class="btn btn-remove" @click="handleRemove(item.code)">移除</button>
                  </div>
                </td>
              </tr>

              <!-- Expanded Row -->
              <tr v-if="expandedCode === item.code">
                <td colspan="5" style="padding:0;background:var(--bg-secondary);">
                  <FundExpandPanel :code="item.code" :item="item" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加自选 Modal -->
    <BaseModal v-model="showAddModal" title="添加自选">
      <div class="search-wrap">
        <input
          v-model="addKeyword"
          class="search-input"
          type="text"
          placeholder="输入基金代码或名称"
          autocomplete="off"
          @input="onAddInput"
        />
        <span v-if="addSearching" class="spinner search-spinner"></span>
      </div>
      <div v-if="addError" style="color:var(--profit);font-size:12px;margin:8px 0 0;">{{ addError }}</div>
      <div class="search-results">
        <div v-if="!addKeyword.trim()" class="search-hint">请输入代码或名称关键词</div>
        <div v-else-if="addSearching && addResults.length === 0" class="search-hint">搜索中…</div>
        <div v-else-if="!addSearching && addResults.length === 0" class="search-hint">未找到相关基金</div>
        <div
          v-else
          v-for="r in addResults"
          :key="r.CODE"
          class="result-item"
          @click="pickWatchFund(r)"
        >
          <span class="result-code">{{ r.CODE }}</span>
          <span class="result-name">{{ r.NAME }}</span>
        </div>
      </div>
    </BaseModal>

    <!-- 新建分组 Modal -->
    <BaseModal v-model="showNewGroupModal" title="新建分组">
      <div class="form-group">
        <label>分组名称</label>
        <input
          v-model="newGroupName"
          type="text"
          placeholder="如：大盘指数、科技主题、黄金"
          maxlength="10"
          @keyup.enter="handleAddGroup"
        />
      </div>
      <div v-if="newGroupError" style="color:var(--profit);font-size:12px;margin-bottom:12px;">{{ newGroupError }}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button class="btn btn-cancel-modal" @click="showNewGroupModal = false">取消</button>
        <button class="btn btn-primary" @click="handleAddGroup">创建</button>
      </div>
    </BaseModal>

    <!-- 标签编辑 Modal（与持仓一致） -->
    <TagModal
      v-model="tagModalOpen"
      :initial-tags="tagModalInitialTags"
      @confirm="onTagConfirm"
    />

    <!-- 分组归属 Modal -->
    <BaseModal v-model="groupModalOpen" title="管理分组">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
        选择此基金所属分组（可多选）
      </p>
      <!-- 分组列表 -->
      <div class="group-select-list">
        <p v-if="watchStore.groups.length === 0" class="group-empty-hint">
          暂无分组，请在下方新建
        </p>
        <label v-for="g in watchStore.groups" :key="g" class="group-select-item">
          <input type="checkbox" :value="g" v-model="groupModalSelected" />
          <span class="group-select-label">{{ g }}</span>
          <button class="group-del-btn" @click.prevent="handleInlineRemoveGroup(g)" title="删除此分组">×</button>
        </label>
      </div>
      <!-- 内联新建分组 -->
      <div class="inline-add-group">
        <input
          v-model="inlineGroupName"
          type="text"
          placeholder="新建分组…"
          maxlength="10"
          @keyup.enter="handleInlineAddGroup"
        />
        <button class="btn btn-primary" style="flex-shrink:0;" @click="handleInlineAddGroup">+ 新建</button>
      </div>
      <p v-if="inlineGroupError" style="color:var(--profit);font-size:12px;margin-top:4px;">{{ inlineGroupError }}</p>
      <template #footer>
        <button class="btn btn-cancel-modal" @click="groupModalOpen = false">取消</button>
        <button class="btn btn-primary" @click="onGroupConfirm">确认</button>
      </template>
    </BaseModal>

    <!-- 快捷建仓 Modal -->
    <AddFundModal
      v-model="showBuildModal"
      :prefill="buildPrefill"
      @added="buildPrefill = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fmt, fmtMD, getTodayStr } from '@/utils/format'
import { searchFunds } from '@/services/fundApi'
import { getMarketBadge } from '@/utils/market'
import BaseModal from '@/components/common/BaseModal.vue'
import TagModal from '@/components/common/TagModal.vue'
import FundExpandPanel from '@/components/fund/FundExpandPanel.vue'
import AddFundModal from '@/components/fund/AddFundModal.vue'

const fundStore = useFundStore()
const watchStore = useWatchStore()

// ── 添加自选（搜索模式）──
const showAddModal = ref(false)
const addKeyword = ref('')
const addResults = ref([])
const addSearching = ref(false)
const addError = ref('')
let _addSearchTimer = null

// ── 展开行 ──
const expandedCode = ref(null)

// ── 分组 tabs ──
const activeGroup = ref('all')

const groupTabs = computed(() => [
  { key: 'all', label: '全部' },
  { key: 'holding', label: '已持仓' },
  ...watchStore.groups.map(g => ({ key: g, label: g }))
])

// ── 新建分组 Modal ──
const showNewGroupModal = ref(false)
const newGroupName = ref('')
const newGroupError = ref('')

function handleAddGroup() {
  newGroupError.value = ''
  const name = newGroupName.value.trim()
  if (!name) { newGroupError.value = '请输入分组名称'; return }
  const ok = watchStore.addGroup(name)
  if (!ok) { newGroupError.value = '该分组已存在'; return }
  showNewGroupModal.value = false
  newGroupName.value = ''
}

// ── 标签 Modal ──
const tagModalOpen = ref(false)
const tagModalInitialTags = ref([])
const tagModalCode = ref('')

function openTagModal(item) {
  tagModalCode.value = item.code
  tagModalInitialTags.value = [...(item.tags || [])]
  tagModalOpen.value = true
}

function onTagConfirm(tags) {
  watchStore.updateWatch(tagModalCode.value, { tags })
  watchStore.save()
}

// ── 分组归属 Modal ──
const groupModalOpen = ref(false)
const groupModalCode = ref('')
const groupModalSelected = ref([])
const inlineGroupName = ref('')
const inlineGroupError = ref('')

function openGroupModal(item) {
  groupModalCode.value = item.code
  groupModalSelected.value = [...(item.groups || [])]
  inlineGroupName.value = ''
  inlineGroupError.value = ''
  groupModalOpen.value = true
}

function onGroupConfirm() {
  watchStore.setFundGroups(groupModalCode.value, [...groupModalSelected.value])
  groupModalOpen.value = false
}

function handleInlineAddGroup() {
  inlineGroupError.value = ''
  const name = inlineGroupName.value.trim()
  if (!name) { inlineGroupError.value = '请输入分组名称'; return }
  const ok = watchStore.addGroup(name)
  if (!ok) { inlineGroupError.value = '该分组已存在'; return }
  groupModalSelected.value.push(name)
  inlineGroupName.value = ''
}

function handleInlineRemoveGroup(name) {
  if (!confirm(`确定删除分组「${name}」？`)) return
  watchStore.removeGroup(name)
  groupModalSelected.value = groupModalSelected.value.filter(t => t !== name)
}

// ── 快捷建仓 ──
const showBuildModal = ref(false)
const buildPrefill = ref(null)

function handleBuild(item) {
  buildPrefill.value = { code: item.code, name: item.name || item.code }
  showBuildModal.value = true
}

// ── 添加到特定分组 ──
const showAddToGroupModal = ref(false)

// ── 过滤 & 排序 ──
function isHolding(code) {
  return fundStore.funds.some(f => f.code === code)
}

const confirmedCount = computed(() =>
  watchStore.watchlist.filter(w => w.navConfirmed).length
)
const marketBadge = computed(() =>
  getMarketBadge(confirmedCount.value, watchStore.watchlist.length)
)

const filteredWatchlist = computed(() => {
  if (activeGroup.value === 'all') return watchStore.watchlist
  if (activeGroup.value === 'holding') return watchStore.watchlist.filter(w => isHolding(w.code))
  return watchStore.watchlist.filter(w => (w.groups || []).includes(activeGroup.value))
})

const sortedFilteredWatchlist = computed(() => {
  const list = [...filteredWatchlist.value]
  list.sort((a, b) => {
    const va = getDisplayChangeRate(a) ?? -Infinity
    const vb = getDisplayChangeRate(b) ?? -Infinity
    return watchStore.sortDesc ? vb - va : va - vb
  })
  return list
})

function toggleSort() { watchStore.setSortDesc(!watchStore.sortDesc) }
function setSortAsc() { watchStore.setSortDesc(false) }
function setSortDesc() { watchStore.setSortDesc(true) }

function toggleExpand(code) {
  expandedCode.value = expandedCode.value === code ? null : code
}

// ── 行情显示工具函数 ──
function changeClass(gszzl) {
  if (gszzl == null || isNaN(gszzl)) return 'neutral'
  return gszzl > 0 ? 'profit' : gszzl < 0 ? 'loss' : 'neutral'
}

function formatChange(gszzl) {
  if (gszzl == null || isNaN(gszzl)) return '--'
  return (gszzl > 0 ? '+' : '') + fmt(gszzl, 2) + '%'
}

function isLiveEstimate(item) {
  return !!(item.gztime && item.gztime.slice(0, 10) === getTodayStr())
}

function isConfirmedToday(item) {
  return !!(item.navConfirmed && item.confirmedDate === getTodayStr())
}

function getDisplayNav(item) {
  if (isConfirmedToday(item)) return item.confirmedNav
  if (isLiveEstimate(item)) return item.gsz
  return item.confirmedNav ?? item.prevNav ?? null
}

function getNavSourceLabel(item) {
  if (isConfirmedToday(item) || (item.confirmedNav != null && !isLiveEstimate(item))) return '官方'
  if (isLiveEstimate(item)) return '估值'
  if (item.prevNav != null) return '官方'
  return ''
}

function getNavDate(item) {
  if (isConfirmedToday(item) || isLiveEstimate(item)) return getTodayStr()
  return item.confirmedDate || item.jzrq || null
}

function getDisplayChangeRate(item) {
  if (isConfirmedToday(item) && item.confirmedNav && item.prevNav && item.prevNav > 0) {
    return parseFloat(((item.confirmedNav - item.prevNav) / item.prevNav * 100).toFixed(4))
  }
  if (isLiveEstimate(item)) {
    if (item.gszzl && !isNaN(item.gszzl)) return item.gszzl
    if (item.gsz != null && item.prevNav && item.prevNav > 0) {
      return parseFloat(((item.gsz - item.prevNav) / item.prevNav * 100).toFixed(4))
    }
  }
  if (item.confirmedNav && item.prevNav && item.prevNav > 0) {
    return parseFloat(((item.confirmedNav - item.prevNav) / item.prevNav * 100).toFixed(4))
  }
  return null
}

async function handleRefresh() {
  await fundStore.refreshAll(watchStore)
  window.$toast?.('行情已刷新', 'success')
}

function handleRemove(code) {
  if (!confirm('确定删除该自选基金？')) return
  watchStore.removeWatch(code)
  if (expandedCode.value === code) expandedCode.value = null
}

function onAddInput() {
  addError.value = ''
  if (_addSearchTimer) clearTimeout(_addSearchTimer)
  if (!addKeyword.value.trim()) { addResults.value = []; return }
  addSearching.value = true
  _addSearchTimer = setTimeout(async () => {
    try {
      addResults.value = await searchFunds(addKeyword.value)
    } finally {
      addSearching.value = false
    }
  }, 300)
}

async function pickWatchFund(r) {
  addError.value = ''
  const code = r.CODE
  const ok = watchStore.addWatch({ code, name: r.NAME })
  if (!ok) {
    addError.value = '该基金已在自选列表中'
    return
  }
  showAddModal.value = false
  addKeyword.value = ''
  addResults.value = []
  window.$toast?.('已添加自选，正在刷新…', 'success')
  await fundStore.refreshAll(watchStore)
}
</script>

<style scoped>
/* 分组 tabs */
.group-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 0 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.group-tab {
  padding: 4px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.group-tab:hover { border-color: #6366f1; color: #a5b4fc; }
.group-tab.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #a5b4fc;
  font-weight: 500;
}
.group-tab-add {
  font-size: 18px;
  padding: 0 10px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* 持仓标识 */
.holding-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  margin-left: 4px;
  vertical-align: middle;
  flex-shrink: 0;
}

/* 操作区 */
.row-actions {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

/* 分组分配按钮 */
.btn-group-assign {
  position: relative;
  padding: 4px 6px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}
.btn-group-assign:hover { border-color: #6366f1; color: #a5b4fc; }
.btn-group-assign.has-groups { border-color: rgba(99,102,241,0.5); color: #a5b4fc; background: rgba(99,102,241,0.1); }
.group-count-dot {
  font-size: 10px;
  margin-left: 2px;
  min-width: 14px;
  text-align: center;
}

/* 建仓按钮 */
.btn-build {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 5px;
  border: 1px solid rgba(99,102,241,0.4);
  background: rgba(99,102,241,0.1);
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-build:hover:not(:disabled) { background: rgba(99,102,241,0.25); }
.btn-build:disabled { opacity: 0.35; cursor: not-allowed; }

/* 链接按钮 */
.btn-link {
  background: none;
  border: none;
  color: #a5b4fc;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}

/* 分组多选列表 */
.group-select-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.group-empty-hint {
  color: var(--text-muted);
  font-size: 13px;
  padding: 8px 2px;
}
.group-select-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-secondary);
  font-size: 13px;
  transition: background 0.12s;
}
.group-select-item:hover { background: rgba(99,102,241,0.1); }
.group-select-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: #6366f1; flex-shrink: 0; }
.group-select-label { flex: 1; color: var(--text-primary); }
.group-del-btn {
  background: none; border: none;
  color: var(--text-muted); font-size: 16px;
  cursor: pointer; padding: 0 2px; line-height: 1;
}
.group-del-btn:hover { color: var(--profit); }

/* 内联新建分组 */
.inline-add-group {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.inline-add-group input { flex: 1; min-width: 0; }

/* 表格 */
.two-line-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.cell-main { font-size: 14px; font-weight: 500; line-height: 1.2; }
.cell-sub { font-size: 11px; line-height: 1.2; }
.cell-sub-muted { color: var(--text-secondary); }

/* 搜索添加自选 */
.search-wrap { position: relative; margin-bottom: 12px; }
.search-input { width: 100%; box-sizing: border-box; padding-right: 36px; }
.search-spinner { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
.search-results {
  min-height: 120px; max-height: 300px; overflow-y: auto;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-secondary);
}
.search-hint { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
.result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  border-bottom: 1px solid var(--border); transition: background 0.12s;
}
.result-item:last-child { border-bottom: none; }
.result-item:hover { background: rgba(99, 102, 241, 0.12); }
.result-code { font-size: 12px; color: var(--text-muted); min-width: 52px; font-family: monospace; }
.result-name { font-size: 13px; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Mobile: 768px ── */
@media (max-width: 768px) {
  .group-tabs { gap: 4px; padding: 6px 0; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .group-tabs::-webkit-scrollbar { display: none; }
  .group-tab { padding: 3px 10px; font-size: 11px; flex-shrink: 0; }
}
</style>
