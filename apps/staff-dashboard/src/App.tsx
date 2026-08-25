import { useEffect, useState } from 'react'
import { client } from './api/client'
import type { components } from './api/types'

type Book = components["schemas"]["Book"]

function App() {
  const [books, setBooks] = useState<Book[]>([])

  useEffect(() => {
    client.GET("/api/books", {}).then((res) => {
      if (res.data) setBooks(res.data)
    })
  }, [])

  return (
    <div>
      <h1>Riverside Books - Staff Dashboard</h1>
      <ul>
        {books.map(b => (
          <li key={b.isbn}>{b.title} by {b.author} - ${(b.price_cents / 100).toFixed(2)}</li>
        ))}
      </ul>
    </div>
  )
}

export default App
