import type { IconKey } from '../model/types'

const PATHS: Record<IconKey, string> = {
  service: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
  database:
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  queue: 'M3 7h4v10H3zM10 7h4v10h-4zM17 7h4v10h-4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  cloud: 'M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 18z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  process: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  storage: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
}

/** Small outline icon of a type; decorative (the type name is shown as text next to it). */
export function TypeIcon({ icon }: { icon: IconKey }) {
  return (
    <svg
      className="type-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[icon]} />
    </svg>
  )
}
