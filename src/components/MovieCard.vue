<script setup>
import { inject } from 'vue'
import RatingDisplay from './RatingDisplay.vue'
import { chainIcon } from '../utils/assets.js'

import { computed } from 'vue'

const props = defineProps({
  movie: Object,
  showtimes: Array,
})

const groupedShowtimes = computed(() => {
  if (!props.showtimes?.length) return []
  const map = new Map()
  for (const st of props.showtimes) {
    const key = st.cinema
    if (!map.has(key)) {
      map.set(key, { cinema: st.cinema, chain: st.chain, times: [] })
    }
    map.get(key).times.push(st.time)
  }
  return Array.from(map.values())
})

const emit = defineEmits(['remove'])
const openTrailer = inject('openTrailer')
</script>

<template>
  <div class="w-72 shrink-0 flex flex-col">
    <!-- Remove button -->
    <div class="flex justify-end mb-1 -mr-1">
      <button
        @click="emit('remove', movie.id)"
        class="w-6 h-6 m-0.5 flex items-center justify-center text-ink-lighter hover:text-ink cursor-pointer transition-colors"
        aria-label="Remove film"
      >
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>

    <!-- Poster -->
    <div class="border border-border relative group/poster bg-cream-dark">
      <img
        v-if="movie.posterUrl"
        :src="movie.posterUrl"
        :alt="movie.title"
        class="w-full aspect-[2/3] object-cover"
      />
      <div
        v-else
        class="w-full aspect-[2/3] flex items-center justify-center text-ink-lighter text-sm px-4 text-center"
      >
        {{ movie.title }}
      </div>
      <!-- Play trailer overlay -->
      <button
        v-if="movie.trailerKey"
        @click="openTrailer(movie.trailerKey)"
        class="group/play absolute inset-0 flex items-center justify-center bg-black/0 group-hover/poster:bg-black/40 focus:bg-black/40 transition-all cursor-pointer focus:outline-none"
        aria-label="Play trailer"
      >
        <span class="w-12 h-12 flex items-center justify-center bg-white/90 opacity-0 group-hover/poster:opacity-100 group-focus/play:opacity-100 transition-opacity">
          <svg class="w-5 h-5 text-ink ml-0.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z"/>
          </svg>
        </span>
      </button>
    </div>

    <!-- Score -->
    <div class="mt-4">
      <template v-if="movie.overall !== null">
        <span class="font-serif text-3xl text-accent leading-none">{{ movie.overall }}</span>
        <span class="text-sm text-ink-lighter ml-1">/100</span>
      </template>
      <template v-else>
        <span class="font-serif text-3xl text-ink-lighter leading-none">N/A</span>
        <span class="text-sm text-ink-lighter ml-1">/ 100</span>
      </template>
    </div>

    <!-- Title -->
    <h3 class="font-serif text-xl text-ink leading-tight mt-2">{{ movie.title }}</h3>

    <!-- Meta: year · runtime · director -->
    <p class="text-xs text-ink-lighter mt-1 flex items-center gap-1.5 flex-wrap">
      <span>{{ movie.year }}</span>
      <template v-if="movie.runtime">
        <span>&middot;</span>
        <span class="inline-flex items-center gap-0.5">
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 1.5"/></svg>
          {{ movie.runtime }}
        </span>
      </template>
      <template v-if="movie.director">
        <span>&middot;</span>
        <span class="inline-flex items-center gap-0.5">
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2a3 3 0 100 6 3 3 0 000-6zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>
          {{ movie.director }}
        </span>
      </template>
    </p>

    <!-- Genres -->
    <div v-if="movie.genres.length" class="flex flex-wrap gap-1.5 mt-3">
      <span
        v-for="genre in movie.genres"
        :key="genre"
        class="text-[10px] uppercase tracking-wide border border-border text-ink px-2 py-0.5 font-medium"
      >
        {{ genre }}
      </span>
    </div>

    <!-- Overview -->
    <p v-if="movie.overview" class="text-sm text-ink-light leading-relaxed mt-3 line-clamp-3">
      {{ movie.overview }}
    </p>

    <!-- Ratings -->
    <RatingDisplay :ratings="movie.ratings" :overall="movie.overall" />

    <!-- Showtimes -->
    <div v-if="groupedShowtimes.length" class="border-t border-border pt-4 mt-4">
      <p class="text-[10px] font-semibold text-ink-lighter uppercase tracking-widest mb-3">Showtimes</p>
      <div class="space-y-3">
        <div v-for="group in groupedShowtimes" :key="group.cinema">
          <div class="flex items-center gap-1.5 mb-1.5">
            <img
              :src="chainIcon(group.chain)"
              :alt="group.chain"
              class="max-w-4 max-h-4 aspect-square rounded shrink-0"
            />
            <span class="text-[11px] text-ink-lighter font-medium">{{ group.cinema }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="time in group.times"
              :key="time"
              class="inline-block px-2 py-0.5 text-xs border border-border-dark text-ink rounded"
            >
              {{ time }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cast -->
    <div v-if="movie.cast.length" class="border-t border-border pt-4 mt-4">
      <p class="text-[10px] font-semibold text-ink-lighter uppercase tracking-widest mb-3">Cast</p>
      <div class="space-y-2.5">
        <div v-for="actor in movie.cast" :key="actor.name" class="flex items-center gap-2.5">
          <img
            v-if="actor.profileUrl"
            :src="actor.profileUrl"
            :alt="actor.name"
            class="w-7 h-7 rounded-full object-cover shrink-0"
          />
          <div v-else class="w-7 h-7 rounded-full bg-cream-dark shrink-0 flex items-center justify-center text-[9px] text-ink-lighter font-medium">
            {{ actor.name.split(' ').map(n => n[0]).join('').slice(0, 2) }}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink leading-tight truncate">{{ actor.name }}</p>
            <p class="text-[11px] text-ink-lighter leading-tight truncate">{{ actor.character }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
