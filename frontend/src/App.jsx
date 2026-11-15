import {useState} from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import QuotesList from './components/QuotesList'
import Placeholder from './components/Placeholder'
import CandidateReview from './components/CandidateReview'
import './App.css'

function App() {
  const [selectedAuthorId, setSelectedAuthorId] = useState(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState(null)
  const [charactersVersion, setCharactersVersion] = useState(0)
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
  const [deletedCandidateQuoteId, setDeletedCandidateQuoteId] = useState(null)

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
    setSelectedCharacterId(quote.character?.id ?? null)
    setQuotesVersion((version) => version + 1)
  }

  function handleCharacterChanged() {
    setCharactersVersion((version) => version + 1)
    setQuotesVersion((version) => version + 1)
  }

  function handleAuthorChanged() {
    setAuthorsVersion((version) => version + 1)
    setQuotesVersion((version) => version + 1)
  }

  return (
    <div className="app-container">
      <Header
        onAuthenticationChange={setIsAuthenticated}
        onQuoteCreated={handleQuoteCreated}
        onAuthorCreated={() => setAuthorsVersion((version) => version + 1)}
        selectedAuthorId={selectedAuthorId}
        selectedCharacterId={selectedCharacterId}
        onCharacterCreated={handleCharacterChanged}
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
            selectedCharacterId={selectedCharacterId}
            onCharacterSelect={setSelectedCharacterId}
            charactersRefreshKey={charactersVersion}
            isAuthenticated={isAuthenticated}
            onAuthorChanged={handleAuthorChanged}
            onCharacterChanged={handleCharacterChanged}
          />
        </aside>
        <main className="content-middle">
          <QuotesList
            onCandidatesChanged={setDeletedCandidateQuoteId}
            isAuthenticated={isAuthenticated}
            onAuthorUpdated={handleAuthorChanged}
            onAuthorCreated={() => setAuthorsVersion((version) => version + 1)}
            authorId={selectedAuthorId}
            characterId={selectedCharacterId}
            charactersRefreshKey={charactersVersion}
            onCharacterChanged={handleCharacterChanged}
            query={searchQuery}
            categoryIds={selectedCategoryIds}
            refreshKey={quotesVersion}
          />
        </main>
        <aside className="sidebar-right">
          {isAuthenticated
            ? <CandidateReview
                deletedQuoteId={deletedCandidateQuoteId}
                onAuthorCreated={handleAuthorChanged}
                onQuoteCreated={() => setQuotesVersion((version) => version + 1)}
                onCharacterCreated={handleCharacterChanged}
              />
            : <Placeholder />}
        </aside>
      </div>
    </div>
  )
}

export default App
