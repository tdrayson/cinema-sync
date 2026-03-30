<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useCinema } from '../composables/useCinema.js'
import { useComparison } from '../composables/useComparison.js'
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
  availableChains,
  loadAllCinemas,
  loadFilmsForSelectedCinemas,
  toggleCinema,
  setDate,
  filterCinemas,
} = useCinema()

const {
  movies: comparisonMovies,
  movieShowtimes,
  cinemaTitleMap,
  clearAllShowtimes,
  clearShowtimesForCinema,
} = useComparison()

const step = ref(1)
const searchQuery = ref('')
const selectedShowtimes = ref(new Map())
const modal = ref(null)
const closeBtn = ref(null)
let previouslyFocused = null

const chainFilter = ref('all') // 'all' | 'vue' | 'cineworld'
const mobileDrawerOpen = ref(false)
const pendingDate = ref(null)
const showDateConfirm = ref(false)

const lightboxPoster = ref(null)

// Generic confirmation dialog
const showConfirm = ref(false)
const confirmTitle = ref('')
const confirmText = ref('')
let confirmCallback = null

function requestConfirm(title, text, cb) {
  confirmTitle.value = title
  confirmText.value = text
  confirmCallback = cb
  showConfirm.value = true
}

function executeConfirm() {
  if (confirmCallback) confirmCallback()
  showConfirm.value = false
  confirmCallback = null
}

function cancelConfirm() {
  showConfirm.value = false
  confirmCallback = null
}

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
    next.set(key, { cinemaId: cs.cinemaId, cinema: cs.cinemaName, chain: cs.chain, time: st.time, screenType: st.screenType || '2D', bookingLink: st.bookingLink || null })
  }
  selectedShowtimes.value = next
}


function groupByScreenType(showtimes) {
  const map = new Map()
  for (const st of showtimes) {
    const type = st.screenType || '2D'
    if (!map.has(type)) map.set(type, [])
    map.get(type).push(st)
  }
  return Array.from(map.entries())
}

// Grouped summary of selected showtimes for sidebar
const selectionSummary = computed(() => {
  const filmMap = new Map()
  for (const [key, details] of selectedShowtimes.value) {
    const filmTitle = key.split('::')[0]
    if (!filmMap.has(filmTitle)) {
      const film = mergedFilms.value.find(f => f.title === filmTitle)
      filmMap.set(filmTitle, {
        title: filmTitle,
        posterUrl: film?.posterUrl || null,
        cinemas: new Map(),
      })
    }
    const entry = filmMap.get(filmTitle)
    const cinemaKey = details.cinema
    if (!entry.cinemas.has(cinemaKey)) {
      entry.cinemas.set(cinemaKey, { chain: details.chain, times: [] })
    }
    entry.cinemas.get(cinemaKey).times.push(details.time)
  }
  return Array.from(filmMap.values()).map(f => ({
    ...f,
    cinemas: Array.from(f.cinemas.entries()).map(([name, data]) => ({ name, ...data })),
  }))
})

