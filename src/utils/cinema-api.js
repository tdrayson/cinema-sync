const BASE_URL = import.meta.env.VITE_CINEMA_PROXY_URL
const cache = new Map()

async function cachedFetch(url) {
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  cache.set(url, data)
  return data
}

export async function fetchCinemas() {
  return cachedFetch(`${BASE_URL}/cinemas`)
}

export async function fetchFilms(cinemaIds, date) {
  const ids = cinemaIds.join(',')
  return cachedFetch(`${BASE_URL}/cinemas/${ids}/films?date=${date}`)
}
