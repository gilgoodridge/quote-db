import { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import QuotesList from './components/QuotesList'
import Placeholder from './components/Placeholder'
import './App.css'

function App() {
  const [selectedAuthorId, setSelectedAuthorId] = useState(null)

  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <aside className="sidebar-left">
          <Sidebar onAuthorSelect={setSelectedAuthorId} selectedAuthorId={selectedAuthorId} />
        </aside>
        <main className="content-middle">
          <QuotesList authorId={selectedAuthorId} />
        </main>
        <aside className="sidebar-right">
          <Placeholder />
        </aside>
      </div>
    </div>
  )
}

export default App
