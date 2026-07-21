import { ref, computed, watch } from 'vue';
import { fetchMovieDetails } from './useMovieDetails.js';
import { fetchCinemas, fetchFilms } from '../utils/cinema-api.js';
import { useCinema } from './useCinema.js';

const movies = ref([]);
const loadingIds = ref(new Set());
const sortOrder = ref(localStorage.getItem('sortOrder') || 'none');
const movieShowtimes = ref(new Map());
const showtimesOnly = ref(false);
// Maps cinema API film title → tmdbId (populated when adding films via cinema flow)
const cinemaTitleMap = ref(new Map());

// Films added straight from the cinema listings because TMDB had no match get a
// synthetic string id under this prefix. TMDB ids are numeric, so the two
// namespaces can never collide.
const FALLBACK_ID_PREFIX = 'c:';

function isFallbackId(id) {
  return typeof id === 'string' && id.startsWith(FALLBACK_ID_PREFIX);
}

// Object keys in the share payload are always strings; TMDB ids must go back to
// numbers to match the movie list, while fallback ids stay as they are.
function decodeMovieId(key) {
  return isFallbackId(key) ? key : Number(key);
}

// The readable slug drops any non-Latin characters, so two titles that differ
// only outside [a-z0-9] would collapse onto the same id. A short hash of the
// full title is appended to keep ids distinct while staying URL-friendly.
function titleHash(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function fallbackId(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${FALLBACK_ID_PREFIX}${slug}-${titleHash(title)}`;
}

// Builds a movie in the same shape as fetchMovieDetails() so every consumer
// (cards, sorting, sharing) can treat it like any other film. The TMDB-only
// fields are present but empty rather than absent.
function buildFallbackMovie({ title, posterUrl, releaseYear, durationMins }) {
  return {
    id: fallbackId(title),
    title,
    year: releaseYear ? String(releaseYear) : '',
    runtime: durationMins ? `${durationMins}m` : null,
    director: null,
    overview: null,
    posterUrl: posterUrl || null,
    genres: [],
    cast: [],
    ratings: [],
    overall: null,
    trailerKey: null,
    fallback: true,
  };
}

function encodeData(ids) {
  const data = { f: ids };

  // Fallback films can't be rehydrated from TMDB, so their details travel in
  // the URL. Only the fields the card actually renders are carried.
  const fallbacks = movies.value
    .filter((m) => isFallbackId(m.id))
    .filter((m) => ids.includes(m.id))
    .map((m) => {
      const entry = { i: m.id, t: m.title };
      if (m.posterUrl) entry.p = m.posterUrl;
      if (m.year) entry.y = m.year;
      if (m.runtime) entry.r = m.runtime;
      return entry;
    });
  if (fallbacks.length) {
    data.x = fallbacks;
  }

  // Preserve the sender's sort preference so the recipient sees the films
  // in the same order/state (default 'none' is left implicit to keep URLs short)
  if (sortOrder.value && sortOrder.value !== 'none') {
    data.so = sortOrder.value;
  }

  const showtimesObj = {};
  for (const id of ids) {
    const st = movieShowtimes.value.get(id);
    if (st && st.length) {
      showtimesObj[id] = st.map(({ cinemaId, time }) => ({
        ci: cinemaId,
        t: time,
      }));
    }
  }
  if (Object.keys(showtimesObj).length) {
    data.s = showtimesObj;
    const { selectedDate } = useCinema();
    if (selectedDate.value) {
      data.dt = selectedDate.value;
    }
  }

  return base64Encode(JSON.stringify(data));
}

// Film titles now travel in the payload, and btoa() throws on any character
// above U+00FF (e.g. an em dash or CJK title), so the JSON is converted to
// UTF-8 bytes first. Pure-ASCII payloads encode identically to plain btoa(),
// which keeps previously shared links readable.
function base64Encode(json) {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(encoded) {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildUrl(ids) {
  const base = window.location.origin + window.location.pathname;
  if (!ids.length) return base;
  return `${base}?d=${encodeURIComponent(encodeData(ids))}`;
}

function parseData(encoded) {
  return JSON.parse(base64Decode(decodeURIComponent(encoded)));
}

function updateUrl() {
  const ids = movies.value.map((m) => m.id);
  window.history.replaceState({}, '', buildUrl(ids));
}

function getShareUrl() {
  const ids = movies.value.map((m) => m.id);
  return buildUrl(ids);
}

function getShareMessage(truncateUrl) {
  const count = movies.value.length;
  const url = truncateUrl ? getTruncatedUrl() : getShareUrl();
  if (!count) return url;

  const hasShowtimes = movies.value.some((m) => {
    const st = movieShowtimes.value.get(m.id);
    return st && st.length > 0;
  });

  // Derive distinct cinema locations from current showtimes
  const cinemaNames = new Set();
  if (hasShowtimes) {
    for (const [movieId, showtimes] of movieShowtimes.value.entries()) {
      if (!movies.value.some((m) => m.id === movieId)) continue;
      for (const st of showtimes || []) {
        if (st?.cinema) {
          cinemaNames.add(st.cinema);
        }
      }
    }
  }
  const cinemaCount = cinemaNames.size;

  const { selectedDate } = useCinema();
  let datePart = '';
  if (hasShowtimes && selectedDate.value) {
    try {
      const d = new Date(`${selectedDate.value}T00:00:00`);
      const formatted = d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      datePart = ` on ${formatted}`;
    } catch {
      datePart = '';
    }
  }

  let locationPart = '';
  if (hasShowtimes && cinemaCount === 1) {
    const [name] = cinemaNames;
    locationPart = ` at ${name}`;
  } else if (hasShowtimes && cinemaCount > 1) {
    locationPart = ` at ${cinemaCount} cinemas`;
  }

  if (hasShowtimes) {
    return `I've found some films and showtimes${datePart}${locationPart} — have a look and let me know what works for you!\n${url}`;
  }

  return `I've shortlisted ${count === 1 ? 'a film' : 'some films'} to watch — what do you think?\n${url}`;
}

