# @urantia/auth

Sign-in with a UrantiaHub account, for a browser app or a server.

- `@urantia/auth/server`: for a server that keeps the session in a cookie. No browser API. Recommended.
- `@urantia/auth`: for an app that runs only in the browser. It keeps the tokens in `localStorage`.

Before you start, register your app at [accounts.urantiahub.com/apps](https://accounts.urantiahub.com/apps). An admin reviews each app. It works for you at once, and for other people after it is approved.

```bash
npm install @urantia/auth
```

## Server

Four steps. The example is a Next.js route handler, and the same calls work in any runtime with `fetch` and Web Crypto.

```ts
import { createAuthorizeUrl, exchangeCode, refreshTokens, revokeTokens, signOutUrl, AuthError } from '@urantia/auth/server'

const appId = 'my-app'
const redirectUri = 'https://myapp.com/auth/callback'

// 1. Start. Keep the state and the verifier in a short-lived cookie that scripts cannot read.
export async function start() {
  const { url, state, codeVerifier } = await createAuthorizeUrl({ appId, redirectUri, scopes: ['profile', 'bookmarks'] })
  const res = Response.redirect(url)
  res.headers.append('Set-Cookie', `auth_start=${state}.${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=600`)
  return res
}

// 2. Return. Compare the state yourself, then exchange the code.
export async function callback(request: Request, startCookie: string) {
  const url = new URL(request.url)
  const [state, codeVerifier] = startCookie.split('.')
  if (!state || url.searchParams.get('state') !== state) return new Response('Bad state', { status: 400 })

  const tokens = await exchangeCode({ appId, code: url.searchParams.get('code') ?? '', codeVerifier, redirectUri })
  // Keep tokens.accessToken, tokens.refreshToken, and tokens.expiresAt in your own HttpOnly session cookie.
}

// 3. Refresh before the access token ends. Read tokens.expiresAt: the life is short and can change.
try {
  const tokens = await refreshTokens({ appId, refreshToken })
} catch (error) {
  if (error instanceof AuthError && error.kind === 'refused') {
    // The sign-in ended. Clear your session.
  }
  // 'unavailable' and 'network': the service has a problem. Keep the session and try again later.
}

// 4. Sign out. Clear your own session in each case. The person does not leave your app.
await revokeTokens({ appId, refreshToken })
// Remember that this browser signed out (a short cookie), and at the next sign-in:
const next = await createAuthorizeUrl({ appId, redirectUri, scopes, askAccount: true })

// 4b. Or the full sign-out, for a shared computer: the accounts site ends its session too.
const { signOutToken } = await revokeTokens({ appId, refreshToken })
return Response.redirect(signOutUrl({ appId, returnTo: 'https://myapp.com/', signOutToken }))
```

Notes:

- A refresh token works one time. Each refresh gives a new one, so save it each time. If two requests can refresh at the same moment, make them share one refresh.
- `revokeTokens` never throws, so a sign-out goes on when the service is down. `revoked: false` means that the service did not confirm it.
- A sign-out needs no redirect. After it the person is still signed in on the accounts site, so pass `askAccount: true` to the next `createAuthorizeUrl`. The accounts site then asks "Continue as …?" with "Use another account", and does not sign the person in by itself.
- `signOutUrl` is the full sign-out: it sends the person to the accounts site, which ends the UrantiaHub account session too and returns to `returnTo`. `returnTo` must be an address that your app registered. Use it where other people use the same computer.

### Check a token in your own backend

If your backend receives access tokens from your app, check them against the published keys. No call to the API is made for each request.

```ts
import { createTokenVerifier } from '@urantia/auth/server'

// Make it one time. Name your app: one key signs the tokens of each app.
const verify = createTokenVerifier({ appId: 'my-app' })

const { userId, scopes } = await verify(accessToken) // throws an AuthError for a token that is not valid
```

## Browser

```ts
import { UrantiaAuth } from '@urantia/auth'

const auth = new UrantiaAuth({ appId: 'my-app', redirectUri: 'https://myapp.com/callback' })

// A popup by default. With mode: 'redirect', call auth.handleCallback() on the return page.
const session = await auth.signIn({ scopes: ['bookmarks', 'notes'] })

auth.onAuthStateChange((session) => {
  // Fires for a sign-in, a refresh, and a sign-out.
})

const token = auth.getToken() // null while a refresh is under way: listen for the change

await auth.signOut()                                      // no redirect; the next signIn() asks "Continue as …?"
await auth.signOut({ returnTo: 'https://myapp.com/' })     // the full sign-out: also the UrantiaHub account session
```

The session stays in `localStorage` after the access token ends, and the first use refreshes it. An outage does not sign the person out: only a refusal from the service does.

## Use the token

```ts
const res = await fetch('https://api.urantia.dev/me/bookmarks', {
  headers: { Authorization: `Bearer ${accessToken}` },
})
```

A token reaches only what its scopes allow: `profile`, `bookmarks`, `notes`, `reading-progress`, `preferences`.

## Changes in 0.4.0

- A sign-out needs no redirect. `signOut()` in the browser stays on your page, and the next `signIn()` asks the person which account to use ("Continue as …?").
- New option `askAccount` for `createAuthorizeUrl` on the server, for the same question.
- `signOut({ returnTo })` and `signOutUrl` are the full sign-out, for a shared computer. The sign-in after it asks too, in case the accounts session did not end.

## Changes in 0.3.0

- New: `@urantia/auth/server`.
- Access tokens become short-lived (15 minutes) once apps use this version. The browser client refreshes by itself. If you store a session yourself, read `expiresAt` and refresh before it.
- `signOut()` now returns a promise and tells the service. `signOut({ returnTo })` also ends the UrantiaHub account session.
- The return from the sign-in page must carry the `state` that was sent. A return with no `state` is refused.
- A failed refresh signs the person out only when the service refuses the token.

## License

MIT
