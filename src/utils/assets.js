const base = import.meta.env.BASE_URL

export function asset(path) {
  return `${base}${path}`
}

export function chainIcon(chain) {
  return chain === 'vue' ? asset('icons/vue.png') : asset('icons/cineworld.svg')
}
