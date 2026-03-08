<template>
  <button class="ai-fab" @click="toggle" :title="isOpen ? '关闭 AI 助手' : '打开 AI 助手'">
    🤖
    <span v-if="unreadCount > 0" class="ai-fab-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
  </button>
</template>

<script setup>
import { useAiChat } from '@/composables/useAiChat'

const { isOpen, unreadCount, toggle } = useAiChat()
</script>
