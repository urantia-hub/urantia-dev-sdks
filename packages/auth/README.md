# @urantia/auth

Authentication client for Urantia apps. Handles OAuth sign-in via [accounts.urantiahub.com](https://accounts.urantiahub.com).

Zero dependencies — uses native `fetch` and Web Crypto APIs.

## Installation

```bash
npm install @urantia/auth
```

## Quick Start (Browser)

```typescript
import { UrantiaAuth } from '@urantia/auth'

const auth = new UrantiaAuth({
  appId: 'my-app',
  redirectUri: 'https://myapp.com/callback',
})

// Sign in — opens popup to accounts.urantiahub.com
const session = await auth.signIn({ scopes: ['bookmarks', 'notes'] })
console.log(session.user, session.accessToken)

// Check current session
const current = auth.getSession()

// Listen for changes
const unsubscribe = auth.onAuthStateChange((session) => {
  if (session) {
    console.log('Signed in:', session.user)
  } else {
    console.log('Signed out')
  }
})

// Sign out
auth.signOut()
```

## Redirect Flow

For mobile or environments where popups are blocked:

```typescript
// Page 1: Start sign-in
const auth = new UrantiaAuth({
  appId: 'my-app',
  redirectUri: 'https://myapp.com/callback',
})
await auth.signIn({ mode: 'redirect', scopes: ['bookmarks'] })
// → redirects to accounts.urantiahub.com

// Page 2: Handle callback (on your redirect URI page)
const auth = new UrantiaAuth({
  appId: 'my-app',
  redirectUri: 'https://myapp.com/callback',
})
const session = await auth.handleCallback()
```

## Server-Side Token Exchange

For server environments where you already have an authorization code:

```typescript
import { UrantiaAuth } from '@urantia/auth'

const auth = new UrantiaAuth({
  appId: 'my-app',
  appSecret: process.env.URANTIA_APP_SECRET,
})

const session = await auth.signIn({ code: authorizationCode })
```

## Using with @urantia/api

```typescript
import { UrantiaAuth } from '@urantia/auth'
import { UrantiaAPI } from '@urantia/api'

const auth = new UrantiaAuth({ appId: 'my-app', redirectUri: '...' })
const session = await auth.signIn()

const api = new UrantiaAPI({ token: session.accessToken })
const bookmarks = await api.me.bookmarks.list()
```

## API

### `new UrantiaAuth(options)`

| Option | Type | Required | Default |
|--------|------|----------|---------|
| `appId` | `string` | Yes | — |
| `appSecret` | `string` | No | — |
| `redirectUri` | `string` | Browser | — |
| `loginUrl` | `string` | No | `https://accounts.urantiahub.com` |
| `apiUrl` | `string` | No | `https://api.urantia.dev` |

### Methods

| Method | Description |
|--------|-------------|
| `signIn(options?)` | Start OAuth flow (popup/redirect/server) |
| `handleCallback(url?)` | Complete redirect flow on callback page |
| `signOut()` | Clear session |
| `getSession()` | Get current session or null |
| `getToken()` | Get current access token or null |
| `onAuthStateChange(cb)` | Subscribe to auth changes (returns unsubscribe fn) |

## Security

- Uses **PKCE** (Proof Key for Code Exchange) for all browser flows
- Stores sessions in `localStorage` with expiration checking
- CSRF protection via `state` parameter
- Never stores app secrets in the browser

## License

MIT
