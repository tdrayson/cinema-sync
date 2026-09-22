import { ref, computed, watch } from 'vue'
import { fetchCinemas as apiFetchCinemas, fetchFilms as apiFetchFilms } from '../utils/cinema-api.js'

const cinemas = ref([])
const selectedCinemas = ref([])
const selectedDate = ref(new Date().toISOString().split('T')[0])
const afterTime = ref(localStorage.getItem('cinema-sync:afterTime') || '')
const mergedFilms = ref([])
const loadingCinemas = ref(false)
const loadingFilms = ref(false)
const showModal = ref(false)
const cinemasNotice = ref('')
const filmsNotice = ref('')

watch(afterTime, (val) => {
  if (val) {
    localStorage.setItem('cinema-sync:afterTime', val)
  } else {
    localStorage.removeItem('cinema-sync:afterTime')
  }
})

let cinemasLoaded = false

/**
 * Turns the API's errors[] into one short line naming the chains that failed.
 * @param {string[]} errors raw messages, e.g. "Cineworld cinemas: 403" or "cw-073: 403"
 * @returns {string} empty when there is nothing to report
 */
function describeErrors(errors = []) {
  if (!errors.length) return ''
  const chains = new Set()
  for (const e of errors) {
    if (/^cw-|cineworld/i.test(e)) chains.add('Cineworld')
    else if (/^vue-|vue/i.test(e)) chains.add('Vue')
  }
  if (!chains.size) return 'Some listings could not be loaded right now.'
  return `${[...chains].join(' and ')} listings are unavailable right now.`
}

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
      const { cinemas: list, errors } = await apiFetchCinemas()
      cinemas.value = list
      cinemasNotice.value = describeErrors(errors)
      cinemasLoaded = true
    } catch {
      cinemas.value = []
      cinemasNotice.value = 'Cinemas could not be loaded right now.'
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
      const { films, errors } = await apiFetchFilms(ids, selectedDate.value)
      filmsNotice.value = describeErrors(errors)

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
      filmsNotice.value = 'Films could not be loaded right now.'
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
    filmsNotice.value = ''
  }

  return {
    cinemas,
    selectedCinemas,
    selectedDate,
    afterTime,
    loadingCinemas,
    loadingFilms,
    showModal,
    cinemasNotice,
    filmsNotice,
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
