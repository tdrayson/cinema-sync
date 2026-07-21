<script setup>
import RatingBar from './RatingBar.vue'

defineProps({
  ratings: Array,
  overall: Number,
})

function toBoxes(score) {
  if (score === null) return 0
  return Math.max(1, Math.round((score / 100) * 5))
}
</script>

<template>
  <div v-if="ratings?.length">
    <div class="border-t border-border pt-4 mt-4">
      <p class="text-[10px] font-semibold text-ink-lighter uppercase tracking-widest mb-3">Ratings</p>
      <div class="space-y-2">
        <RatingBar
          v-for="r in ratings"
          :key="r.source"
          :label="r.label"
          :score="r.score"
          :display="r.display"
          :filled="toBoxes(r.score)"
          :color="r.color"
        />
      </div>
    </div>
  </div>
</template>
