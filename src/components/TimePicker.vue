<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const picker = ref(null)

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = ['00', '15', '30', '45']

const selectedHour = ref('')
const selectedMinute = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      const [h, m] = val.split(':')
      selectedHour.value = h
      selectedMinute.value = m
    } else {
      selectedHour.value = ''
      selectedMinute.value = ''
    }
  },
  { immediate: true }
)

const displayTime = computed(() => {
  if (!props.modelValue) return 'Any time'
  return `After ${props.modelValue}`
})

const isActive = computed(() => !!props.modelValue)

function selectHour(h) {
  selectedHour.value = h
  if (!selectedMinute.value) {
    selectedMinute.value = '00'
  }
  emitTime()
}

function selectMinute(m) {
  selectedMinute.value = m
  if (!selectedHour.value) {
    selectedHour.value = '12'
  }
  emitTime()
}

function emitTime() {
  if (selectedHour.value && selectedMinute.value) {
    emit('update:modelValue', `${selectedHour.value}:${selectedMinute.value}`)
  }
}

function clear() {
  selectedHour.value = ''
  selectedMinute.value = ''
  emit('update:modelValue', '')
  open.value = false
}

const hourScroller = ref(null)

watch(open, (isOpen) => {
  if (isOpen && selectedHour.value && hourScroller.value) {
    nextTick(() => {
      const idx = hours.indexOf(selectedHour.value)
      if (idx >= 0 && hourScroller.value) {
        hourScroller.value.scrollTop = Math.max(0, idx * 30 - 60)
      }
    })
  }
})

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
      aria-label="Filter by time"
      class="flex items-center gap-2 px-3 py-1.5 text-xs border border-border hover:border-ink transition-colors cursor-pointer"
    >
      <svg class="w-3.5 h-3.5 text-ink/50" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.5l2.5 1.5" />
      </svg>
      <span class="font-medium text-ink">{{ displayTime }}</span>
      <svg class="w-3 h-3 text-ink/40 transition-transform" :class="open ? 'rotate-180' : ''" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>

    <!-- Dropdown picker -->
    <Transition name="picker-fade">
      <div v-if="open" role="dialog" aria-label="Time filter" @keydown="onPickerKeydown" class="absolute top-full left-0 mt-1 z-10 bg-cream border border-border shadow-lg w-56">
        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-border">
          <span class="text-[10px] font-semibold uppercase tracking-widest text-ink-lighter">Show films after</span>
          <button
            v-if="isActive"
            @click="clear"
            class="text-[10px] text-ink-lighter hover:text-ink transition-colors cursor-pointer uppercase tracking-wider font-medium"
          >
            Clear
          </button>
        </div>

        <!-- Time columns -->
        <div class="flex">
          <!-- Hours -->
          <div class="flex-1 border-r border-border">
            <p id="hour-label" class="text-[10px] uppercase tracking-wider text-ink-lighter font-medium text-center py-1.5 border-b border-border/60">Hour</p>
            <div ref="hourScroller" role="listbox" aria-labelledby="hour-label" class="h-48 overflow-y-auto hide-scrollbar">
              <button
                v-for="h in hours"
                :key="h"
                role="option"
                :aria-selected="selectedHour === h"
                @click="selectHour(h)"
                class="w-full py-1.5 text-xs text-center transition-colors cursor-pointer"
                :class="selectedHour === h
                  ? 'bg-ink text-cream font-medium'
                  : 'text-ink hover:bg-ink/5'"
              >
                {{ h }}
              </button>
            </div>
          </div>

          <!-- Minutes -->
          <div class="flex-1">
            <p id="minute-label" class="text-[10px] uppercase tracking-wider text-ink-lighter font-medium text-center py-1.5 border-b border-border/60">Min</p>
            <div role="listbox" aria-labelledby="minute-label" class="h-48">
              <button
                v-for="m in minutes"
                :key="m"
                role="option"
                :aria-selected="selectedMinute === m"
                @click="selectMinute(m)"
                class="w-full py-1.5 text-xs text-center transition-colors cursor-pointer"
                :class="selectedMinute === m
                  ? 'bg-ink text-cream font-medium'
                  : 'text-ink hover:bg-ink/5'"
              >
                {{ m }}
              </button>
            </div>
          </div>
        </div>

        <!-- Quick presets -->
        <div class="border-t border-border px-3 py-2">
          <p class="text-[10px] uppercase tracking-wider text-ink-lighter font-medium mb-1.5">Quick select</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in ['12:00', '14:00', '17:00', '19:00', '21:00']"
              :key="preset"
              @click="selectedHour = preset.split(':')[0]; selectedMinute = preset.split(':')[1]; emitTime()"
              class="px-2 py-0.5 text-[11px] border transition-colors cursor-pointer"
              :class="modelValue === preset
                ? 'border-ink bg-ink text-cream'
                : 'border-border text-ink-lighter hover:border-ink hover:text-ink'"
            >
              {{ preset }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
