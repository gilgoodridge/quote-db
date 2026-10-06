import '../styles/QuotesList.css'

export default function QuotesList({ authorId }) {
  return (
    <div className="quotes-container">
      {!authorId ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <h2>No Author Selected</h2>
          <p>Select an author from the left panel to view their quotes</p>
        </div>
      ) : (
        <div className="quotes-content">
          <p className="placeholder-text">
            Quotes for author {authorId} would appear here
          </p>
          <p className="placeholder-subtext">
            (Backend integration coming soon)
          </p>
        </div>
      )}
    </div>
  )
}
