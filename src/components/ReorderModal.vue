<script setup>
import { ref, watch, computed } from 'vue'
import { useComparison } from '../composables/useComparison.js'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { movies, reorderMovies, sortOrder } = useComparison()

// Local working copy of the order
const localOrder = ref([])

watch(() => props.open, (val) => {
  if (val) {
    localOrder.value = movies.value.map((m) => ({ id: m.id, title: m.title, posterUrl: m.posterUrl }))
  }
})

const closeBtn = ref(null)
const { containerRef: modalRef, onKeydown } = useFocusTrap(
  computed(() => props.open),
  { onClose: cancel, initialFocus: closeBtn }
)

function move(index, direction) {
  const target = index + direction
  if (target < 0 || target >= localOrder.value.length) return
  const list = [...localOrder.value]
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  localOrder.value = list
}

// Drag state
const dragIndex = ref(null)
const dragOverIndex = ref(null)

function onDragStart(e, index) {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', index)
}

function onDragOver(e, index) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(e, index) {
  e.preventDefault()
  const from = dragIndex.value
  if (from === null || from === index) {
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }
  const list = [...localOrder.value]
  const [item] = list.splice(from, 1)
  list.splice(index, 0, item)
  localOrder.value = list
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

// Touch drag state
const touchIndex = ref(null)
const touchCurrentIndex = ref(null)
let touchStartY = 0
let itemHeight = 0

function onTouchStart(e, index) {
  const el = e.currentTarget
  itemHeight = el.offsetHeight
  touchStartY = e.touches[0].clientY
  touchIndex.value = index
  touchCurrentIndex.value = index
}

function onTouchMove(e, index) {
  if (touchIndex.value === null) return
  e.preventDefault()
  const dy = e.touches[0].clientY - touchStartY
  const offset = Math.round(dy / itemHeight)
  const target = Math.max(0, Math.min(localOrder.value.length - 1, touchIndex.value + offset))
  touchCurrentIndex.value = target
}

function onTouchEnd() {
  if (touchIndex.value !== null && touchCurrentIndex.value !== null && touchIndex.value !== touchCurrentIndex.value) {
    const list = [...localOrder.value]
    const [item] = list.splice(touchIndex.value, 1)
    list.splice(touchCurrentIndex.value, 0, item)
    localOrder.value = list
  }
  touchIndex.value = null
  touchCurrentIndex.value = null
}

function apply() {
  sortOrder.value = 'custom'
  reorderMovies(localOrder.value.map((m) => m.id))
  emit('close')
}

function cancel() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-ink/45" aria-hidden="true" @click="cancel" />
      <div
        ref="modalRef"
        role="dialog"
        aria-modal="true"
        aria-label="Reorder films"
        @keydown="onKeydown"
        class="relative w-full max-w-sm bg-cream border border-border-dark shadow-xl flex flex-col max-h-[80vh]"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 class="font-serif text-lg text-ink">Reorder Films</h2>
          <button
            ref="closeBtn"
            type="button"
            @click="cancel"
            class="text-ink/40 hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <!-- Film list -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div
            v-for="(film, index) in localOrder"
            :key="film.id"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver($event, index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
            @touchstart="onTouchStart($event, index)"
            @touchmove="onTouchMove($event, index)"
            @touchend="onTouchEnd"
            class="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-b-0 transition-colors select-none"
            :class="[
              dragOverIndex === index ? 'bg-ink/5' : '',
              dragIndex === index ? 'opacity-40' : '',
            ]"
          >
            <!-- Drag handle -->
            <div class="shrink-0 text-ink/30 cursor-grab active:cursor-grabbing touch-none" aria-hidden="true">
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.2" />
                <circle cx="11" cy="4" r="1.2" />
                <circle cx="5" cy="8" r="1.2" />
                <circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="12" r="1.2" />
                <circle cx="11" cy="12" r="1.2" />
              </svg>
            </div>

            <!-- Poster thumbnail -->
            <img
              v-if="film.posterUrl"
              :src="film.posterUrl"
              :alt="film.title"
              class="w-8 h-12 object-cover shrink-0 border border-border"
            />
            <div v-else class="w-8 h-12 bg-cream-dark border border-border shrink-0" />

            <!-- Title -->
            <span class="flex-1 text-sm font-medium text-ink truncate">{{ film.title }}</span>

            <!-- Up/Down arrows -->
            <div class="flex flex-col shrink-0">
              <button
                type="button"
                :disabled="index === 0"
                @click="move(index, -1)"
                class="w-8 h-8 flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 rounded disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                :aria-label="`Move ${film.title} up`"
              >
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 10l4-4 4 4" />
                </svg>
              </button>
              <button
                type="button"
                :disabled="index === localOrder.length - 1"
                @click="move(index, 1)"
                class="w-8 h-8 flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 rounded disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                :aria-label="`Move ${film.title} down`"
              >
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button
            type="button"
            @click="cancel"
            class="px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-medium text-ink border border-border hover:border-ink-lighter transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="apply"
            class="px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-medium text-cream bg-ink hover:bg-ink/80 transition-colors cursor-pointer"
          >
            Apply Order
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
