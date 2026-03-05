<script setup>
import { computed } from 'vue'
import { useCinema } from '../composables/useCinema.js'
import { chainIcon } from '../utils/assets.js'

const { selectedCinemas, selectedDate, isActive, showModal, clear } = useCinema()

const formattedDate = computed(() => {
  if (!selectedDate.value) return ''
  const d = new Date(selectedDate.value + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
})

const cinemaLabel = computed(() => {
  const count = selectedCinemas.value.length
  if (count === 0) return ''
  if (count === 1) return selectedCinemas.value[0].name
  const first = selectedCinemas.value[0].name
  return `${first} +${count - 1} more`
})
</script>

<template>
  <div v-if="isActive" class="border-b border-border bg-ink/[0.02]">
    <div class="max-w-[1400px] mx-auto px-6 py-2 flex items-center gap-3">
      <!-- Chain icons for selected cinemas -->
      <div class="flex items-center -space-x-1 shrink-0">
        <img
          v-for="cinema in selectedCinemas.slice(0, 3)"
          :key="cinema.id"
          :src="chainIcon(cinema.chain)"
          :alt="cinema.chain"
          class="max-w-5 max-h-5 aspect-square rounded border border-cream bg-white"
        />
      </div>

      <div class="flex items-center gap-2 text-xs text-ink min-w-0">
        <span class="font-medium truncate">{{ cinemaLabel }}</span>
        <span class="text-ink-lighter">&middot;</span>
        <span class="text-ink-lighter shrink-0">{{ formattedDate }}</span>
      </div>

      <div class="flex items-center gap-1 ml-auto shrink-0">
        <!-- Edit button -->
        <button
          @click="showModal = true"
          class="p-1.5 text-ink/50 hover:text-ink transition-colors cursor-pointer"
          aria-label="Edit cinema selection"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
          </svg>
        </button>
        <!-- Clear button -->
        <button
          @click="clear"
          class="p-1.5 text-ink/50 hover:text-ink transition-colors cursor-pointer"
          aria-label="Clear cinema selection"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
