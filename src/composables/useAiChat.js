import { ref } from 'vue'

// Singleton state — shared across all component instances
const isOpen = ref(false)
const unreadCount = ref(0)

export function useAiChat() {
  function toggle() {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
      unreadCount.value = 0
    }
  }

  function incrementUnread() {
    if (!isOpen.value) {
      unreadCount.value++
    }
  }

  function open() {
    isOpen.value = true
    unreadCount.value = 0
  }

  function close() {
    isOpen.value = false
  }

  return { isOpen, unreadCount, toggle, incrementUnread, open, close }
}
