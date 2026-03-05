<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useCinema } from '../composables/useCinema.js'
import { chainIcon } from '../utils/assets.js'
import DatePicker from './DatePicker.vue'

const emit = defineEmits(['add-films'])

const {
  showModal,
  selectedCinemas,
  selectedDate,
  loadingCinemas,
  loadingFilms,
  mergedFilms,
  loadAllCinemas,
  loadFilmsForSelectedCinemas,
  toggleCinema,
  setDate,
  filterCinemas,
} = useCinema()

const step = ref(1)
const searchQuery = ref('')
const selectedShowtimes = ref(new Map())
const modal = ref(null)
const closeBtn = ref(null)
let previouslyFocused = null

const chainFilter = ref('all') // 'all' | 'vue' | 'cineworld'

const filteredCinemas = computed(() => {
  let list = filterCinemas(searchQuery.value)
  if (chainFilter.value !== 'all') {
    list = list.filter(c => c.chain === chainFilter.value)
  }
  return list
})

const selectedCinemaCount = computed(() => selectedCinemas.value.length)

// Cinema filter for Step 2
const filterCinemaIds = ref(new Set())

const visibleFilms = computed(() => {
  if (filterCinemaIds.value.size === 0) return mergedFilms.value
  return mergedFilms.value
    .map(film => ({
      ...film,
      cinemaShowtimes: film.cinemaShowtimes.filter(cs => filterCinemaIds.value.has(cs.cinemaId)),
    }))
    .filter(film => film.cinemaShowtimes.length > 0)
})

function toggleCinemaFilter(cinemaId) {
  const next = new Set(filterCinemaIds.value)
  if (next.has(cinemaId)) {
    next.delete(cinemaId)
  } else {
    next.add(cinemaId)
  }
  filterCinemaIds.value = next
}

function isCinemaFiltered(cinemaId) {
  return filterCinemaIds.value.has(cinemaId)
}

// Count distinct films that have at least one selected showtime
const selectedFilmCount = computed(() => {
  const films = new Set()
  for (const key of selectedShowtimes.value.keys()) {
    films.add(key.split('::')[0])
  }
  return films.size
})

function isCinemaSelected(cinema) {
  return selectedCinemas.value.some(c => c.id === cinema.id)
}

function filmHasSelectedTimes(filmTitle) {
  for (const key of selectedShowtimes.value.keys()) {
    if (key.startsWith(filmTitle + '::')) return true
  }
  return false
}

function isShowtimeSelected(film, cs, st) {
  const key = `${film.title}::${cs.cinemaId}::${st.time}`
  return selectedShowtimes.value.has(key)
}

function toggleShowtime(film, cs, st) {
  if (st.soldOut) return
  const key = `${film.title}::${cs.cinemaId}::${st.time}`
  const next = new Map(selectedShowtimes.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.set(key, { cinema: cs.cinemaName, chain: cs.chain, time: st.time })
  }
  selectedShowtimes.value = next
}


function openStep1() {
  step.value = 1
  searchQuery.value = ''
  chainFilter.value = 'all'
}

function onToggleCinema(cinema) {
  toggleCinema(cinema)
}

function browseFilms() {
  if (!selectedCinemas.value.length) return
  step.value = 2
  selectedShowtimes.value = new Map()
  filterCinemaIds.value = new Set()
  loadFilmsForSelectedCinemas()
}

function onDateSelect(dateStr) {
  setDate(dateStr)
  selectedShowtimes.value = new Map()
  filterCinemaIds.value = new Set()
}

function addFilms() {
  // Group selected showtimes by film
  const filmMap = new Map()
  for (const [key, details] of selectedShowtimes.value) {
    const filmTitle = key.split('::')[0]
    if (!filmMap.has(filmTitle)) {
      const film = mergedFilms.value.find(f => f.title === filmTitle)
      filmMap.set(filmTitle, {
        name: filmTitle,
        releaseYear: film?.releaseYear || null,
        showtimes: [],
      })
    }
    filmMap.get(filmTitle).showtimes.push(details)
  }
  emit('add-films', Array.from(filmMap.values()))
  closeModal()
}

function closeModal() {
  showModal.value = false
  selectedShowtimes.value = new Map()
  if (previouslyFocused) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
}

function trapFocus(e) {
  if (!modal.value) return
  const focusable = modal.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
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
  if (e.key === 'Escape') closeModal()
  else if (e.key === 'Tab') trapFocus(e)
}

