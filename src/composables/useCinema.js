import { ref, computed } from 'vue'
import { fetchCinemas as apiFetchCinemas, fetchFilms as apiFetchFilms } from '../utils/cinema-api.js'

const cinemas = ref([])
const selectedCinemas = ref([])
const selectedDate = ref(new Date().toISOString().split('T')[0])
const mergedFilms = ref([])
const loadingCinemas = ref(false)
const loadingFilms = ref(false)
const showModal = ref(false)

let cinemasLoaded = false

export function useCinema() {
  const isActive = computed(() => selectedCinemas.value.length > 0)
  const availableChains = computed(() => {
    const chains = new Set(cinemas.value.map(c => c.chain))
    return chains
  })

  async function loadAllCinemas() {
    if (cinemasLoaded) return
    loadingCinemas.value = true
    try {
      const { cinemas: list } = await apiFetchCinemas()
      cinemas.value = list
      cinemasLoaded = true
    } catch {
      cinemas.value = []
    } finally {
      loadingCinemas.value = false
    }
  }

  function toggleCinema(cinema) {
    const idx = selectedCinemas.value.findIndex(c => c.id === cinema.id)
    if (idx >= 0) {
      selectedCinemas.value = selectedCinemas.value.filter(c => c.id !== cinema.id)
    } else {
      selectedCinemas.value = [...selectedCinemas.value, cinema]
    }
  }

  async function loadFilmsForSelectedCinemas() {
    if (!selectedCinemas.value.length) return
    loadingFilms.value = true
    try {
      const ids = selectedCinemas.value.map(c => c.id)
      const { films } = await apiFetchFilms(ids, selectedDate.value)

      // Enrich cinemaName from local cinema list
      const cinemaMap = new Map(cinemas.value.map(c => [c.id, c.name]))
      for (const film of films) {
        for (const cs of film.cinemaShowtimes) {
          cs.cinemaName = cinemaMap.get(cs.cinemaId) || cs.cinemaId
        }
      }

      mergedFilms.value = films
    } catch {
      mergedFilms.value = []
    } finally {
      loadingFilms.value = false
    }
  }

  function setDate(date) {
    selectedDate.value = date
    if (selectedCinemas.value.length) {
      loadFilmsForSelectedCinemas()
    }
  }

  function filterCinemas(query) {
    if (!query) return cinemas.value
    const q = query.toLowerCase()
    return cinemas.value.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        (c.address && JSON.stringify(c.address).toLowerCase().includes(q))
    )
  }

  function setSelectedCinemas(cinemaList) {
    selectedCinemas.value = cinemaList
  }

  function clear() {
    selectedCinemas.value = []
    mergedFilms.value = []
  }

  return {
    cinemas,
    selectedCinemas,
    selectedDate,
    loadingCinemas,
    loadingFilms,
    showModal,
    isActive,
    mergedFilms,
    availableChains,
    loadAllCinemas,
    loadFilmsForSelectedCinemas,
    toggleCinema,
    setDate,
    filterCinemas,
    setSelectedCinemas,
    clear,
  }
}
