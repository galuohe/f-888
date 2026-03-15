<template>
  <div class="container">
    <!-- Auth Modal -->
    <AuthModal v-if="showAuthModal" @close="showAuthModal = false" />

    <!-- Main App Content -->
    <div id="appContent" v-show="isAuthenticated">
      <!-- Sticky Top: Header + TabBar -->
      <div id="sticky-top" ref="stickyTop">
        <AppHeader @open-auth="showAuthModal = true" />
        <TabBar :active-tab="activeTab" @switch="switchTab" />
      </div>

      <!-- Tab Views -->
      <PortfolioView v-show="activeTab === 1" />
      <WatchlistView v-show="activeTab === 2" />
      <PnlCalendarView v-show="activeTab === 3" :active="activeTab === 3" />
      <MarketOverviewView v-show="activeTab === 4" :active="activeTab === 4" />
      <FundRankView v-show="activeTab === 5" :active="activeTab === 5" />
      <FundNavView v-show="activeTab === 6" :active="activeTab === 6" />
    </div>

    <!-- Toast -->
    <Toast />

    <!-- Fund Name Tooltip -->
    <div id="fundTip"></div>

    <!-- AI Assistant -->
    <AiFab />
    <AiChatBox />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { useAuthStore } from '@/stores/authStore'

import AppHeader from '@/components/layout/AppHeader.vue'
import TabBar from '@/components/layout/TabBar.vue'
import PortfolioView from '@/views/PortfolioView.vue'
import WatchlistView from '@/views/WatchlistView.vue'
import PnlCalendarView from '@/views/PnlCalendarView.vue'
import MarketOverviewView from '@/views/MarketOverviewView.vue'
import FundRankView from '@/views/FundRankView.vue'
import FundNavView from '@/views/FundNavView.vue'
import AuthModal from '@/components/common/AuthModal.vue'
import Toast from '@/components/common/Toast.vue'
import AiFab from '@/components/ai/AiFab.vue'
import AiChatBox from '@/components/ai/AiChatBox.vue'

const fundStore = useFundStore()
const watchStore = useWatchStore()
const authStore = useAuthStore()

const activeTab = ref(1)
const showAuthModal = ref(false)
const authChecked = ref(false)  // 认证状态是否已确认
const stickyTop = ref(null)

// 内容始终显示（从 localStorage 加载），认证失败时遮罩覆盖
const isAuthenticated = computed(() => {
  if (!authStore.client) return true    // 无 Supabase，直接显示
  if (!authChecked.value) return true   // 认证检查中，先显示内容
  return !!authStore.user               // 认证完成后根据用户状态决定
})

function switchTab(n) {
  activeTab.value = n
}

// Sticky header shadow
let stickyObserver = null
onMounted(() => {
  if (stickyTop.value) {
    stickyObserver = new IntersectionObserver(
      ([entry]) => stickyTop.value?.classList.toggle('pinned', entry.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
    )
    stickyObserver.observe(stickyTop.value)
  }

  // 先从 localStorage 加载本地数据（不管是否登录，先展示内容）
  fundStore.load()
  watchStore.load()

  if (!authStore.client) {
    // 未配置 Supabase：跳过认证，直接刷新
    if (fundStore.funds.length > 0 || watchStore.watchlist.length > 0) {
      fundStore.refreshAll(watchStore)
    }
    fundStore.resetTimer(watchStore)
  } else {
    // 先检查已有 session，避免 onAuthStateChange 初始 null 导致的闪烁
    authStore.client.auth.getSession().then(({ data: { session } }) => {
      authChecked.value = true
      if (session) {
        authStore.user = session.user
        onLogin(session.user)
      } else {
        showAuthModal.value = true
      }
    }).catch(() => {
      authChecked.value = true
      showAuthModal.value = true
    })

    // 监听后续状态变化（切换账号、登出等）
    authStore.initAuthListener(
      (user) => onLogin(user),
      () => {
        authChecked.value = true
        showAuthModal.value = true
        fundStore.stopTimer()
      }
    )
  }

  async function onLogin(user) {
    showAuthModal.value = false
    if (!authStore.isLoaded) {
      try {
        const result = await authStore.loadFromCloud()
        if (result) {
          fundStore.load()
          watchStore.load()
          if (!result.isEmpty && (fundStore.funds.length > 0 || watchStore.watchlist.length > 0)) {
            fundStore.refreshAll(watchStore)
          }
        }
      } catch (e) {
        console.error('云端加载失败:', e.message)
      }
    }
    if (fundStore.funds.length > 0 || watchStore.watchlist.length > 0) {
      fundStore.refreshAll(watchStore)
    }
    fundStore.resetTimer(watchStore)
  }
})

onUnmounted(() => {
  stickyObserver?.disconnect()
  fundStore.stopTimer()
})
</script>
