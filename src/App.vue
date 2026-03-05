<script setup>
import { ref, provide, computed, onMounted } from 'vue'
import SearchBar from './components/SearchBar.vue'
import ComparisonGrid from './components/ComparisonGrid.vue'
import TrailerModal from './components/TrailerModal.vue'
import CinemaModal from './components/CinemaModal.vue'
import CinemaBar from './components/CinemaBar.vue'
import { useComparison } from './composables/useComparison.js'
import { tmdbFetch } from './utils/api.js'

const { movies, loadFromUrl, addMovie, setShowtimes, setCinemaTitle } = useComparison()
const trailerVideoId = ref(null)
const searchBar = ref(null)
const stickyHeader = ref(null)
const addFilmErrors = ref([])

const CINEMA_TITLE_PREFIXES = /^(Awards?\s*Season:\s*|Secret\s*Cinema:\s*|Flashback:\s*|RE:\s*|Movies\s*for\s*Juniors:\s*)/i

function cleanCinemaTitle(name) {
  return name.replace(CINEMA_TITLE_PREFIXES, '').trim()
}

const filmCount = computed(() => movies.value.length)

function openTrailer(key) {
  trailerVideoId.value = key
}

function closeTrailer() {
  trailerVideoId.value = null
}

provide('openTrailer', openTrailer)

async function searchTmdb(name, year) {
  const params = { query: name }
  if (year) params.year = year
  const data = await tmdbFetch('/search/movie', params)
  return data.results?.length ? data.results[0] : null
}

async function onAddCinemaFilms(films) {
  const failed = []
  for (const film of films) {
    try {
      const cleanName = cleanCinemaTitle(film.name)
      // Try cleaned title first, then original if different
      let result = await searchTmdb(cleanName, film.releaseYear)
      if (!result && cleanName !== film.name) {
        result = await searchTmdb(film.name, film.releaseYear)
      }
      // Retry without year constraint as last resort
      if (!result && film.releaseYear) {
        result = await searchTmdb(cleanName, null)
      }
      if (result) {
        const tmdbId = result.id
        setCinemaTitle(tmdbId, film.name)
        await addMovie(tmdbId)
        if (film.showtimes?.length) {
          setShowtimes(tmdbId, film.showtimes)
        }
      } else {
        failed.push(film.name)
      }
    } catch {
      failed.push(film.name)
    }
  }
  if (failed.length) {
    addFilmErrors.value = failed
    setTimeout(() => { addFilmErrors.value = [] }, 6000)
  }
}

onMounted(() => {
  loadFromUrl()
  if (stickyHeader.value) {
    const update = () => {
      document.documentElement.style.setProperty('--sticky-header-h', stickyHeader.value.offsetHeight + 'px')
    }
    update()
    new ResizeObserver(update).observe(stickyHeader.value)
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="border-b border-border">
      <div class="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        <h1 class="font-serif text-xl text-ink">CinemaSync</h1>
        <div class="flex items-center gap-4">
          <p class="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-ink-lighter">
            Built by <a href="https://taylordrayson.com" target="_blank" rel="noopener" aria-label="Taylor Drayson (opens in a new tab)" class="text-ink hover:text-accent transition-colors">Taylor Drayson</a>
          </p>
          <a href="https://github.com/tdrayson/cinema-sync" target="_blank" rel="noopener" aria-label="Open GitHub repo (opens in a new tab)" class="text-ink-lighter hover:text-ink transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>

    <!-- Secondary bar -->
    <div ref="stickyHeader" class="sticky top-0 z-20 bg-cream">
      <SearchBar ref="searchBar" />
      <CinemaBar />
    </div>

    <!-- Main -->
    <main class="flex-1 py-8 w-full grid-breakout">
      <ComparisonGrid @add="searchBar?.openSearch()" />
    </main>

    <!-- Footer -->
    <footer class="border-t border-border">
      <div class="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        <p class="text-[10px] uppercase tracking-widest text-ink-lighter">
          CinemaSync &middot; Built by <a href="https://taylordrayson.com" target="_blank" rel="noopener" class="text-ink-lighter hover:text-ink transition-colors">Taylor Drayson</a>
        </p>
        <a href="https://github.com/tdrayson/cinema-sync" target="_blank" rel="noopener" aria-label="Open GitHub repo (opens in a new tab)" class="text-ink-lighter hover:text-ink transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
    </footer>

    <!-- Trailer Modal -->
    <TrailerModal :video-id="trailerVideoId" @close="closeTrailer" />
    <CinemaModal @add-films="onAddCinemaFilms" />

    <!-- Toast: failed films -->
    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="addFilmErrors.length"
          class="fixed bottom-6 right-6 z-50 bg-cream-dark text-ink px-5 py-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.12)] max-w-sm w-full border border-border rounded"
        >
          <div class="flex items-start gap-3">
            <svg class="w-4 h-4 shrink-0 mt-0.5 text-ink-lighter" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5M8 10.5v.5" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-ink">
                {{ addFilmErrors.length === 1 ? "Couldn't find film on TMDB" : `Couldn't find ${addFilmErrors.length} films on TMDB` }}
              </p>
              <p class="text-[11px] text-ink-lighter mt-0.5 truncate">{{ addFilmErrors.join(', ') }}</p>
            </div>
            <button @click="addFilmErrors = []" class="shrink-0 text-ink-lighter hover:text-ink transition-colors cursor-pointer -mr-1" aria-label="Dismiss">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
