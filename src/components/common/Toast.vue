<template>
  <div class="toast" :class="[type, { show: visible }]" ref="el">{{ message }}</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const message = ref('')
const type = ref('success')
const visible = ref(false)
let tid = null

function show(msg, t = 'success') {
  message.value = msg
  type.value = t
  visible.value = true
  if (tid) clearTimeout(tid)
  tid = setTimeout(() => { visible.value = false }, 3000)
}

// Expose globally
onMounted(() => {
  window.$toast = show
})
</script>
