import type { ReactNode } from 'react'
import { LOCALE_NAMES, LOCALES, parseLocale } from '../i18n/locale'
import type { MessageKey } from '../i18n/messages'
import { useT } from '../i18n/react'
import type { Highlight, Tool, WorkMode } from '../model/workMode'
import {
  AddObjectIcon,
  ClipboardIcon,
  ConnectIcon,
  CopyIcon,
  CursorIcon,
  CycleIcon,
  GraphIcon,
  GroupIcon,
  HelpIcon,
  PasteIcon,
  SearchIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  UngroupIcon,
  WandIcon,
} from './icons'
import { ProjectTitle } from './ProjectTitle'
import type { ToolbarProps } from './props'
import { Tooltip } from './Tooltip'
import './components.css'

const ICON_SIZE = 16

const MODES: readonly { value: WorkMode; labelKey: MessageKey; titleKey: MessageKey; icon: ReactNode }[] = [
  {
    value: 'build',
    labelKey: 'toolbar.mode.build',
    titleKey: 'toolbar.mode.build.title',
    icon: <GraphIcon size={ICON_SIZE} />,
  },
  {
    value: 'analyze',
    labelKey: 'toolbar.mode.analyze',
    titleKey: 'toolbar.mode.analyze.title',
    icon: <WandIcon size={ICON_SIZE} />,
  },
]

/** The visible text is short; `name` is the full accessible name (and keeps the button named when the text is hidden on narrow windows). */
const TOOLS: readonly {
  value: Tool
  labelKey: MessageKey
  nameKey: MessageKey
  titleKey: MessageKey
  icon: ReactNode
  shortcut: string
}[] = [
  {
    value: 'select',
    labelKey: 'toolbar.tool.select.label',
    nameKey: 'toolbar.tool.select.name',
    titleKey: 'toolbar.tool.select.title',
    icon: <CursorIcon size={ICON_SIZE} />,
    shortcut: 'V',
  },
  {
    value: 'create',
    labelKey: 'toolbar.tool.create.label',
    nameKey: 'toolbar.tool.create.name',
    titleKey: 'toolbar.tool.create.title',
    icon: <AddObjectIcon size={ICON_SIZE} />,
    shortcut: 'N',
  },
  {
    value: 'connect',
    labelKey: 'toolbar.tool.connect.label',
    nameKey: 'toolbar.tool.connect.name',
    titleKey: 'toolbar.tool.connect.title',
    icon: <ConnectIcon size={ICON_SIZE} />,
    shortcut: 'C',
  },
]

const HIGHLIGHTS: readonly { value: Highlight; labelKey: MessageKey }[] = [
  { value: 'critical', labelKey: 'toolbar.highlight.critical' },
  { value: 'outgoing', labelKey: 'toolbar.highlight.outgoing' },
  { value: 'incoming', labelKey: 'toolbar.highlight.incoming' },
  { value: 'both', labelKey: 'toolbar.highlight.both' },
  { value: 'off', labelKey: 'toolbar.highlight.off' },
]

