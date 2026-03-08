<template>
  <div class="auth-modal open">
    <div class="auth-box">
      <div class="auth-title">养基必涨</div>
      <div class="auth-subtitle">请登录以查看持仓数据</div>
      <div class="auth-form" style="margin-top:8px;">
        <div class="form-group">
          <label>账号（邮箱）</label>
          <input v-model="email" type="email" placeholder="your@email.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            @keydown.enter="submit"
          />
        </div>
        <div class="auth-err" v-if="errorMsg">{{ errorMsg }}</div>
        <button class="auth-btn" :disabled="loading" @click="submit">
          <span v-if="loading" class="spinner"></span>
          <span v-else>登录</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function submit() {
  if (!email.value || !password.value) {
    errorMsg.value = '请填写账号和密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.signIn(email.value.trim(), password.value)
  } catch (e) {
    errorMsg.value = e.message === 'Invalid login credentials' ? '账号或密码错误' : e.message
  } finally {
    loading.value = false
  }
}
</script>
