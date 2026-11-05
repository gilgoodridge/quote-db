import {useState} from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import QuotesList from './components/QuotesList'
import Placeholder from './components/Placeholder'
import './App.css'

function App() {
  const [selectedAuthorId, setSelectedAuthorId] = useState(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState({
    toneIds: [],
    themeIds: [],
    formIds: [],
    sourceIds: [],
  })
  const [quotesVersion, setQuotesVersion] = useState(0)
  const [authorsVersion, setAuthorsVersion] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  function handleSearch() {
    setSearchQuery(searchText.trim())
    setQuotesVersion((version) => version + 1)
  }

  function handleSearchTextChange(text) {
    setSearchText(text)
    if (!text.trim()) setSearchQuery('')
  }

  function handleQuoteCreated(quote) {
    setSelectedAuthorId(quote.author.id)
    setQuotesVersion((version) => version + 1)
  }

  return (
    <div className="app-container">
      <Header
        onAuthenticationChange={setIsAuthenticated}
        onQuoteCreated={handleQuoteCreated}
        onAuthorCreated={() => setAuthorsVersion((version) => version + 1)}
        selectedAuthorId={selectedAuthorId}
        searchText={searchText}
        onSearchTextChange={handleSearchTextChange}
        onSearch={handleSearch}
      />
      <div className="main-content">
        <aside className="sidebar-left">
          <Sidebar
            onAuthorSelect={setSelectedAuthorId}
            selectedAuthorId={selectedAuthorId}
            selectedCategoryIds={selectedCategoryIds}
            onCategoryIdsChange={setSelectedCategoryIds}
            refreshKey={authorsVersion}
          />
        </aside>
        <main className="content-middle">
          <QuotesList
            isAuthenticated={isAuthenticated}
            onAuthorCreated={() => setAuthorsVersion((version) => version + 1)}
            key={`${selectedAuthorId ?? 'all'}:${searchQuery}`}
            authorId={selectedAuthorId}
            query={searchQuery}
            categoryIds={selectedCategoryIds}
            refreshKey={quotesVersion}
          />
        </main>
        <aside className="sidebar-right">
          <Placeholder />
        </aside>
      </div>
    </div>
  )
}

export default App
