import { lazy, Suspense, useEffect, useState } from 'react'
import { AgentHelp } from './components/AgentHelp'
import { useDocumentLanguage } from './i18n/react'
import { isAgentHelpHash } from './route'

// Lazy so the help page never touches the store, which loads (and may initialise) the saved project on import.
const App = lazy(() => import('./App'))

export function Root() {
  useDocumentLanguage()
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (isAgentHelpHash(hash)) return <AgentHelp />
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  )
}
