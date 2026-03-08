<template>
  <header>
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="logo-text">
        <h1>养基必涨</h1>
        <p>FUND PORTFOLIO TRACKER</p>
      </div>
    </div>

    <div class="header-right">
      <div class="update-time" v-if="lastUpdateTimeStr">
        最后更新：<span>{{ lastUpdateTimeStr }}</span>
      </div>
      <div class="auto-badge" v-if="autoRefreshLabel">
        <span class="pulse-dot"></span>
        <span>{{ autoRefreshLabel }}</span>
      </div>
      <div style="margin-top:8px;">
        <button v-if="!user" class="btn-login-header" @click="openAuth">登录 / 注册</button>
        <div v-else class="user-info">
          <span class="user-email" :title="user.email">{{ user.email }}</span>
          <button class="btn-logout" @click="logout">退出登录</button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useFundStore } from '@/stores/fundStore'
import { isWeekend, getAutoRefreshInterval } from '@/utils/market'
import { getTodayStr } from '@/utils/format'

const emit = defineEmits(['open-auth'])

const authStore = useAuthStore()
const fundStore = useFundStore()
const user = computed(() => authStore.user)

const lastUpdateTimeStr = computed(() => {
  if (!fundStore.lastUpdateTime) return ''
  return fundStore.lastUpdateTime.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})

const autoRefreshLabel = computed(() => {
  if (isWeekend()) return '非交易日'
  const todayStr = getTodayStr()
  const allConfirmed =
    fundStore.funds.length > 0 &&
    fundStore.funds.every(f => f.confirmedDate === todayStr)
  if (allConfirmed) return '✓ 净值已全部确认，已停止自动刷新'
  if (fundStore.funds.length === 0) return ''
  const intervalMs = getAutoRefreshInterval()
  const secs = intervalMs / 1000
  return `每 ${secs} 秒自动刷新`
})

function openAuth() {
  emit('open-auth')
}

function logout() {
  authStore.signOut()
}
</script>
