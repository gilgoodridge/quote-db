import {referenceHref} from '../referenceLinks'

export default function ExternalLink({url, quoteText}) {
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return null
  } catch {
    return null
  }

  return (
    <a href={referenceHref(url, quoteText)} target="_blank" rel="noopener noreferrer" className="source-external-link"
      aria-label="Open source in a new tab" title="Open source in a new tab">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 3h7v7m0-7L10 14" />
        <path d="M10 3H3v18h18v-7" />
      </svg>
    </a>
  )
}
