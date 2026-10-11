import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setTestLocale } from './locale'

afterEach(() => {
  cleanup()
  setTestLocale('de')
  document.documentElement.lang = ''
  document.title = ''
})
