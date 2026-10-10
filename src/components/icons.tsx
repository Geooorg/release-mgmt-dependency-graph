import type { ReactNode } from 'react'

interface IconProps {
  children: ReactNode
}

/** Shared frame for the toolbar icons: 24x24 grid, 2px round strokes, decorative only. */
function Icon({ children }: IconProps) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function UndoIcon() {
  return (
    <Icon>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  )
}

export function RedoIcon() {
  return (
    <Icon>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </Icon>
  )
}

/** Dashed frame around two boxes. */
export function GroupIcon() {
  return (
    <Icon>
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" strokeDasharray="3 3" />
      <rect x="6.5" y="6.5" width="5" height="5" rx="1" />
      <rect x="12.5" y="12.5" width="5" height="5" rx="1" />
    </Icon>
  )
}

/** The frame is gone, the boxes move apart. */
export function UngroupIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M14 10h-1.5M10 14v-1.5M16 8l3-3M5 19l3-3" />
    </Icon>
  )
}
