import { useEffect } from 'react'
import { useT } from '../i18n/react'
import { GROUP_HEADER_HEIGHT, GROUP_PADDING, NODE_SIZE, SCHEMA_VERSION } from '../model/types'
import { STORAGE_KEY } from '../storage/localStorage'
import { UI_KEY } from '../storage/uiPreferences'
import { RichText } from './AgentHelpText'
import './AgentHelp.css'

/** Served from `public/`, so it follows the base path the app is hosted under. */
const SCHEMA_URL = `${import.meta.env.BASE_URL}graph.schema.json`

const { width: W, height: H } = NODE_SIZE
const GAP = GROUP_PADDING
const OFFSET = { x: GROUP_PADDING, y: GROUP_HEADER_HEIGHT + GROUP_PADDING }
const SINGLE_GROUP = { width: W + 2 * GROUP_PADDING, height: H + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT }

// Technical snippets are identical in every language, so they are passed in instead of being translated.
const NODE_SHAPE =
  '{ id, kind: "node", position:{x,y}, metadata:[{key:"name",value},{key:"class",value:"java.lang.Object"}?,{key:"entity",value:""}?], parentId? }'
const GROUP_SHAPE = '{ id, kind: "group", position:{x,y}, size:{width,height}, metadata:[...] }'
const NOTE_SHAPE = '{ id, kind: "note", position:{x,y}, size?:{width,height}, metadata:[{key:"name",value:text},{key:"color",value}?] }'
const EDGE_SHAPE = '{ id, source, target, metadata? }'
const AGENT_HELP_ROUTE = '#/agent-hilfe'
const PAIR = '{ source, target }'
const MODEL_SKELETON = `{ version: ${SCHEMA_VERSION}, projectName, nodes: [...], edges: [...] }`
const STORE_JSON = `localStorage.setItem('${STORAGE_KEY}', json); location.reload();`
const SET_LOCALE = `localStorage.setItem('${UI_KEY}', JSON.stringify({ ...JSON.parse(localStorage.getItem('${UI_KEY}') ?? '{}'), locale: 'en' })); location.reload();`

/** Static page for automation agents (no store access, so opening it never changes the saved project). */
export function AgentHelp() {
  const t = useT()
  // index.html carries a German title; without this the tab would keep it in the other languages.
  useEffect(() => {
    document.title = t('agent.title')
  }, [t])
  // The control names come from the interface catalog, so the help can never drift from the real labels.
  const names = {
    paste: t('toolbar.pasteJson'),
    exportTitle: t('export.title'),
    clipboard: t('export.clipboard'),
    exportSubmit: t('export.submit'),
    importTitle: t('jsonImport.title'),
    importLabel: t('jsonImport.label'),
    submit: t('jsonImport.submit'),
    undo: t('toolbar.undo'),
    create: t('toolbar.tool.create.name'),
    group: t('toolbar.group'),
    note: t('toolbar.tool.note.name'),
    import: t('toolbar.import'),
    export: t('toolbar.export'),
  }

  return (
    <main className="agent-help">
      <h1>{t('agent.title')}</h1>

      <h2>{t('agent.model.title')}</h2>
      <p>
        <RichText text={t('agent.model.storage', { key: STORAGE_KEY })} />
      </p>
      <pre>{MODEL_SKELETON}</pre>
      <ul>
        <li>
          <RichText text={t('agent.model.node', { shape: NODE_SHAPE })} />
        </li>
        <li>
          <RichText text={t('agent.model.group', { shape: GROUP_SHAPE })} />
        </li>
        <li>
          <RichText text={t('agent.model.note', { shape: NOTE_SHAPE, note: names.note })} />
        </li>
        <li>
          <RichText
            text={t('agent.model.edge', { shape: EDGE_SHAPE, example: `[{"key":"name","value":"${t('agent.edge.example')}"}]` })}
          />
        </li>
        <li>
          <RichText text={t('agent.model.children')} />
        </li>
        <li>{t('agent.model.order')}</li>
        <li>
          {t('agent.model.measures', {
            w: W,
            h: H,
            header: GROUP_HEADER_HEIGHT,
            padding: GROUP_PADDING,
            offsetX: OFFSET.x,
            offsetY: OFFSET.y,
            gap: GAP,
            groupW: SINGLE_GROUP.width,
            groupH: SINGLE_GROUP.height,
          })}
        </li>
        <li>{t('agent.model.empty')}</li>
        <li>{t('agent.model.regroup')}</li>
      </ul>

      <h2>{t('agent.schema.title')}</h2>
      <p>
        <RichText text={t('agent.schema.body')} href={SCHEMA_URL} />
      </p>

      <h2>{t('agent.bulk.title')}</h2>
      <ol>
        <li>
          <RichText text={t('agent.bulk.build')} />
        </li>
        <li>
          <RichText text={t('agent.bulk.store', { code: STORE_JSON })} />
        </li>
        <li>
          <RichText text={t('agent.bulk.check')} />
        </li>
      </ol>

      <h2>{t('agent.language.title')}</h2>
      <ul>
        <li>
          <RichText text={t('agent.language.default')} />
        </li>
        <li>
          <RichText text={t('agent.language.storage', { key: UI_KEY, code: SET_LOCALE })} />
        </li>
        <li>
          <RichText text={t('agent.language.select', { label: t('language.label'), key: UI_KEY })} />
        </li>
        <li>
          <RichText text={t('agent.language.help', { help: t('toolbar.help'), route: AGENT_HELP_ROUTE })} />
        </li>
      </ul>

      <h2>{t('agent.json.title')}</h2>
      <ul>
        <li>
          <RichText text={t('agent.json.read', { ...names, key: STORAGE_KEY })} />
        </li>
        <li>
          <RichText text={t('agent.json.write', names)} />
        </li>
        <li>
          <RichText text={t('agent.json.both')} />
        </li>
      </ul>

      <h2>{t('agent.ui.title')}</h2>
      <ul>
        <li>
          <RichText text={t('agent.ui.create', names)} />
        </li>
        <li>
          <RichText text={t('agent.ui.group', names)} />
        </li>
        <li>{t('agent.ui.multi')}</li>
        <li>{t('agent.ui.files', names)}</li>
      </ul>

      <h2>{t('agent.chrome.title')}</h2>
      <ul>
        <li>{t('agent.chrome.world')}</li>
        <li>
          <RichText text={t('agent.chrome.async')} />
        </li>
        <li>{t('agent.chrome.apple')}</li>
      </ul>

      <h2>{t('agent.direction.title')}</h2>
      <p>
        <RichText text={t('agent.direction.body', { pair: PAIR })} />
      </p>
    </main>
  )
}