function Separator() {
  return <span className="toolbar__separator" role="separator" aria-orientation="vertical" />
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="toolbar__section" role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function Toolbar({
  projectName,
  onRenameProject,
  mode,
  onModeChange,
  tool,
  onToolChange,
  canGroup,
  canUngroup,
  canDelete,
  canCopy,
  canPaste,
  canUndo,
  canRedo,
  highlight,
  onHighlightChange,
  selectionEmpty,
  cycleCount,
  onFocusCycle,
  panelVisible,
  onTogglePanel,
  onUndo,
  onRedo,
  onGroup,
  onUngroup,
  onDelete,
  onCopy,
  onPaste,
  searchOpen,
  onToggleSearch,
  onExport,
  onImport,
  onPasteJson,
  locale,
  onLocaleChange,
  onHelp,
}: ToolbarProps) {
  const t = useT()
  const dependencyHighlight = highlight === 'outgoing' || highlight === 'incoming' || highlight === 'both'
  const cycleWord = t.plural('toolbar.cycles.word', cycleCount)

  return (
    <header className="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
      <ProjectTitle name={projectName} onRename={onRenameProject} />

      <div className="mode-switch" role="group" aria-label={t('toolbar.mode.group')}>
        {MODES.map(({ value, labelKey, titleKey, icon }) => (
          <Tooltip key={value} text={t(titleKey)}>
            <button
              type="button"
              className="ui-button"
              aria-pressed={mode === value}
              onClick={() => onModeChange(value)}
            >
              {icon}
              {t(labelKey)}
            </button>
          </Tooltip>
        ))}
      </div>

      <Separator />

      {/* Main column: first row = tools / analysis, cycles, search; second row (build mode) = editing actions. */}
      <div className="toolbar__main">
        <div className="toolbar__row">
          {mode === 'build' ? (
            <Section label={t('toolbar.section.create')}>
              <div className="tool-switch" role="group" aria-label={t('toolbar.tool.group')}>
                {TOOLS.map(({ value, labelKey, nameKey, titleKey, icon, shortcut }) => (
                  <Tooltip key={value} text={t(titleKey)} shortcut={shortcut}>
                    <button
                      type="button"
                      className="ui-button"
                      aria-label={t(nameKey)}
                      aria-pressed={tool === value}
                      onClick={() => onToolChange(value)}
                    >
                      {icon}
                      <span className="tool-switch__label">{t(labelKey)}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </Section>
          ) : (
            <Section label={t('toolbar.section.analysis')}>
              <Tooltip text={t('toolbar.highlight.help')}>
                <label className="toolbar__field">
                  <span>{t('toolbar.highlight.label')}</span>
                  <select
                    className="ui-input toolbar__select"
                    value={highlight}
                    onChange={(event) => onHighlightChange(event.target.value as Highlight)}
                  >
                    {HIGHLIGHTS.map(({ value, labelKey }) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </Tooltip>
              {dependencyHighlight && selectionEmpty && (
                <span className="toolbar__hint" role="status">
                  {t('toolbar.highlight.pick')}
                </span>
              )}
              <Tooltip text={t('toolbar.panel.title')}>
                <button type="button" className="ui-button" aria-pressed={panelVisible} onClick={onTogglePanel}>
                  {t('toolbar.panel')}
                </button>
              </Tooltip>
            </Section>
          )}

          {cycleCount > 0 && (
            <>
              <Separator />
              <Section label={t('toolbar.section.cycles')}>
                <Tooltip text={t('toolbar.cycles.title')}>
                  <button
                    type="button"
                    className="ui-button ui-button--cycle"
                    aria-label={t.plural('cycle.count', cycleCount)}
                    onClick={onFocusCycle}
                  >
                    <CycleIcon />
                    <span>{cycleCount}</span>
                    <span className="cycle-button__word"> {cycleWord}</span>
                  </button>
                </Tooltip>
              </Section>
            </>
          )}

          <Separator />

          <Section label={t('toolbar.section.search')}>
            <Tooltip text={t('toolbar.search.title')}>
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label={t('toolbar.search')}
                aria-pressed={searchOpen}
                onClick={onToggleSearch}
              >
                <SearchIcon />
              </button>
            </Tooltip>
          </Section>
        </div>

        {mode === 'build' && (
          <div className="toolbar__edit">
            <Section label={t('toolbar.section.groups')}>
              <Tooltip text={t('toolbar.group.title')} hint={canGroup ? undefined : t('toolbar.group.hint')}>
                <button
                  type="button"
                  className="ui-button ui-button--tool"
                  aria-label={t('toolbar.group')}
                  disabled={!canGroup}
                  onClick={onGroup}
                >
                  <GroupIcon />
                </button>
              </Tooltip>
              <Tooltip text={t('toolbar.ungroup.title')} hint={canUngroup ? undefined : t('toolbar.ungroup.hint')}>
                <button
                  type="button"
                  className="ui-button ui-button--tool"
                  aria-label={t('toolbar.ungroup')}
                  disabled={!canUngroup}
                  onClick={onUngroup}
                >
                  <UngroupIcon />
                </button>
              </Tooltip>
            </Section>

            <Separator />

            {/* Delete sits right next to paste (no separator), apart from undo/redo. */}
            <div className="toolbar__cluster">
              <Section label={t('toolbar.section.clipboard')}>
                <Tooltip
                  text={t('toolbar.copy.title')}
                  shortcut={t('shortcut.copy')}
                  hint={canCopy ? undefined : t('toolbar.copy.hint')}
                >
                  <button
                    type="button"
                    className="ui-button ui-button--tool"
                    aria-label={t('toolbar.copy')}
                    disabled={!canCopy}
                    onClick={onCopy}
                  >
                    <CopyIcon />
                  </button>
                </Tooltip>
                <Tooltip
                  text={t('toolbar.paste.title')}
                  shortcut={t('shortcut.paste')}
                  hint={canPaste ? undefined : t('toolbar.paste.hint')}
                >
                  <button
                    type="button"
                    className="ui-button ui-button--tool"
                    aria-label={t('toolbar.paste')}
                    disabled={!canPaste}
                    onClick={onPaste}
                  >
                    <PasteIcon />
                  </button>
                </Tooltip>
              </Section>
              <Tooltip
                text={t('toolbar.delete.title')}
                shortcut={t('shortcut.delete')}
                hint={canDelete ? undefined : t('toolbar.delete.hint')}
              >
                <button
                  type="button"
                  className="ui-button ui-button--tool"
                  aria-label={t('toolbar.delete')}
                  disabled={!canDelete}
                  onClick={onDelete}
                >
                  <TrashIcon />
                </button>
              </Tooltip>
            </div>

            <Separator />

            <Section label={t('toolbar.section.history')}>
              <Tooltip
                text={t('toolbar.undo.title')}
                shortcut={t('shortcut.undo')}
                hint={canUndo ? undefined : t('toolbar.undo.hint')}
              >
                <button
                  type="button"
                  className="ui-button ui-button--tool"
                  aria-label={t('toolbar.undo')}
                  disabled={!canUndo}
                  onClick={onUndo}
                >
                  <UndoIcon />
                </button>
              </Tooltip>
              <Tooltip
                text={t('toolbar.redo.title')}
                shortcut={t('shortcut.redo')}
                hint={canRedo ? undefined : t('toolbar.redo.hint')}
              >
                <button
                  type="button"
                  className="ui-button ui-button--tool"
                  aria-label={t('toolbar.redo')}
                  disabled={!canRedo}
                  onClick={onRedo}
                >
                  <RedoIcon />
                </button>
              </Tooltip>
            </Section>
          </div>
        )}
      </div>

      {/* Sticky: stays reachable when a narrow window scrolls the toolbar sideways. */}
      <div className="toolbar__file">
        <Separator />
        <div className="toolbar__file-body">
          <Section label={t('toolbar.section.file')}>
            <Tooltip text={t('toolbar.export.title')}>
              <button type="button" className="ui-button" onClick={onExport}>
                {t('toolbar.export')}
              </button>
            </Tooltip>
            <Separator />
            <Tooltip text={t('toolbar.import.title')}>
              <button type="button" className="ui-button" onClick={onImport}>
                {t('toolbar.import')}
              </button>
            </Tooltip>
            <Tooltip text={t('toolbar.pasteJson.title')}>
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label={t('toolbar.pasteJson')}
                onClick={onPasteJson}
              >
                <ClipboardIcon />
              </button>
            </Tooltip>
          </Section>

          {/* Second row, right-aligned: language, then help at the far right. */}
          <div className="toolbar__file-extra">
            <Tooltip text={t('toolbar.language.title')}>
              <select
                className="ui-input toolbar__select toolbar__language"
                aria-label={t('language.label')}
                value={locale}
                onChange={(event) => onLocaleChange(parseLocale(event.target.value))}
              >
                {LOCALES.map((value) => (
                  <option key={value} value={value} lang={value}>
                    {LOCALE_NAMES[value]}
                  </option>
                ))}
              </select>
            </Tooltip>
            <Tooltip text={t('toolbar.help.title')}>
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label={t('toolbar.help')}
                onClick={onHelp}
              >
                <HelpIcon />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  )
}
