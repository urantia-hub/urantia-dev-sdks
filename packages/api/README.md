# @urantia/api

Typed TypeScript client for the [Urantia Papers API](https://api.urantia.dev).

Zero dependencies — uses the native `fetch` API.

## Installation

```bash
npm install @urantia/api
```

## Quick Start

```typescript
import { UrantiaAPI } from '@urantia/api'

const api = new UrantiaAPI()

// List all papers
const { data: papers } = await api.papers.list()

// Get a specific paragraph
const { data: paragraph } = await api.paragraphs.get('2:0.1')

// Search
const { data: results } = await api.search.fullText('divine love')

// Semantic search
const { data: results } = await api.search.semantic('the nature of God')
```

## Authenticated Endpoints

Pass a token to access user-specific endpoints:

```typescript
const api = new UrantiaAPI({ token: accessToken })

// Get user profile
const { data: user } = await api.me.get()

// Bookmarks
await api.me.bookmarks.create({ ref: '2:0.1', category: 'Favorites' })
const { data: bookmarks } = await api.me.bookmarks.list()

// Notes
await api.me.notes.create({ ref: '2:0.1', text: 'Insightful passage' })

// Reading progress
await api.me.readingProgress.mark(['2:0.1', '2:0.2', '2:0.3'])
const { data: progress } = await api.me.readingProgress.get()

// Preferences
await api.me.preferences.update({ theme: 'dark', fontSize: 16 })
```

## All Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `api.toc.get()` | GET | Full table of contents |
| `api.papers.list()` | GET | All 197 papers |
| `api.papers.get(id)` | GET | Paper with paragraphs |
| `api.paragraphs.get(ref)` | GET | Paragraph by reference |
| `api.paragraphs.random()` | GET | Random paragraph |
| `api.paragraphs.context(ref)` | GET | Paragraph with surrounding context |
| `api.search.fullText(params)` | POST | Full-text search |
| `api.search.semantic(params)` | POST | Semantic vector search |
| `api.entities.list(options)` | GET | List entities |
| `api.entities.get(id)` | GET | Entity details |
| `api.entities.paragraphs(id)` | GET | Paragraphs mentioning entity |
| `api.audio.get(ref)` | GET | Audio URLs for paragraph |
| `api.cite.get(ref, style)` | GET | Generate citation |
| `api.embeddings.get(refs)` | POST | Get vector embeddings |
| `api.me.get()` | GET | User profile (auth) |
| `api.me.update(data)` | PUT | Update profile (auth) |
| `api.me.bookmarks.*` | — | Bookmark CRUD (auth) |
| `api.me.notes.*` | — | Note CRUD (auth) |
| `api.me.readingProgress.*` | — | Reading progress (auth) |
| `api.me.preferences.*` | — | User preferences (auth) |

## Paragraph References

The API accepts three reference formats interchangeably:

- **Standard:** `2:0.1` (paper:section.paragraph)
- **Global:** `1:2.0.1` (part:paper.section.paragraph)
- **Short:** `2.0.1` (paper.section.paragraph)

## Options

```typescript
const api = new UrantiaAPI({
  baseUrl: 'https://api.urantia.dev', // default
  token: 'your-access-token',         // for authenticated endpoints
})
```

## License

MIT
