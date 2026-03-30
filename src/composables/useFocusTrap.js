import { ref, watch, nextTick } from 'vue'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe'

/**
 * Reusable focus-trap composable for modals/dialogs.
 *
 * @param {import('vue').Ref<boolean>} isOpen – reactive flag that controls visibility
 * @param {object} [opts]
 * @param {() => void}              [opts.onClose]       – called on Escape
 * @param {boolean}                 [opts.lockScroll]     – lock body scroll (default true)
 * @param {import('vue').Ref|null}  [opts.initialFocus]   – element ref to focus on open (defaults to first focusable)
 * @returns {{ containerRef: import('vue').Ref, onKeydown: (e: KeyboardEvent) => void }}
 */
export function useFocusTrap(isOpen, opts = {}) {
  const { onClose, lockScroll = true, initialFocus = null } = opts
  const containerRef = ref(null)
  let previouslyFocused = null

  function trapFocus(e) {
    if (!containerRef.value) return
    const focusable = [...containerRef.value.querySelectorAll(FOCUSABLE)]
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      onClose?.()
    } else if (e.key === 'Tab') {
      trapFocus(e)
    }
  }

  watch(isOpen, async (val) => {
    if (val) {
      previouslyFocused = document.activeElement
      if (lockScroll) document.body.style.overflow = 'hidden'
      await nextTick()
      if (initialFocus?.value) {
        initialFocus.value.focus()
      } else if (containerRef.value) {
        const first = containerRef.value.querySelector(FOCUSABLE)
        first?.focus()
      }
    } else {
      if (lockScroll) document.body.style.overflow = ''
      if (previouslyFocused) {
        previouslyFocused.focus()
        previouslyFocused = null
      }
    }
  })

  return { containerRef, onKeydown }
}