function formatDuration(mins) {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

watch(showModal, async (val) => {
  if (val) {
    previouslyFocused = document.activeElement
    document.body.style.overflow = 'hidden'
    loadAllCinemas()
    if (selectedCinemas.value.length > 0) {
      step.value = 2
      loadFilmsForSelectedCinemas()
    } else {
      step.value = 1
    }
    await nextTick()
    closeBtn.value?.focus()
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showModal"
      ref="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Browse Cinemas"
      class="fixed inset-0 z-50 flex items-center justify-center sm:p-4"
      @keydown="onKeydown"
    >
      <div class="fixed inset-0 bg-ink/40 hidden sm:block" aria-hidden="true" @click="closeModal" />
      <div class="relative bg-cream sm:border sm:border-border-dark shadow-xl w-full sm:max-w-xl flex flex-col h-full sm:h-auto sm:max-h-[600px]">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div class="flex items-center gap-3">
            <button
              v-if="step === 2"
              @click="openStep1"
              class="text-ink/50 hover:text-ink transition-colors cursor-pointer"
              aria-label="Back to cinema search"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
            <h2 class="text-sm font-medium uppercase tracking-widest text-ink">
              {{ step === 1 ? 'Find Cinema' : `${selectedCinemaCount} Cinema${selectedCinemaCount !== 1 ? 's' : ''} Selected` }}
            </h2>
          </div>
          <button
            ref="closeBtn"
            @click="closeModal"
            class="text-ink/50 hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <!-- Step 1: Cinema Selection -->
        <template v-if="step === 1">
          <div class="px-5 py-3 border-b border-border shrink-0 space-y-2.5">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search cinemas..."
                class="w-full px-3 py-1.5 pr-8 bg-white text-ink border border-border focus:border-ink focus:outline-none placeholder-ink-lighter text-sm"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                @click="chainFilter = 'all'"
                class="px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium border transition-colors cursor-pointer"
                :class="chainFilter === 'all'
                  ? 'border-ink bg-ink text-cream'
                  : 'border-border text-ink-lighter hover:border-ink hover:text-ink'"
              >
                All
              </button>
              <button
                @click="chainFilter = 'vue'"
                class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium border transition-colors cursor-pointer"
                :class="chainFilter === 'vue'
                  ? 'border-ink bg-ink text-cream'
                  : 'border-border text-ink-lighter hover:border-ink hover:text-ink'"
              >
                <img :src="chainIcon('vue')" alt="Vue" class="max-w-3.5 max-h-3.5 aspect-square rounded shrink-0" />
                Vue
              </button>
              <button
                @click="chainFilter = 'cineworld'"
                class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium border transition-colors cursor-pointer"
                :class="chainFilter === 'cineworld'
                  ? 'border-ink bg-ink text-cream'
                  : 'border-border text-ink-lighter hover:border-ink hover:text-ink'"
              >
                <img :src="chainIcon('cineworld')" alt="Cineworld" class="max-w-3.5 max-h-3.5 aspect-square rounded shrink-0" />
                Cineworld
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto min-h-0">
            <div v-if="loadingCinemas" class="px-5 py-8 text-center">
              <div class="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
            <template v-else>
              <div
                v-for="cinema in filteredCinemas"
                :key="cinema.id"
                @click="onToggleCinema(cinema)"
                class="w-full text-left px-5 py-3 hover:bg-ink/5 transition-colors cursor-pointer border-b border-border last:border-b-0 flex items-center gap-3"
              >
                <!-- Checkbox -->
                <div class="shrink-0">
                  <div
                    class="w-4 h-4 border rounded-[3px] flex items-center justify-center transition-colors"
                    :class="isCinemaSelected(cinema) ? 'bg-ink border-ink' : 'border-border-dark/60'"
                  >
                    <svg
                      v-if="isCinemaSelected(cinema)"
                      class="w-2.5 h-2.5 text-cream"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <path d="M3 8.5l3.5 3.5L13 4" />
                    </svg>
                  </div>
                </div>

                <!-- Chain icon -->
                <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-5 max-h-5 aspect-square rounded shrink-0" />

                <!-- Cinema info -->
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink">{{ cinema.name }}</p>
                </div>
              </div>
              <p v-if="!filteredCinemas.length" class="px-5 py-8 text-center text-sm text-ink-lighter">
                No cinemas found
              </p>
            </template>
          </div>

          <!-- Browse Films button -->
          <div v-if="selectedCinemaCount > 0" class="px-5 py-3 border-t border-border shrink-0">
            <button
              @click="browseFilms"
              class="w-full border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer"
            >
              Browse Films ({{ selectedCinemaCount }} cinema{{ selectedCinemaCount !== 1 ? 's' : '' }})
            </button>
          </div>
        </template>

        <!-- Step 2: Films + Date -->
        <template v-if="step === 2">
          <div class="px-5 py-3 border-b border-border shrink-0">
            <DatePicker :model-value="selectedDate" @select="onDateSelect" />
          </div>

          <!-- Cinema filter -->
          <div v-if="selectedCinemas.length > 1 && !loadingFilms && mergedFilms.length" class="px-5 py-2.5 border-b border-border shrink-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium shrink-0">Filter</span>
              <button
                v-for="cinema in selectedCinemas"
                :key="cinema.id"
                @click="toggleCinemaFilter(cinema.id)"
                class="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors cursor-pointer border"
                :class="isCinemaFiltered(cinema.id)
                  ? 'border-ink bg-ink text-cream'
                  : 'border-border text-ink-lighter hover:border-ink hover:text-ink'"
              >
                <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-3.5 max-h-3.5 aspect-square rounded shrink-0" />
                {{ cinema.name }}
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto min-h-0">
            <div v-if="loadingFilms" class="px-5 py-8 text-center">
              <div class="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
            <template v-else-if="visibleFilms.length">
              <div
                v-for="film in visibleFilms"
                :key="film.title"
                class="px-5 py-3 border-b border-border last:border-b-0 transition-colors"
                :class="filmHasSelectedTimes(film.title) ? 'border-l-2 border-l-ink' : ''"
              >
                <div class="flex items-start gap-3">
                  <!-- Poster -->
                  <img
                    v-if="film.posterUrl"
                    :src="film.posterUrl"
                    :alt="film.title"
                    class="w-10 h-14 object-cover shrink-0 border border-border"
                  />

                  <!-- Film info + showtimes -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-ink">{{ film.title }}</p>
                    <p class="text-xs text-ink-lighter mt-0.5">
                      <span v-if="film.durationMins">{{ formatDuration(film.durationMins) }}</span>
                      <span v-if="film.durationMins && film.releaseYear"> &middot; </span>
                      <span v-if="film.releaseYear">{{ film.releaseYear }}</span>
                    </p>

                    <!-- Cinema-grouped showtimes -->
                    <div
                      v-for="cs in film.cinemaShowtimes"
                      :key="cs.cinemaId"
                      class="mt-2"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <img :src="chainIcon(cs.chain)" :alt="cs.chain" class="max-w-5 max-h-5 aspect-square rounded shrink-0" />
                        <span class="text-[11px] text-ink-lighter font-medium">{{ cs.cinemaName }}</span>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="(st, i) in cs.showtimes"
                          :key="i"
                          @click.stop="toggleShowtime(film, cs, st)"
                          class="inline-block px-2 py-0.5 text-xs border rounded transition-colors"
                          :class="st.soldOut
                            ? 'border-border text-ink-lighter line-through opacity-50 cursor-not-allowed'
                            : isShowtimeSelected(film, cs, st)
                              ? 'bg-ink text-cream border-ink cursor-pointer'
                              : 'border-border-dark text-ink cursor-pointer hover:border-ink'"
                        >
                          {{ st.time }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="px-5 py-8 text-center text-sm text-ink-lighter">
              {{ filterCinemaIds.size > 0 ? 'No films at selected cinemas' : 'No films showing on this date' }}
            </p>
          </div>

          <!-- Footer -->
          <div v-if="mergedFilms.length" class="px-5 py-3 border-t border-border shrink-0 flex items-center gap-2">
            <button
              v-if="selectedFilmCount > 0"
              @click="selectedShowtimes = new Map()"
              class="border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer shrink-0"
            >
              Clear
            </button>
            <button
              @click="addFilms"
              :disabled="selectedFilmCount === 0"
              class="flex-1 border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink"
            >
              Add {{ selectedFilmCount }} Film{{ selectedFilmCount !== 1 ? 's' : '' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
