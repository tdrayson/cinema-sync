import { asset } from './assets.js'

const SOURCE_CONFIG = {
  TMDB: { label: 'TMDB', icon: null, color: 'bar' },
  'Internet Movie Database': { label: 'IMDB', icon: asset('icons/imdb.jpg'), color: 'bar' },
  'Rotten Tomatoes': { label: 'Rotten Tomatoes', icon: asset('icons/rotten-tomatoes.png'), color: 'bar-rt' },
  Metacritic: { label: 'Metacritic', icon: asset('icons/metacritic.png'), color: 'bar' },
}

function parseOmdbValue(source, value) {
  if (source === 'Internet Movie Database') {
    const num = parseFloat(value)
    return isNaN(num) ? null : { score: Math.round(num * 10), display: `${num}/10` }
  }
  if (source === 'Rotten Tomatoes') {
    const num = parseInt(value)
    return isNaN(num) ? null : { score: num, display: `${num}%` }
  }
  if (source === 'Metacritic') {
    const num = parseInt(value)
    return isNaN(num) ? null : { score: num, display: `${num}/100` }
  }
  return null
}

export function normalizeRatings(tmdbVoteAverage, omdbRatings = []) {
  const omdbMap = {}
  for (const r of omdbRatings) {
    const config = SOURCE_CONFIG[r.Source]
    if (!config) continue
    const parsed = parseOmdbValue(r.Source, r.Value)
    if (parsed !== null) {
      omdbMap[r.Source] = { ...parsed, ...config, source: r.Source }
    }
  }

  const imdb = omdbMap['Internet Movie Database']
  const rt = omdbMap['Rotten Tomatoes']
  const mc = omdbMap['Metacritic']

  const ratings = [
    imdb
      ? { source: 'Internet Movie Database', label: 'IMDB', icon: asset('icons/imdb.jpg'), score: imdb.score, display: imdb.display, color: 'bar' }
      : { source: 'Internet Movie Database', label: 'IMDB', icon: asset('icons/imdb.jpg'), score: null, display: 'N/A', color: 'bar' },
    rt
      ? { source: 'Rotten Tomatoes', label: 'Rotten Tomatoes', icon: asset('icons/rotten-tomatoes.png'), score: rt.score, display: rt.display, color: 'bar-rt' }
      : { source: 'Rotten Tomatoes', label: 'Rotten Tomatoes', icon: asset('icons/rotten-tomatoes.png'), score: null, display: 'N/A', color: 'bar-rt' },
    mc
      ? { source: 'Metacritic', label: 'Metacritic', icon: asset('icons/metacritic.png'), score: mc.score, display: mc.display, color: 'bar' }
      : { source: 'Metacritic', label: 'Metacritic', icon: asset('icons/metacritic.png'), score: null, display: 'N/A', color: 'bar' },
  ]

  const scored = ratings.filter((r) => r.score !== null)
  const overall =
    scored.length > 0
      ? Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length)
      : null

  return { ratings, overall }
}
