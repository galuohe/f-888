<template>
  <div class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-btn"
      :class="{ active: activeTab === tab.id }"
      @click="$emit('switch', tab.id)"
    >{{ tab.label }}</button>
  </div>
</template>

<script setup>
defineProps({
  activeTab: { type: Number, default: 1 }
})
defineEmits(['switch'])

const tabs = [
  { id: 1, label: '我的持仓' },
  { id: 2, label: '自选监控' },
  { id: 3, label: '盈亏日历' },
  { id: 4, label: '基金大盘' },
  { id: 5, label: '板块行情' },
  { id: 6, label: '热门主题' },
]
</script>
