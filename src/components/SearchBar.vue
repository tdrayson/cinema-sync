<script setup>
import { ref, computed, nextTick } from 'vue'
import SearchResultItem from './SearchResultItem.vue'
import ShareButton from './ShareButton.vue'
import { useMovieSearch } from '../composables/useMovieSearch.js'
import { useComparison } from '../composables/useComparison.js'
import { useCinema } from '../composables/useCinema.js'

const { query, results, popular, loading } = useMovieSearch()
const { addMovie, sortOrder, movies, clearMovies, movieShowtimes, showtimesOnly } = useComparison()

const hasAnyShowtimes = computed(() => {
  for (const st of movieShowtimes.value.values()) {
    if (st && st.length > 0) return true
  }
  return false
})
const { showModal: showCinema } = useCinema()
const open = ref(false)
const searchInput = ref(null)
const container = ref(null)
const showClearConfirm = ref(false)
const showPanel = ref(false)

function confirmClear() {
  clearMovies()
  showClearConfirm.value = false
}

function openCinemaFromPanel() {
  showPanel.value = false
  showCinema.value = true
}

const showResults = computed(() => {
  if (query.value.trim().length >= 2) return results.value
  if (open.value) return popular.value
  return []
})

const dropdownLabel = computed(() => {
  if (query.value.trim().length >= 2) return null
  return 'Popular Now'
})

function onFocus() {
  open.value = true
}

function onFocusOut(e) {
  if (container.value?.contains(e.relatedTarget)) return
  open.value = false
}

function openSearch() {
  open.value = true
  nextTick(() => searchInput.value?.focus())
}

function onSelect(tmdbId) {
  addMovie(tmdbId)
  searchInput.value?.focus()
}

function onInputKeydown(e) {
  if (e.key === 'Escape') {
    open.value = false
    searchInput.value?.blur()
  }
}

defineExpose({ openSearch })
</script>

