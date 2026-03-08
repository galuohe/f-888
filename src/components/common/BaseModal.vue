<template>
  <div
    style="display:flex;position:fixed;inset:0;z-index:2000;align-items:center;justify-content:center;"
    v-if="modelValue"
  >
    <div class="modal-overlay" @click="$emit('update:modelValue', false)"></div>
    <div class="modal-box" :style="boxStyle">
      <div class="modal-header">
        <span class="modal-title">{{ title }}</span>
        <button class="modal-close" @click="$emit('update:modelValue', false)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div class="modal-footer" v-if="$slots.footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  boxStyle: { type: [String, Object], default: '' }
})
defineEmits(['update:modelValue'])
</script>
