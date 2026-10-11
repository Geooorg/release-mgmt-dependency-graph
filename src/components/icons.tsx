import type { ReactNode } from 'react'

interface IconProps {
  children: ReactNode
  /** Edge length in px; the toolbar uses 20. */
  size?: number
}

/** Shared frame for the toolbar icons: 24x24 grid, 2px round strokes, decorative only. */
function Icon({ children, size = 20 }: IconProps) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
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

export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  )
}

export function CycleIcon() {
  return (
    <Icon>
      <path d="M20 12a8 8 0 0 1-13.7 5.6" />
      <path d="M4 12a8 8 0 0 1 13.7-5.6" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </Icon>
  )
}

/** Mouse pointer arrow (select tool). */
export function CursorIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 3l14 7.5-6.5 2-2 6.5z" />
    </Icon>
  )
}

/** Box with a plus (create-object tool). */
export function AddObjectIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  )
}

/** Sticky note with a folded corner (note tool). */
export function NoteIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 3h14a2 2 0 0 1 2 2v9l-7 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M21 14h-5a2 2 0 0 0-2 2v5" />
    </Icon>
  )
}

/** Two connectors joined by a line (connect tool). */
export function ConnectIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
      <path d="M7.5 12h9" />
    </Icon>
  )
}

/** Three small circles joined by lines (build mode). */
export function GraphIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="5.5" r="2.5" />
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M10.7 7.7 6.8 15.8M13.3 7.7l3.9 8.1M8 18h8" />
    </Icon>
  )
}

/** Magic wand with sparkles (analysis mode, "AI"). */
export function WandIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m4 20 10-10" />
      <path d="M17 3l1.1 2.9L21 7l-2.9 1.1L17 11l-1.1-2.9L13 7l2.9-1.1z" />
      <path d="M7 4v3M5.5 5.5h3" />
      <path d="M19 15v3M17.5 16.5h3" />
    </Icon>
  )
}

/** Pennant on a pole (blocked). Colour comes from `currentColor`. */
export function FlagIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 22V3" />
      <path d="M5 4h13l-3.5 4.5L18 13H5z" fill="currentColor" />
    </Icon>
  )
}

/** Hourglass (colour via `currentColor`): waits for an unfinished prerequisite. */
export function HourglassIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3v3a5 5 0 0 0 2 4l2.5 2-2.5 2a5 5 0 0 0-2 4v3" />
      <path d="M16.5 3v3a5 5 0 0 1-2 4L12 12l2.5 2a5 5 0 0 1 2 4v3" />
      <path d="M9.5 19h5L12 16z" fill="currentColor" />
    </Icon>
  )
}

/** Empty ring: status offen. */
export function OpenCircleIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="8" strokeWidth="3.5" />
    </Icon>
  )
}

/** Question mark: unknown status value. */
export function QuestionIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8.5 9a3.5 3.5 0 1 1 5.2 3c-1.1.7-1.7 1.3-1.7 2.5" strokeWidth="3.5" />
      <path d="M12 19.5h.01" strokeWidth="4" />
    </Icon>
  )
}

/** Clipboard with a tick: the release analysis. */
export function AnalysisIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="m9 13 2 2 4-4" />
    </Icon>
  )
}

export function CheckIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="3.5" />
    </Icon>
  )
}

/** Clipboard: paste JSON text. */
export function ClipboardIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </Icon>
  )
}

/** Two overlapping sheets: copy the selection. */
export function CopyIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Icon>
  )
}

/** Board with an arrow into it: paste the copied elements. */
export function PasteIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 10v7m-3-3 3 3 3-3" />
    </Icon>
  )
}

/** Magnifier: search an object or group by name. */
export function SearchIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  )
}

/** Circle with a question mark: open the help. */
export function HelpIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.9" />
      <path d="M12 17.4h.01" />
    </Icon>
  )
}