function formatWithOrdinal(date) {
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

const sidebarDate = computed(() => {
  if (!selectedDate.value) return ''
  const d = new Date(selectedDate.value + 'T00:00:00')
  return formatWithOrdinal(d)
})

function removeFilmSelection(filmTitle) {
  const next = new Map(selectedShowtimes.value)
  for (const key of [...next.keys()]) {
    if (key.startsWith(filmTitle + '::')) next.delete(key)
  }
  selectedShowtimes.value = next
}

// Check if main view has any showtimes
const hasMainViewShowtimes = computed(() => {
  for (const [, st] of movieShowtimes.value) {
    if (st && st.length > 0) return true
  }
  return false
})

// Resolve cinema API film title for a TMDB movie
function resolveCinemaTitle(movie) {
  // 1. Stored mapping from previous add (most reliable)
  const stored = cinemaTitleMap.value.get(movie.id)
  if (stored) return stored
  // 2. Match against loaded cinema API films
  if (mergedFilms.value.length) {
    const match = mergedFilms.value.find(
      f => f.title.toLowerCase() === movie.title.toLowerCase()
    )
    if (match) return match.title
  }
  // 3. Fall back to TMDB title
  return movie.title
}

// Sync existing main view showtimes into modal's selectedShowtimes
function syncFromMainView() {
  const next = new Map()
  for (const movie of comparisonMovies.value) {
    const showtimes = movieShowtimes.value.get(movie.id)
    if (!showtimes?.length) continue
    const filmTitle = resolveCinemaTitle(movie)
    for (const st of showtimes) {
      if (!st.cinemaId) continue
      const key = `${filmTitle}::${st.cinemaId}::${st.time}`
      next.set(key, {
        cinemaId: st.cinemaId,
        cinema: st.cinema,
        chain: st.chain,
        time: st.time,
        screenType: st.screenType || '2D',
        bookingLink: st.bookingLink || null,
      })
    }
  }
  selectedShowtimes.value = next
}

function openStep1() {
  step.value = 1
  searchQuery.value = ''
  chainFilter.value = 'all'
  mobileDrawerOpen.value = false
}

function onToggleCinema(cinema) {
  toggleCinema(cinema)
}

function cinemaHasShowtimes(cinemaId) {
  for (const key of selectedShowtimes.value.keys()) {
    if (key.split('::')[1] === cinemaId) return true
  }
  return false
}

function doRemoveSidebarCinema(cinema) {
  selectedCinemas.value = selectedCinemas.value.filter(c => c.id !== cinema.id)
  // Remove showtimes for this cinema (modal + main view)
  const next = new Map(selectedShowtimes.value)
  for (const key of [...next.keys()]) {
    if (key.split('::')[1] === cinema.id) next.delete(key)
  }
  selectedShowtimes.value = next
  clearShowtimesForCinema(cinema.id)
  // Remove from filter
  const nextFilter = new Set(filterCinemaIds.value)
  nextFilter.delete(cinema.id)
  filterCinemaIds.value = nextFilter
  // If no cinemas left, go back to step 1
  if (!selectedCinemas.value.length) {
    step.value = 1
    searchQuery.value = ''
    chainFilter.value = 'all'
  }
}

function removeSidebarCinema(cinema) {
  if (cinemaHasShowtimes(cinema.id)) {
    requestConfirm(
      'Remove cinema?',
      `Removing ${cinema.name} will also remove its selected showtimes.`,
      () => doRemoveSidebarCinema(cinema)
    )
  } else {
    doRemoveSidebarCinema(cinema)
  }
}

function doClearAllCinemas() {
  selectedCinemas.value = []
  selectedShowtimes.value = new Map()
  clearAllShowtimes()
  filterCinemaIds.value = new Set()
  step.value = 1
  searchQuery.value = ''
  chainFilter.value = 'all'
}

function clearAllCinemas() {
  if (selectedShowtimes.value.size > 0) {
    requestConfirm(
      'Clear all cinemas?',
      'This will also remove all selected showtimes.',
      doClearAllCinemas
    )
  } else {
    doClearAllCinemas()
  }
}

function browseFilms() {
  if (!selectedCinemas.value.length) return
  step.value = 2
  filterCinemaIds.value = new Set()
  loadFilmsForSelectedCinemas().then(() => syncFromMainView())
}

function onDateSelect(dateStr) {
  if (selectedShowtimes.value.size > 0 || hasMainViewShowtimes.value) {
    pendingDate.value = dateStr
    showDateConfirm.value = true
    return
  }
  setDate(dateStr)
  filterCinemaIds.value = new Set()
}

function confirmDateChange() {
  setDate(pendingDate.value)
  selectedShowtimes.value = new Map()
  clearAllShowtimes()
  filterCinemaIds.value = new Set()
  showDateConfirm.value = false
  pendingDate.value = null
}

function cancelDateChange() {
  showDateConfirm.value = false
  pendingDate.value = null
}

function openPosterLightbox(posterUrl, title) {
  if (!posterUrl) return
  lightboxPoster.value = { posterUrl, title }
}

function closePosterLightbox() {
  lightboxPoster.value = null
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
  mobileDrawerOpen.value = false
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

let savedScrollY = 0

watch(showModal, async (val) => {
  if (val) {
    previouslyFocused = document.activeElement
    savedScrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    loadAllCinemas()
    if (selectedCinemas.value.length > 0) {
      step.value = 2
      filterCinemaIds.value = new Set()
      loadFilmsForSelectedCinemas().then(() => syncFromMainView())
    } else {
      step.value = 1
    }
    await nextTick()
    closeBtn.value?.focus()
  } else {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    window.scrollTo(0, savedScrollY)
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
      class="fixed inset-0 z-50 flex items-center justify-center sm:p-4 overscroll-contain"
      @keydown="onKeydown"
    >
      <div class="fixed inset-0 bg-ink/40 hidden sm:block" aria-hidden="true" @click="closeModal" />
      <div class="relative bg-cream sm:border sm:border-border-dark shadow-xl w-full flex h-full sm:h-[600px] sm:max-w-3xl">
        <!-- Main content -->
        <div class="flex flex-col flex-1 min-w-0">
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
              {{ step === 1 ? 'Find Cinema' : 'Select Films' }}
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
                class="w-full px-3 py-1.5 pr-8 bg-white text-ink border border-border focus:border-ink focus:outline-none placeholder-ink-lighter text-base sm:text-sm"
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
            <div v-if="availableChains.size > 1" class="flex items-center gap-1.5">
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
                v-if="availableChains.has('vue')"
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
                v-if="availableChains.has('cineworld')"
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

          <!-- Mobile: Browse Films footer -->
          <div v-if="selectedCinemaCount > 0" class="sm:hidden px-5 py-3 border-t border-border shrink-0">
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
          <div v-if="selectedCinemas.length > 1 && !loadingFilms && mergedFilms.length" class="flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0">
            <span class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium shrink-0">Filter</span>
            <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <button
                v-for="cinema in selectedCinemas"
                :key="cinema.id"
                @click="toggleCinemaFilter(cinema.id)"
                class="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors cursor-pointer border shrink-0 whitespace-nowrap"
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
                  <button
                    v-if="film.posterUrl"
                    type="button"
                    @click.stop="openPosterLightbox(film.posterUrl, film.title)"
                    class="group/poster relative w-10 h-14 shrink-0 border border-border overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 cursor-zoom-in"
                    aria-label="Open larger poster in lightbox"
                    :title="`Click to enlarge poster for ${film.title}`"
                  >
                    <img
                      :src="film.posterUrl"
                      :alt="film.title"
                      class="w-full h-full object-cover"
                    />
                    <div class="pointer-events-none absolute inset-0 bg-black/10 opacity-0 group-hover/poster:opacity-100 transition-opacity" />
                  </button>
                  <div v-else class="w-10 h-14 shrink-0 border border-border bg-cream-dark flex items-center justify-center">
                    <svg class="w-5 h-5 text-ink-lighter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="5" width="18" height="14" rx="1" />
                      <path d="M3 10h18" />
                      <path d="M10 5v14" />
                    </svg>
                  </div>

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
                      <div
                        v-for="[screenType, sts] in groupByScreenType(cs.showtimes)"
                        :key="screenType"
                        class="mb-1.5 last:mb-0"
                      >
                        <p v-if="screenType" class="text-[10px] uppercase tracking-wider text-ink-lighter font-medium mb-1">{{ screenType }}</p>
                        <div class="flex flex-wrap gap-1.5">
                          <span
                            v-for="(st, i) in sts"
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
              </div>
            </template>
            <p v-else class="px-5 py-8 text-center text-sm text-ink-lighter">
              {{ filterCinemaIds.size > 0 ? 'No films at selected cinemas' : 'No films showing on this date' }}
            </p>
          </div>

          <!-- Mobile footer (step 2) -->
          <div class="sm:hidden border-t border-border shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
            <!-- Expandable selection drawer -->
            <div v-if="mobileDrawerOpen" class="max-h-52 overflow-y-auto border-b border-border">
              <div class="px-5 py-3">
                <!-- Cinemas -->
                <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium mb-1.5">Cinemas</p>
                <div class="space-y-1 mb-3">
                  <div v-for="cinema in selectedCinemas" :key="cinema.id" class="flex items-center gap-1.5">
                    <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-3.5 max-h-3.5 aspect-square rounded shrink-0" />
                    <span class="text-xs text-ink truncate">{{ cinema.name }}</span>
                  </div>
                </div>
                <!-- Date -->
                <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium mb-1">Date</p>
                <p class="text-xs text-ink mb-3">{{ sidebarDate }}</p>
                <!-- Films -->
                <template v-if="selectionSummary.length">
                  <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium mb-1.5">Films ({{ selectedFilmCount }})</p>
                  <div class="space-y-2">
                    <div v-for="film in selectionSummary" :key="film.title">
                      <p class="text-xs font-medium text-ink">{{ film.title }}</p>
                      <div v-for="cinema in film.cinemas" :key="cinema.name" class="mt-1">
                        <div class="flex items-center gap-1 mb-0.5">
                          <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-3 max-h-3 aspect-square rounded shrink-0" />
                          <span class="text-[10px] text-ink-lighter truncate">{{ cinema.name }}</span>
                        </div>
                        <div class="flex flex-wrap gap-1">
                          <span v-for="time in cinema.times" :key="time" class="text-[10px] px-1.5 py-0.5 bg-ink/15 text-ink rounded">{{ time }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <p v-else class="text-xs text-ink-lighter">Select showtimes from the list</p>
              </div>
            </div>
            <!-- Action bar -->
            <div class="px-5 py-3 flex items-center gap-2">
              <button
                @click="mobileDrawerOpen = !mobileDrawerOpen"
                class="flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-widest font-medium text-ink-lighter hover:text-ink transition-colors cursor-pointer shrink-0"
              >
                <svg class="w-3.5 h-3.5 transition-transform" :class="mobileDrawerOpen ? 'rotate-180' : ''" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 6l4 4 4-4" />
                </svg>
                {{ selectedFilmCount > 0 ? `${selectedFilmCount} film${selectedFilmCount !== 1 ? 's' : ''}` : 'Details' }}
              </button>
              <button
                @click="addFilms"
                :disabled="selectedShowtimes.size === 0"
                class="flex-1 border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                Add Films
              </button>
            </div>
          </div>
        </template>
        </div>

        <!-- Sidebar: Selection summary -->
        <div
          class="hidden sm:flex flex-col w-64 shrink-0 border-l border-border bg-cream-dark/50"
        >
          <!-- Sidebar heading -->
          <div class="px-4 py-3 border-b border-border shrink-0">
            <p class="text-sm font-medium uppercase tracking-widest text-ink">Selection</p>
          </div>

          <!-- Cinemas -->
          <div class="group/cinemas px-4 py-3 border-b border-border shrink-0">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium">Cinemas</p>
              <button
                v-if="selectedCinemas.length"
                @click="clearAllCinemas"
                class="text-[10px] text-ink-lighter hover:text-accent transition-colors cursor-pointer opacity-0 group-hover/cinemas:opacity-100"
              >
                Clear
              </button>
            </div>
            <div v-if="selectedCinemas.length" class="space-y-1.5">
              <div
                v-for="cinema in selectedCinemas"
                :key="cinema.id"
                class="group/cinema-row flex items-center gap-1.5"
              >
                <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-3.5 max-h-3.5 aspect-square rounded shrink-0" />
                <span class="text-xs text-ink truncate flex-1">{{ cinema.name }}</span>
                <button
                  @click="removeSidebarCinema(cinema)"
                  class="shrink-0 text-ink/30 hover:text-ink transition-colors cursor-pointer opacity-0 group-hover/cinema-row:opacity-100"
                  aria-label="Remove cinema"
                >
                  <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-ink-lighter">Select cinemas from the list</p>
          </div>

          <!-- Date (step 2 only) -->
          <template v-if="step === 2">
          <div class="px-4 py-3 border-b border-border shrink-0">
            <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium mb-1">Date</p>
            <p class="text-xs text-ink">{{ sidebarDate }}</p>
          </div>

          <!-- Selected films -->
          <div class="group/films px-4 py-3 shrink-0">
            <div class="flex items-center justify-between">
              <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium">
                Films{{ selectionSummary.length ? ` (${selectedFilmCount})` : '' }}
              </p>
              <button
                v-if="selectionSummary.length"
                @click="selectedShowtimes = new Map()"
                class="text-[10px] text-ink-lighter hover:text-accent transition-colors cursor-pointer opacity-0 group-hover/films:opacity-100"
              >
                Clear
              </button>
            </div>
            <p v-if="!selectionSummary.length" class="text-xs text-ink-lighter mt-1">Select showtimes from the list</p>
          </div>
          <div class="flex-1 overflow-y-auto min-h-0">
            <template v-if="selectionSummary.length">
              <div
                v-for="film in selectionSummary"
                :key="film.title"
                class="group/film-row px-4 py-3 border-b border-border last:border-b-0"
              >
                <div class="flex items-start gap-2.5">
                  <button
                    v-if="film.posterUrl"
                    type="button"
                    @click.stop="openPosterLightbox(film.posterUrl, film.title)"
                    class="group/poster relative w-8 h-12 shrink-0 border border-border overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 cursor-zoom-in"
                    aria-label="Open larger poster in lightbox"
                    :title="`Click to enlarge poster for ${film.title}`"
                  >
                    <img
                      :src="film.posterUrl"
                      :alt="film.title"
                      class="w-full h-full object-cover"
                    />
                    <div class="pointer-events-none absolute inset-0 bg-black/10 opacity-0 group-hover/poster:opacity-100 transition-opacity" />
                  </button>
                  <div v-else class="w-8 h-12 shrink-0 border border-border bg-cream-dark flex items-center justify-center">
                    <svg class="w-4 h-4 text-ink-lighter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="5" width="18" height="14" rx="1" />
                      <path d="M3 10h18" />
                      <path d="M10 5v14" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-1">
                      <p class="text-xs font-medium text-ink leading-tight">{{ film.title }}</p>
                      <button
                        @click="removeFilmSelection(film.title)"
                        class="shrink-0 text-ink/30 hover:text-ink transition-colors cursor-pointer opacity-0 group-hover/film-row:opacity-100"
                        aria-label="Remove film"
                      >
                        <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </div>
                    <div v-for="cinema in film.cinemas" :key="cinema.name" class="mt-1.5">
                      <div class="flex items-center gap-1 mb-0.5">
                        <img :src="chainIcon(cinema.chain)" :alt="cinema.chain" class="max-w-3 max-h-3 aspect-square rounded shrink-0" />
                        <span class="text-[10px] text-ink-lighter truncate">{{ cinema.name }}</span>
                      </div>
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="time in cinema.times"
                          :key="time"
                          class="text-[10px] px-1.5 py-0.5 bg-ink/15 text-ink rounded"
                        >
                          {{ time }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
          </template>

          <!-- Browse Films button (step 1) -->
          <div v-if="step === 1 && selectedCinemaCount > 0" class="mt-auto px-4 py-3 border-t border-border shrink-0 sticky bottom-0 bg-cream-dark/50">
            <button
              @click="browseFilms"
              class="w-full border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer"
            >
              Browse Films
            </button>
          </div>

          <!-- Add Films button (step 2) -->
          <div v-if="step === 2 && selectedShowtimes.size > 0" class="mt-auto px-4 py-3 border-t border-border shrink-0 sticky bottom-0 bg-cream-dark/50">
            <button
              @click="addFilms"
              class="w-full border border-border-dark px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink hover:bg-ink hover:text-cream transition-colors cursor-pointer"
            >
              Add {{ selectedFilmCount }} Film{{ selectedFilmCount !== 1 ? 's' : '' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Poster lightbox -->
  <Teleport to="body">
    <div
      v-if="lightboxPoster"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-ink/70" @click="closePosterLightbox" />
      <div class="relative max-w-md w-auto">
        <button
          type="button"
          @click="closePosterLightbox"
          class="absolute -top-8 right-0 text-cream hover:text-white text-sm uppercase tracking-widest cursor-pointer"
        >
          Close
        </button>
        <img
          :src="lightboxPoster.posterUrl"
          :alt="lightboxPoster.title"
          class="max-h-[80vh] w-auto object-contain border border-border shadow-2xl bg-cream"
        />
        <p class="mt-2 text-xs text-center text-cream-dark line-clamp-2">
          {{ lightboxPoster.title }}
        </p>
      </div>
    </div>
  </Teleport>

  <!-- Date change confirmation -->
  <Teleport to="body">
    <div
      v-if="showDateConfirm"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-ink/40" @click="cancelDateChange" />
      <div class="relative bg-cream border border-border p-6 max-w-sm w-full shadow-lg">
        <h3 class="font-serif text-lg text-ink mb-2">Change date?</h3>
        <p class="text-sm text-ink-light mb-5">Your selected showtimes will be cleared when changing the date.</p>
        <div class="flex justify-end gap-2">
          <button
            @click="cancelDateChange"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink border border-border hover:border-ink-lighter transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="confirmDateChange"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-cream bg-ink hover:bg-ink/80 transition-colors cursor-pointer"
          >
            Change Date
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Generic confirmation dialog -->
  <Teleport to="body">
    <div
      v-if="showConfirm"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div class="fixed inset-0 bg-ink/40" @click="cancelConfirm" />
      <div class="relative bg-cream border border-border p-6 max-w-sm w-full shadow-lg">
        <h3 class="font-serif text-lg text-ink mb-2">{{ confirmTitle }}</h3>
        <p class="text-sm text-ink-light mb-5">{{ confirmText }}</p>
        <div class="flex justify-end gap-2">
          <button
            @click="cancelConfirm"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink border border-border hover:border-ink-lighter transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="executeConfirm"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-cream bg-ink hover:bg-ink/80 transition-colors cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
