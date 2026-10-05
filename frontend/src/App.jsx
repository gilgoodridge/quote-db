import { AuthorList } from './AuthorList'
import './App.css'

function App() {
  return (
    <div className="app">
      <header>
        <h1>Quote Database</h1>
      </header>
      <main>
        <AuthorList />
      </main>
    </div>
  )
}

export default App
