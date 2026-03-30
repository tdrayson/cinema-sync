<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const open = ref(false)
const picker = ref(null)

const today = new Date()
today.setHours(0, 0, 0, 0)
const todayStr = formatDate(today)

const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

const displayDate = computed(() => {
  if (!props.modelValue) return 'Select date'
  const d = new Date(props.modelValue + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
})

const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const calendarDays = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()

  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6

  const days = []
  for (let i = 0; i < startDow; i++) {
    days.push({ day: null })
  }

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(viewYear.value, viewMonth.value, d)
    date.setHours(0, 0, 0, 0)
    const dateStr = formatDate(date)
    days.push({
      day: d,
      dateStr,
      isToday: dateStr === todayStr,
      isPast: date < today,
      isSelected: dateStr === props.modelValue,
    })
  }

  return days
})

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function canGoPrev() {
  return viewYear.value > today.getFullYear() || viewMonth.value > today.getMonth()
}

function selectDay(cell) {
  if (!cell.day || cell.isPast) return
  emit('select', cell.dateStr)
  open.value = false
}

function onClickOutside(e) {
  if (picker.value && !picker.value.contains(e.target)) {
    open.value = false
  }
}

function onPickerKeydown(e) {
  if (e.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="picker" class="relative">
    <!-- Trigger button -->
    <button
      @click="open = !open"
      :aria-expanded="open"
      aria-label="Select date"
      class="flex items-center gap-2 px-3 py-1.5 text-xs border border-border hover:border-ink transition-colors cursor-pointer"
    >
      <svg class="w-3.5 h-3.5 text-ink/50" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="1" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
      </svg>
      <span class="font-medium text-ink">{{ displayDate }}</span>
      <svg class="w-3 h-3 text-ink/40 transition-transform" :class="open ? 'rotate-180' : ''" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>

    <!-- Dropdown calendar -->
    <div v-if="open" role="dialog" aria-label="Date picker" @keydown="onPickerKeydown" class="absolute top-full left-0 mt-1 z-10 bg-cream border border-border shadow-lg p-3 w-64">
      <!-- Month header -->
      <div class="flex items-center justify-between mb-2">
        <button
          @click="prevMonth"
          :disabled="!canGoPrev()"
          class="p-1 text-ink/50 hover:text-ink transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <span class="text-xs font-medium uppercase tracking-widest text-ink">{{ monthLabel }}</span>
        <button
          @click="nextMonth"
          class="p-1 text-ink/50 hover:text-ink transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>

      <!-- Day headers -->
      <div class="grid grid-cols-7 mb-1" role="row">
        <div v-for="dh in dayHeaders" :key="dh" role="columnheader" class="text-center text-[10px] uppercase tracking-wider text-ink-lighter font-medium py-1">
          {{ dh }}
        </div>
      </div>

      <!-- Day cells -->
      <div class="grid grid-cols-7" role="grid" aria-label="Calendar">
        <button
          v-for="(cell, idx) in calendarDays"
          :key="idx"
          type="button"
          :disabled="!cell.day || cell.isPast"
          :aria-selected="cell.isSelected"
          :aria-label="cell.day ? `${cell.day} ${monthLabel}` : undefined"
          :aria-current="cell.isToday ? 'date' : undefined"
          @click="selectDay(cell)"
          class="relative flex items-center justify-center py-1.5 text-xs transition-colors bg-transparent"
          :class="[
            cell.day && !cell.isPast ? 'cursor-pointer hover:bg-ink/5' : '',
            cell.isPast ? 'text-ink/20 cursor-not-allowed' : 'text-ink',
            cell.isSelected ? 'bg-ink/10 font-medium' : '',
            !cell.day ? 'invisible' : '',
          ]"
        >
          <span v-if="cell.day">{{ cell.day }}</span>
          <span
            v-if="cell.isToday && !cell.isSelected"
            class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ink"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  </div>
</template>
