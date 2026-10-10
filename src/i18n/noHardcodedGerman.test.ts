import { describe, expect, it } from 'vitest'

/**
 * Files that still contain hard-coded German UI text. Every migration task removes its files from this
 * list; the test fails for a file that is clean but still listed, so the list cannot go stale.
 */
const PENDING: readonly string[] = [
  'App.tsx',
  'components/AgentHelp.tsx',
  'components/AnalysisPanel.tsx',
  'components/Sidebar.tsx',
  'components/SidebarBulkColor.tsx',
  'components/SidebarEdgeForm.tsx',
  'flow/mapping.ts',
  'model/graph.ts',
  'model/releaseAnalysis.ts',
  'model/serialize.ts',
  'store/appStore.ts',
  'store/graphStore.ts',
]

const CATALOGS = new Set(['i18n/de.ts', 'i18n/en.ts', 'i18n/fr.ts'])
const GERMAN =
  /[äöüÄÖÜß]|\b(Auswählen|Verbinden|Verbindung|Zwischenablage|Schließen|Abbrechen|Hilfe|Datei|Fehler|Meldung|Wartet|wartet|Kopieren|Einfügen|Speichern|Löschen|Gruppe|Objekt|Abhängigkeit)\b/

// Vite reads the sources as text, so the app tsconfig needs no Node types.
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

function germanLines(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .filter((line) => !/^\s*(\/\*|\*)/.test(line))
    .filter((line) => GERMAN.test(line))
}

describe('no hard-coded German outside the catalog', () => {
  const files = Object.keys(SOURCES)
    .map((path) => path.replace('/src/', ''))
    .filter((file) => !CATALOGS.has(file))

  it.each(files.filter((file) => !PENDING.includes(file)))('%s is free of German UI text', (file) => {
    expect(germanLines(SOURCES[`/src/${file}`])).toEqual([])
  })

  it.each(PENDING)('%s is still pending (remove it from the list once migrated)', (file) => {
    expect(germanLines(SOURCES[`/src/${file}`]).length).toBeGreaterThan(0)
  })
})