function getTruncatedUrl() {
  const url = getShareUrl();
  try {
    const parsed = new URL(url);
    const base = parsed.origin + parsed.pathname;
    if (parsed.search) return base + parsed.search.slice(0, 10) + '…';
    return base;
  } catch {
    return url;
  }
}

export function useComparison() {
  const sortedMovies = computed(() => {
    let list = movies.value;
    if (showtimesOnly.value) {
      list = list.filter((m) => {
        const st = movieShowtimes.value.get(m.id);
        return st && st.length > 0;
      });
    }
    if (sortOrder.value === 'none' || sortOrder.value === 'custom') return list;
    return [...list].sort((a, b) => {
      const aScore = a.overall ?? -1;
      const bScore = b.overall ?? -1;
      return sortOrder.value === 'desc' ? bScore - aScore : aScore - bScore;
    });
  });

  async function addMovie(tmdbId) {
    // Fallback films have no TMDB record to fetch — they are added directly
    // via addFallbackMovie() or restored from the share payload.
    if (isFallbackId(tmdbId)) return;
    if (movies.value.some((m) => m.id === tmdbId)) return;
    if (loadingIds.value.has(tmdbId)) return;

    loadingIds.value = new Set([...loadingIds.value, tmdbId]);
    try {
      const movie = await fetchMovieDetails(tmdbId);
      if (!movies.value.some((m) => m.id === tmdbId)) {
        movies.value = [...movies.value, movie];
      }
    } finally {
      const next = new Set(loadingIds.value);
      next.delete(tmdbId);
      loadingIds.value = next;
    }
  }

  // Adds a film using only what the cinema listings gave us, for when TMDB has
  // no match. Returns the synthetic id so the caller can attach showtimes.
  function addFallbackMovie(film) {
    const movie = buildFallbackMovie(film);
    if (movies.value.some((m) => m.id === movie.id)) return movie.id;
    movies.value = [...movies.value, movie];
    return movie.id;
  }

  function setShowtimes(tmdbId, showtimes) {
    const next = new Map(movieShowtimes.value);
    next.set(tmdbId, showtimes);
    movieShowtimes.value = next;
  }

  function removeMovie(tmdbId) {
    movies.value = movies.value.filter((m) => m.id !== tmdbId);
    if (movieShowtimes.value.has(tmdbId)) {
      const next = new Map(movieShowtimes.value);
      next.delete(tmdbId);
      movieShowtimes.value = next;
    }
  }

  function moveMovie(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const list = [...movies.value];
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    movies.value = list;
  }

  function reorderMovies(orderedIds) {
    const map = new Map(movies.value.map((m) => [m.id, m]));
    movies.value = orderedIds.map((id) => map.get(id)).filter(Boolean);
  }

  function clearMovies() {
    movies.value = [];
    movieShowtimes.value = new Map();
  }

  function clearAllShowtimes() {
    movieShowtimes.value = new Map();
  }

  function setCinemaTitle(tmdbId, cinemaTitle) {
    const next = new Map(cinemaTitleMap.value);
    next.set(tmdbId, cinemaTitle);
    cinemaTitleMap.value = next;
  }

  function clearShowtimesForCinema(cinemaId) {
    const next = new Map();
    for (const [movieId, showtimes] of movieShowtimes.value) {
      const filtered = showtimes.filter((st) => st.cinemaId !== cinemaId);
      if (filtered.length) {
        next.set(movieId, filtered);
      }
    }
    movieShowtimes.value = next;
  }

  async function loadSharedData(data) {
    const ids = data.f || [];

    // Restore fallback films from the embedded details first — addMovie() skips
    // them, since there is no TMDB record behind their synthetic ids.
    for (const entry of data.x || []) {
      if (movies.value.some((m) => m.id === entry.i)) continue;
      movies.value = [
        ...movies.value,
        {
          ...buildFallbackMovie({ title: entry.t, posterUrl: entry.p || null }),
          id: entry.i,
          year: entry.y || '',
          runtime: entry.r || null,
        },
      ];
    }

    // Await all adds: addMovie appends each film when its detail fetch
    // resolves, i.e. in network-completion order, not the encoded order.
    await Promise.all(ids.map((id) => addMovie(id)));

    // Restore the sender's sort state so the shared order is preserved,
    // rather than falling back to the viewer's local preference
    sortOrder.value = data.so || 'none';

    // Re-apply the sender's exact order. Without this the custom/none sorts
    // display films in fetch-completion order rather than the shared order.
    reorderMovies(ids);

    if (!data.s) return;

    // Restore date if present
    if (data.dt) {
      const { selectedDate } = useCinema();
      selectedDate.value = data.dt;
    }

    // Resolve cinema names from API if any showtimes reference cinema IDs
    let cinemaMap = new Map();
    const hasCinemaIds = Object.values(data.s)
      .flat()
      .some((st) => st.ci);
    if (hasCinemaIds) {
      try {
        const { cinemas } = await fetchCinemas();
        cinemaMap = new Map(cinemas.map((c) => [c.id, c]));
      } catch {
        /* continue without names */
      }
    }

    // Collect unique cinema IDs from showtimes and populate CinemaBar
    const seenCinemaIds = new Set();
    for (const showtimes of Object.values(data.s)) {
      for (const st of showtimes) {
        if (st.ci) seenCinemaIds.add(st.ci);
      }
    }
    if (seenCinemaIds.size > 0 && cinemaMap.size > 0) {
      const { setSelectedCinemas } = useCinema();
      const cinemaList = [...seenCinemaIds]
        .map((id) => cinemaMap.get(id))
        .filter(Boolean);
      if (cinemaList.length) {
        setSelectedCinemas(cinemaList);
      }
    }

    // Build initial showtimes without booking links
    for (const [movieId, showtimes] of Object.entries(data.s)) {
      setShowtimes(
        decodeMovieId(movieId),
        showtimes.map((st) => {
          const cinemaId = st.ci || null;
          const cinema = cinemaMap.get(cinemaId);
          return {
            cinemaId,
            cinema: cinema?.name || st.c || cinemaId || '',
            chain:
              cinema?.chain ||
              st.ch ||
              (cinemaId?.startsWith('vue-') ? 'vue' : 'cineworld'),
            time: st.t,
            bookingLink: null,
          };
        }),
      );
    }

    // Fetch films from cinema API to resolve booking links
    if (seenCinemaIds.size > 0 && data.dt) {
      try {
        const { films: apiFilms } = await fetchFilms([...seenCinemaIds], data.dt);
        // Build lookup: cinemaId::time → bookingLink
        const linkMap = new Map();
        for (const film of apiFilms) {
          for (const cs of film.cinemaShowtimes || []) {
            for (const st of cs.showtimes || []) {
              if (st.bookingLink) {
                linkMap.set(`${cs.cinemaId}::${st.time}`, st.bookingLink);
              }
            }
          }
        }
        // Patch booking links into existing showtimes
        for (const [movieId] of Object.entries(data.s)) {
          const id = decodeMovieId(movieId);
          const existing = movieShowtimes.value.get(id);
          if (!existing) continue;
          const patched = existing.map((st) => {
            const link = linkMap.get(`${st.cinemaId}::${st.time}`);
            return link ? { ...st, bookingLink: link } : st;
          });
          setShowtimes(id, patched);
        }
      } catch {
        /* continue without booking links */
      }
    }
  }

  async function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let loaded = false;

    // Current format: ?d=<base64>
    const dParam = params.get('d');
    if (dParam) {
      try {
        await loadSharedData(parseData(dParam));
        loaded = true;
        return loaded;
      } catch {
        /* invalid, fall through */
      }
    }

    // Legacy hash format: #<base64>
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        await loadSharedData(parseData(hash));
        loaded = true;
        return loaded;
      } catch {
        /* invalid, fall through */
      }
    }

    // Legacy format: ?films=550,278
    const filmsParam = params.get('films');
    if (!filmsParam) return loaded;
    const ids = filmsParam.split(',').map(Number).filter(Boolean);
    if (!ids.length) return loaded;
    for (const id of ids) {
      addMovie(id);
    }
    loaded = true;
    return loaded;
  }

  // Keep URL in sync
  watch(movies, updateUrl, { deep: true });
  watch(movieShowtimes, updateUrl, { deep: true });
  watch(sortOrder, (val) => localStorage.setItem('sortOrder', val));

  return {
    movies,
    sortedMovies,
    loadingIds,
    sortOrder,
    movieShowtimes,
    showtimesOnly,
    cinemaTitleMap,
    addMovie,
    addFallbackMovie,
    removeMovie,
    moveMovie,
    reorderMovies,
    clearMovies,
    loadFromUrl,
    setShowtimes,
    clearAllShowtimes,
    clearShowtimesForCinema,
    setCinemaTitle,
    getShareUrl,
    getShareMessage,
  };
}
