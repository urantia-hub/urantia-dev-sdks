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
| `refreshSession()` | Refresh the access token using the stored refresh token |
| `signOut()` | Clear session |
| `getSession()` | Get current session or null (auto-refreshes if near expiry) |
| `getToken()` | Get current access token or null |
| `onAuthStateChange(cb)` | Subscribe to auth changes (returns unsubscribe fn) |

### Token Refresh

Sessions include a refresh token (30-day expiry). `getSession()` automatically triggers a background refresh when the access token is within 5 minutes of expiry. You can also refresh manually:

```typescript
const newSession = await auth.refreshSession()
```

Refresh tokens are **one-time-use** with rotation — each refresh returns a new refresh token. If a refresh token is reused (indicating potential theft), all sessions for that user+app are revoked.

## React Native / Expo

The browser-based SDK uses `localStorage` and `window.open()` which aren't available in React Native. For Expo apps, implement the PKCE flow with native equivalents:

```typescript
import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

// 1. Generate PKCE challenge
const codeVerifier = Crypto.getRandomBytes(32)
  .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
const digest = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  codeVerifier
)
const codeChallenge = btoa(digest)
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// 2. Open auth session
const state = Crypto.randomUUID()
const result = await WebBrowser.openAuthSessionAsync(
  `https://accounts.urantiahub.com/login?app_id=YOUR_APP_ID&redirect_uri=yourapp://auth/callback&state=${state}&code_challenge=${codeChallenge}`,
  'yourapp://auth/callback'
)

// 3. Exchange code for tokens
if (result.type === 'success') {
  const url = new URL(result.url)
  const code = url.searchParams.get('code')

  const res = await fetch('https://api.urantia.dev/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, appId: 'YOUR_APP_ID', codeVerifier }),
  })
  const { data } = await res.json()
  // data.accessToken, data.refreshToken, data.expiresAt

  // 4. Store securely
  await SecureStore.setItemAsync('session', JSON.stringify(data))
}
```

**Register your app** with a custom URL scheme redirect URI (e.g. `yourapp://auth/callback`) at [accounts.urantiahub.com/apps](https://accounts.urantiahub.com/apps).

## Security

- Uses **PKCE** (Proof Key for Code Exchange) for all browser flows
- Stores sessions in `localStorage` (browser) or `expo-secure-store` (React Native) with expiration checking
- CSRF protection via `state` parameter
- **Refresh token rotation** with theft detection
- Never stores app secrets in the browser

## License

MIT
