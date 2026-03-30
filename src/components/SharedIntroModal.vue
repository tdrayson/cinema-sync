<script setup>
import { computed, toRef } from 'vue'
import { useComparison } from '../composables/useComparison.js'
import { useCinema } from '../composables/useCinema.js'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { movies, movieShowtimes } = useComparison()
const { selectedCinemas, selectedDate } = useCinema()

const { containerRef: introRef, onKeydown: onIntroKeydown } = useFocusTrap(
  toRef(props, 'open'),
  { onClose: () => emit('close'), lockScroll: false }
)

const filmCount = computed(() => movies.value.length)

const cinemaSummary = computed(() => {
  const names = new Set()
  for (const c of selectedCinemas.value) {
    if (c?.name) names.add(c.name)
  }
  // Fallback to showtime cinemas if needed
  if (!names.size) {
    for (const showtimes of movieShowtimes.value.values()) {
      for (const st of showtimes || []) {
        if (st?.cinema) names.add(st.cinema)
      }
    }
  }
  const list = [...names]
  if (!list.length) return ''
  if (list.length === 1) return list[0]
  return `${list[0]} +${list.length - 1} more`
})

function formatWithOrdinal(date) {
  if (!date) return ''
  const d = date.getDate()
  const suffix =
    d >= 11 && d <= 13
      ? 'th'
      : d % 10 === 1
        ? 'st'
        : d % 10 === 2
          ? 'nd'
          : d % 10 === 3
            ? 'rd'
            : 'th'
  const base = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
  return base.replace(/\b(\d{1,2})\b/, `$1${suffix}`)
}

const formattedDate = computed(() => {
  if (!selectedDate.value) return ''
  try {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    return formatWithOrdinal(d)
  } catch {
    return ''
  }
})

const hasLocations = computed(() => !!cinemaSummary.value)

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-ink/45" aria-hidden="true" @click="close" />
      <div ref="introRef" role="dialog" aria-modal="true" aria-label="Shared link introduction" @keydown="onIntroKeydown" class="relative max-w-lg w-full bg-cream border border-border-dark shadow-xl">
        <div class="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 class="font-serif text-lg text-ink leading-snug">
              You’ve been sent a CinemaSync link
            </h2>
          </div>
          <button
            type="button"
            @click="close"
            class="ml-3 text-ink/40 hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div class="px-5 py-4 space-y-3 text-sm text-ink">
          <p class="text-[13px] text-ink">
            You’re looking at
            <strong>{{ filmCount }} film{{ filmCount === 1 ? '' : 's' }}</strong>
            <span v-if="formattedDate"> on <strong>{{ formattedDate }}</strong></span>
            <span v-if="hasLocations"> at <strong>{{ cinemaSummary }}</strong></span>.
          </p>

          <p class="text-[13px] text-ink/90 leading-relaxed">
            CinemaSync helps you compare films and showtimes across cinemas so it’s easy
            to find options that work for everyone. Use the controls above to tweak
            the list, add or remove films, and adjust locations or dates.
          </p>

          <ul class="mt-1 pl-5 list-disc space-y-1.5 text-[13px] text-ink">
            <li>
              <strong>Compare films</strong> to help you decide which one you like the most.
            </li>
            <li>
              <strong>Compare showtimes</strong> across the cinemas in the bar above.
            </li>
          </ul>
        </div>

        <div class="px-5 py-3 border-t border-border flex items-center justify-between gap-3 bg-cream-dark/40">
          <button
            type="button"
            @click="close"
            class="shrink-0 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-medium border border-border-dark text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
