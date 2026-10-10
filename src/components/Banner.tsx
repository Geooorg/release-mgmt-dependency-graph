import type { BannerProps } from './props'
import './components.css'

export function Banner({ message, kind, details, onDismiss }: BannerProps) {
  if (message === null) return null

  return (
    <div className={`banner banner--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="banner__body">
        <p className="banner__message">{message}</p>
        {details && details.length > 0 && (
          <ul className="banner__details">
            {details.map((detail, index) => (
              <li key={`${index}:${detail}`}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="ui-button ui-button--icon"
        aria-label="Meldung schließen"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
