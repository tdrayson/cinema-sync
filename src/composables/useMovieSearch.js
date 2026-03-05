import { ref, watch } from 'vue'
import { tmdbFetch, tmdbImage } from '../utils/api.js'

let debounceTimer = null

function mapResults(results) {
  return (results || []).slice(0, 8).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? m.release_date.substring(0, 4) : '',
    posterUrl: tmdbImage(m.poster_path, 'w92'),
  }))
}

export function useMovieSearch() {
  const query = ref('')
  const results = ref([])
  const popular = ref([])
  const loading = ref(false)

  async function fetchPopular() {
    if (popular.value.length) return
    try {
      const data = await tmdbFetch('/movie/popular')
      popular.value = mapResults(data.results)
    } catch {
      // silent
    }
  }

  fetchPopular()

  watch(query, (val) => {
    clearTimeout(debounceTimer)

    if (!val || val.trim().length < 2) {
      results.value = []
      return
    }

    loading.value = true
    debounceTimer = setTimeout(async () => {
      try {
        const data = await tmdbFetch('/search/movie', {
          query: val.trim(),
          include_adult: 'false',
        })
        results.value = mapResults(data.results)
      } catch {
        results.value = []
      } finally {
        loading.value = false
      }
    }, 300)
  })

  return { query, results, popular, loading, fetchPopular }
}
