<img width="1198" height="628" alt="Screenshot 2026-03-08 at 00 39 21" src="https://github.com/user-attachments/assets/4c44ce63-8547-4346-bb0a-a5b7947eb76f" />

# CinemaSync

A film comparison tool built with Vue 3. Search for movies, browse cinema showtimes, and compare ratings, cast, trailers, and more side-by-side.

**[Live Demo](https://tdrayson.github.io/cinema-sync/)**

## Features

- **Search & Compare** — Search films with autocomplete and compare them side-by-side in a horizontally scrollable, drag-to-scroll grid
- **Cinema Showtimes** — Browse films showing at local cinemas (Vue, Cineworld) and add them with showtime data
- **Aggregated Ratings** — Scores from IMDB, Rotten Tomatoes, and Metacritic with visual rating indicators and an overall score
- **Trailers** — Watch YouTube trailers directly in the app
- **Shareable Links** — Share URLs encode both films and showtimes, with backwards compatibility for legacy links
- **Sort** — Order films by score or the order they were added
- **Responsive** — Mobile-friendly with a slide-out menu and full-screen cinema browser on small screens

## Tech Stack

- [Vue 3](https://vuejs.org/) (Composition API with `<script setup>`)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Plyr](https://plyr.io/) (trailer playback)
- [Cloudflare Workers](https://workers.cloudflare.com/) (cinema API proxy)

## Getting Started

### Prerequisites

You'll need API keys from:

- [TMDB](https://www.themoviedb.org/settings/api) — movie data, images, trailers
- [OMDB](http://www.omdbapi.com/apikey.aspx) — IMDB, Rotten Tomatoes, and Metacritic ratings

### Installation

```bash
git clone https://github.com/tdrayson/cinema-sync.git
cd cinema-sync
npm install
```

Create a `.env` file from the example and add your keys:

```bash
cp .env.example .env
```

```
VITE_TMDB_API_KEY=your_tmdb_key
VITE_OMDB_API_KEY=your_omdb_key
VITE_CINEMA_PROXY_URL=your_worker_url
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The output is in the `docs/` folder.

### Preview Build Locally

```bash
npm run preview
```

## Deployment

The site is deployed to GitHub Pages from the `docs/` folder. After building, commit the `docs/` folder and push:

```bash
npm run build
git add docs
git commit -m "Build for deployment"
git push
```

Then in your GitHub repo settings, set Pages to deploy from the `docs/` folder on your main branch.

## Project Structure

```
src/
├── components/
│   ├── ComparisonGrid.vue    # Scrollable film grid with drag-to-scroll
│   ├── MovieCard.vue         # Individual film card
│   ├── RatingDisplay.vue     # Ratings section
│   ├── RatingBar.vue         # Single rating row with box indicators
│   ├── SearchBar.vue         # Search input, sort, and mobile menu
│   ├── SearchResultItem.vue  # Search dropdown item
│   ├── ShareButton.vue       # Share modal with copy options
│   ├── CinemaModal.vue       # Cinema browser and film picker
│   ├── CinemaBar.vue         # Active cinema selection bar
│   ├── DatePicker.vue        # Date selector for showtimes
│   └── TrailerModal.vue      # Trailer video player
├── composables/
│   ├── useComparison.js      # Film list state, sorting, sharing, URL encoding
│   ├── useCinema.js          # Cinema selection and showtime state
│   ├── useMovieSearch.js     # Search and popular films
│   └── useMovieDetails.js    # Fetch film details from APIs
├── utils/
│   ├── api.js                # TMDB and OMDB API wrappers
│   ├── cinema-api.js         # Cinema API with in-memory caching
│   └── ratings.js            # Rating normalisation
├── App.vue
├── main.js
└── style.css
worker/                       # Cloudflare Worker for cinema API proxy
```
