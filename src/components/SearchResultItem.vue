<script setup>
defineProps({
  movie: Object,
})

defineEmits(['select'])
</script>

<template>
  <button
    @mousedown.prevent
    @click="$emit('select', movie.id)"
    @keydown.enter.prevent="$emit('select', movie.id)"
    class="flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left cursor-pointer hover:bg-cream-dark"
  >
    <img
      v-if="movie.posterUrl"
      :src="movie.posterUrl"
      :alt="movie.title"
      class="w-8 h-12 object-cover shrink-0"
      @error="movie.posterUrl = null"
    />
    <div v-else class="w-8 h-12 bg-border shrink-0 flex items-center justify-center text-[10px] text-ink-lighter">
      ?
    </div>
    <div class="min-w-0">
      <p class="text-sm font-medium text-ink truncate">{{ movie.title }}</p>
      <p class="text-xs text-ink-lighter">{{ movie.year }}</p>
    </div>
  </button>
</template>