<template>
  <div class="border-b border-border">
    <div class="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center gap-x-4 gap-y-2">
      <!-- Search input -->
      <div ref="container" class="relative flex-1 min-w-[180px] max-w-xs" @focusout="onFocusOut">
        <div class="relative">
          <input
            ref="searchInput"
            v-model="query"
            @focus="onFocus"
            @keydown="onInputKeydown"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="open && showResults.length > 0"
            aria-controls="search-listbox"
            placeholder="Search films..."
            class="w-full px-3 py-1.5 pr-8 bg-white text-ink border border-border focus:border-ink focus:outline-none placeholder-ink-lighter text-base sm:text-sm"
          />
          <div v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2">
            <div class="w-3.5 h-3.5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
          </div>
          <button
            v-else-if="query"
            @click="query = ''; results = []; open = false"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <!-- Dropdown -->
        <div
          v-if="open && showResults.length"
          id="search-listbox"
          role="listbox"
          class="absolute top-full left-0 mt-1 w-full bg-cream border border-border-dark shadow-lg z-40"
        >
          <p v-if="dropdownLabel" class="px-4 py-2 text-[10px] uppercase tracking-widest text-ink-lighter font-medium border-b border-border">
            {{ dropdownLabel }}
          </p>
          <div class="max-h-80 overflow-y-auto">
            <SearchResultItem
              v-for="movie in showResults"
              :key="movie.id"
              :movie="movie"
              role="option"
              @select="onSelect"
            />
          </div>
        </div>
        <div
          v-else-if="open && query.length >= 2 && !loading"
          class="absolute top-full left-0 mt-1 w-full bg-cream border border-border-dark shadow-lg z-40"
        >
          <div class="px-4 py-6 text-center text-sm text-ink-lighter" role="status">
            No results found
          </div>
        </div>
      </div>

      <!-- Desktop controls -->
      <div class="hidden sm:contents">
        <div class="border-l border-border h-6" />

        <div class="flex items-center gap-2">
          <label for="sort-select" class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium shrink-0">
            Sort
          </label>
          <select
            id="sort-select"
            v-model="sortOrder"
            class="text-xs bg-white text-ink border border-border focus:border-ink focus:outline-none py-1.5 px-2 cursor-pointer"
          >
            <option value="none">Order added</option>
            <option value="desc">Score: high to low</option>
            <option value="asc">Score: low to high</option>
          </select>
        </div>

        <label
          v-if="hasAnyShowtimes"
          class="flex items-center gap-1.5 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            v-model="showtimesOnly"
            class="accent-ink cursor-pointer"
          />
          <span class="text-xs text-ink-lighter">Showtimes only</span>
        </label>

        <button
          v-if="movies.length"
          @click="showClearConfirm = true"
          class="text-xs text-ink-lighter hover:text-accent transition-colors cursor-pointer"
        >
          Clear All
        </button>

        <div class="ml-auto flex items-center gap-2">
          <button
            @click="showCinema = true"
            class="px-3 py-1.5 text-sm uppercase tracking-widest font-medium text-ink/70 hover:text-ink hover:underline transition-colors cursor-pointer flex items-center gap-1.5"
            aria-label="Find Films"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
            </svg>
            Find Films
          </button>
          <ShareButton />
        </div>
      </div>

      <!-- Mobile menu button -->
      <button
        @click="showPanel = true"
        class="sm:hidden text-ink/60 hover:text-ink transition-colors cursor-pointer ml-auto"
        aria-label="Open menu"
      >
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Mobile slide-out panel -->
  <Teleport to="body">
    <div
      v-if="showPanel"
      class="fixed inset-0 z-50 sm:hidden"
    >
      <div class="absolute inset-0 bg-ink/40" @click="showPanel = false"></div>
      <div class="absolute top-0 right-0 bottom-0 w-72 bg-cream border-l border-border shadow-xl flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <span class="text-xs uppercase tracking-widest font-medium text-ink">Menu</span>
          <button
            @click="showPanel = false"
            class="text-ink/50 hover:text-ink transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div class="flex-1 px-5 py-4 flex flex-col">
          <!-- Sort -->
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-medium mb-2">Sort</p>
            <select
              v-model="sortOrder"
              class="w-full text-xs bg-white text-ink border border-border focus:border-ink focus:outline-none py-1.5 px-2 cursor-pointer"
            >
              <option value="none">Order added</option>
              <option value="desc">Score: high to low</option>
              <option value="asc">Score: low to high</option>
            </select>
          </div>

          <!-- Showtimes only -->
          <label
            v-if="hasAnyShowtimes"
            class="flex items-center gap-2 mt-4 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              v-model="showtimesOnly"
              class="accent-ink cursor-pointer"
            />
            <span class="text-xs text-ink-lighter">Showtimes only</span>
          </label>

          <!-- Clear All -->
          <button
            v-if="movies.length"
            @click="showClearConfirm = true; showPanel = false"
            class="mt-4 text-xs text-ink-lighter hover:text-accent transition-colors cursor-pointer text-left"
          >
            Clear all films
          </button>

          <!-- Bottom actions -->
          <div class="mt-auto pt-4 border-t border-border space-y-2">
            <button
              @click="openCinemaFromPanel"
              class="w-full py-2 text-xs uppercase tracking-widest font-medium text-ink border border-border hover:border-ink-lighter transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
              </svg>
              Find Films
            </button>
            <div class="[&>button]:w-full [&>button]:justify-center [&>button]:py-2">
              <ShareButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Clear confirmation modal -->
  <Teleport to="body">
    <div
      v-if="showClearConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div class="absolute inset-0 bg-ink/40" @click="showClearConfirm = false"></div>
      <div class="relative bg-cream border border-border p-8 max-w-sm w-full mx-4 shadow-lg">
        <h3 class="font-serif text-xl text-ink mb-2">Clear all films?</h3>
        <p class="text-sm text-ink-light mb-6">This will remove all films and showtimes from your current session.</p>
        <div class="flex justify-end gap-3">
          <button
            @click="showClearConfirm = false"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-ink border border-border hover:border-ink-lighter transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="confirmClear"
            class="px-4 py-2 text-xs uppercase tracking-widest font-medium text-cream bg-accent hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
