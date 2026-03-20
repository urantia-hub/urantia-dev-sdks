# Urantia Developer SDKs

TypeScript SDKs for building apps with the [Urantia Papers API](https://api.urantia.dev).

| Package | Description | Install |
|---------|-------------|---------|
| [`@urantia/api`](./packages/api) | Typed client for api.urantia.dev | `npm install @urantia/api` |
| [`@urantia/auth`](./packages/auth) | OAuth client for accounts.urantiahub.com | `npm install @urantia/auth` |

## Quick Start

### Read the Urantia Book programmatically

```typescript
import { UrantiaAPI } from '@urantia/api'

const api = new UrantiaAPI()

// Browse papers
const { data: papers } = await api.papers.list()

// Get a specific paragraph
const { data: paragraph } = await api.paragraphs.get('2:0.1')
console.log(paragraph.text)

// Search
const { data: results } = await api.search.fullText('divine love')

// Semantic search
const { data: results } = await api.search.semantic('the nature of God')
```

### Add user features (bookmarks, notes, reading progress)

```typescript
import { UrantiaAuth } from '@urantia/auth'
import { UrantiaAPI } from '@urantia/api'

// Sign in via accounts.urantiahub.com
const auth = new UrantiaAuth({
  appId: 'my-app',
  redirectUri: 'https://myapp.com/callback',
})
const session = await auth.signIn()

// Use the token for authenticated endpoints
const api = new UrantiaAPI({ token: session.accessToken })
await api.me.bookmarks.create({ ref: '2:0.1', category: 'Favorites' })
const { data: progress } = await api.me.readingProgress.get()
```

## Features

- **Zero dependencies** — uses native `fetch` and Web Crypto APIs
- **Full TypeScript types** — autocomplete for every endpoint and response
- **All API endpoints** — papers, paragraphs, search, entities, audio, citations, embeddings
- **OAuth with PKCE** — browser popup/redirect and server-side token exchange
- **Session management** — localStorage persistence, expiration checking, auth state events

## API Documentation

Full API docs: [urantia.dev](https://urantia.dev)

## Development

```bash
npm install
npm run build
```

## License

MIT
