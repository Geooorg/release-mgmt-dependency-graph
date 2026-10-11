import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/translate'
import { flowAriaLabels } from './ariaLabels'

describe('flowAriaLabels', () => {
  it('translates the React Flow control labels', () => {
    expect(flowAriaLabels(createTranslate('de'))['controls.zoomIn.ariaLabel']).toBe('Vergrößern')
    expect(flowAriaLabels(createTranslate('en'))['controls.zoomIn.ariaLabel']).toBe('Zoom in')
    expect(flowAriaLabels(createTranslate('fr'))['controls.fitView.ariaLabel']).toBe('Ajuster la vue')
  })

  it('formats the keyboard move announcement with the rounded position', () => {
    const message = flowAriaLabels(createTranslate('en'))['node.a11yDescription.ariaLiveMessage']
    expect(message?.({ direction: 'up', x: 10.4, y: 20.6 })).toBe('Selected element moved. New position: x 10, y 21')
  })
})
