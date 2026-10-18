import { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import QuotesList from './components/QuotesList'
import Placeholder from './components/Placeholder'
import './App.css'

function App() {
  const [selectedAuthorId, setSelectedAuthorId] = useState(null)
  const [quotesVersion, setQuotesVersion] = useState(0)
  const [authorsVersion, setAuthorsVersion] = useState(0)

  function handleQuoteCreated(quote) {
    setSelectedAuthorId(quote.author.id)
    setQuotesVersion((version) => version + 1)
  }

  return (
    <div className="app-container">
      <Header
        onQuoteCreated={handleQuoteCreated}
        onAuthorCreated={() => setAuthorsVersion((version) => version + 1)}
        selectedAuthorId={selectedAuthorId}
      />
      <div className="main-content">
        <aside className="sidebar-left">
          <Sidebar onAuthorSelect={setSelectedAuthorId} selectedAuthorId={selectedAuthorId} refreshKey={authorsVersion} />
        </aside>
        <main className="content-middle">
          <QuotesList authorId={selectedAuthorId} refreshKey={quotesVersion} />
        </main>
        <aside className="sidebar-right">
          <Placeholder />
        </aside>
      </div>
    </div>
  )
}

export default App
