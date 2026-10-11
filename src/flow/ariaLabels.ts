import type { AriaLabelConfig } from '@xyflow/react'
import type { Translate } from '../i18n/translate'

/** React Flow ships English texts for its controls, minimap and keyboard hints; this swaps in the active language. */
export const flowAriaLabels = (t: Translate): Partial<AriaLabelConfig> => ({
  'controls.ariaLabel': t('flow.controls'),
  'controls.zoomIn.ariaLabel': t('flow.zoomIn'),
  'controls.zoomOut.ariaLabel': t('flow.zoomOut'),
  'controls.fitView.ariaLabel': t('flow.fitView'),
  'minimap.ariaLabel': t('flow.minimap'),
  'handle.ariaLabel': t('flow.handle'),
  'node.a11yDescription.default': t('flow.node.description'),
  'node.a11yDescription.keyboardDisabled': t('flow.node.description'),
  'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('flow.node.moved', { x: Math.round(x), y: Math.round(y) }),
  'edge.a11yDescription.default': t('flow.edge.description'),
})
