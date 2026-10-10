import type { Catalog } from './messages'

export const en: Catalog = {
  'language.label': 'Language',
  'cycle.count_one': '{count} cycle',
  'cycle.count_other': '{count} cycles',
  'common.close': 'Close',
  'help.title': 'Help',
  'help.intro':
    'The editor draws the dependencies of a release as a graph. An arrow A → B means: A depends on B (B comes first). Everything is saved automatically in the browser; use export and import to exchange projects. A description for automation agents is available at #/agent-hilfe.',
  'help.start.title': 'Getting started',
  'help.start.body':
    '- Choose the “Object” tool (key N) and click an empty spot on the canvas to create an object.\n- Choose “Connect” (key C) and click two objects one after the other: the source first, then the target.\n- With “Select” (key V) you select and move elements. Esc ends the active tool.\n- The sidebar on the right shows the selection and lets you edit name, colour, status and further fields.',
  'help.objects.title': 'Objects and groups',
  'help.objects.body':
    '- “Group” combines selected objects on the same level into a group (sub-graph); “Ungroup” removes the group, its content is kept.\n- When you drop an object or group into a group, the group grows with it.\n- Double-click a name to rename the element directly (Enter confirms, Esc discards).\n- “Delete” (Del) removes selected objects and connections; groups are only dissolved.\n- Select several elements with Ctrl/Cmd + click or by dragging a frame with Shift held.',
  'help.connect.title': 'Connections',
  'help.connect.body':
    'An arrow A → B means “A depends on B”: B has to be finished first.\n- With the “Connect” tool, click the source first, then the target.\n- Alternatively, drag a connector on the edge of an object onto another element; releasing anywhere on the object is enough.\n- The ends of an existing connection can be dragged to other connectors or elements (not in analysis mode).\n- Not possible: connections to itself, duplicate connections, and connections between a group and its own content.\n- A connection from or to a group applies to all of its members (including nested ones).\n- You can select a connection and give it a caption in the sidebar.',
  'help.sidebar.title': 'Sidebar and metadata',
  'help.sidebar.body':
    '- The sidebar follows the selection and applies every valid change immediately; there is no separate save. Each field edit is one step for “Undo”.\n- Metadata is an ordered list of key and value; the first entry is the name. Field names must not occur twice.\n- The colour can be set per element; with several elements selected, the colour field sets it for all of them.\n- The ID of an element is created once and cannot be changed.',
  'help.status.title': 'Status',
  'help.status.body':
    'Every object has one of four statuses: open, in progress, blocked or done. Without a status, “open” applies.\n- You set “blocked” by hand (red flag), optionally with a reason.\n- The hourglass “waiting” is calculated: the object is not done and has a direct prerequisite that is not done yet.\n- Groups derive their status from their members.\n- “done” is final: nothing behind it is analysed any further.\n- An unknown value is kept, marked with “?” and counts as open.',
  'help.analysis.title': 'Analysis mode',
  'help.analysis.body':
    'The “Analyze” switch takes you from editing to evaluation. The structure is locked there; status and metadata stay editable.\n- The highlight draws thick red: the critical path, the prerequisites of the selection, what is affected by it, or both.\n- The panel shows status counts, “To clarify”, the critical path and the open prerequisites; the evaluation can be copied as Markdown.\n- The cycles button appears when dependencies run in a circle; a click selects the next cycle.',
  'help.search.title': 'Search',
  'help.search.body':
    'The magnifier in the toolbar opens the search field (in both modes).\n- The search matches the start of the name, case-insensitive, for objects and groups.\n- Enter jumps to the first hit, and each further Enter with unchanged text to the next one.\n- Esc closes the search field.',
  'help.clipboard.title': 'Copy, paste, undo',
  'help.clipboard.body':
    '- Ctrl/Cmd + C copies the selected objects and groups including the content of groups, but without connections. Ctrl/Cmd + V pastes them as new elements with new IDs.\n- Ctrl/Cmd + Z undoes the last change, Ctrl/Cmd + Shift + Z restores it.\n- The buttons for these actions are only available in edit mode; pasting is locked in analysis mode.',
  'help.file.title': 'Saving, export and import',
  'help.file.body':
    '- The project is saved automatically in the browser (this browser only).\n- “Export” downloads the project as a JSON file <project name>_<date>_<time>.json.\n- “Import” loads a JSON file and replaces the current project; you are asked first and warned about changes that were not exported.\n- “Show JSON” shows the export as text to copy, “Paste JSON” loads a project from pasted text.\n- The project name (top left, editable) may only contain A–Z, a–z, 0–9 and - _ .',
  'help.shortcuts.title': 'Keyboard shortcuts',
  'help.shortcuts.body':
    '- V: Select · N: Object · C: Connect (edit mode only)\n- Del: delete the selection\n- Esc: end the tool, then close the panel, then clear the selection\n- Ctrl/Cmd + C / V: copy / paste\n- Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z: undo / redo\n- Enter in the search field: next hit',
}
