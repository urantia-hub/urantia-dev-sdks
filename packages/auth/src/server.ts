// The server entry of @urantia/auth. It keeps no state and touches no browser API, so it works in any
// server runtime with fetch and Web Crypto: Node, Workers, Bun, Deno.
//
// A sign-in with a UrantiaHub account from a server:
//   1. createAuthorizeUrl  → keep `state` and `codeVerifier` in a short-lived HttpOnly cookie, send the reader to `url`
//   2. on return: compare `state`, then exchangeCode → keep the tokens in your own HttpOnly session cookie
//   3. refreshTokens before the access token ends
//   4. to sign out: revokeTokens, clear your cookie, send the reader to signOutUrl

import { createLocalJWKSet, decodeProtectedHeader, type JSONWebKeySet, jwtVerify } from "jose";
import { AuthError, type Claims } from "./flow.js";

export {
  AuthError,
  type AuthErrorKind,
  type Claims,
  createAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  revokeTokens,
  signOutUrl,
  type Tokens,
} from "./flow.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const ISSUER = "https://accounts.urantiahub.com";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const KEYS_FRESH_MS = 5 * 60 * 1000;

type VerifierApps =
  | { /** The app, or the apps, whose tokens this backend accepts. */ appId: string | string[]; anyApp?: never }
  | { /** Accept a token of each app. Only for a service that is meant for all of them. */ anyApp: true; appId?: never };

/**
 * Makes a function that checks an access token against the published keys, with no call to the API.
 * For a backend that receives tokens from an app. Make it one time and use it for each request.
 *
 * Name your app. One key signs the tokens of each app, so a backend that accepts any of them also
 * accepts the token that another app holds for the same reader.
 */
export function createTokenVerifier(options: VerifierApps & { jwksUrl?: string; fetch?: Fetch }): (token: string) => Promise<Claims> {
  const accepted = options.anyApp === true ? null : ([] as string[]).concat(options.appId ?? []).filter(Boolean);
  if (accepted !== null && accepted.length === 0) {
    throw new Error("createTokenVerifier needs `appId` (the app whose tokens you accept), or `anyApp: true`.");
  }
  const jwksUrl = options.jwksUrl ?? `${DEFAULT_LOGIN_URL}/.well-known/jwks.json`;
  let keys: JSONWebKeySet | null = null;
  let fetchedAt = 0;
  // A token with a made-up key id must not make this server fetch the key file at each request.
  let lastExtraFetch = 0;

  async function loadKeys(): Promise<JSONWebKeySet> {
    const doFetch: Fetch = options.fetch ?? fetch;
    try {
      const res = await doFetch(jwksUrl);
      const body = (await res.json()) as JSONWebKeySet;
      if (!res.ok || !Array.isArray(body?.keys)) throw new Error("not a key file");
      keys = body;
      fetchedAt = Date.now();
      return body;
    } catch {
      throw new AuthError("unavailable", "The key file of the sign-in service cannot be read.");
    }
  }

  return async function verify(token: string): Promise<Claims> {
    let kid: string | undefined;
    try {
      kid = decodeProtectedHeader(token).kid;
    } catch {
      throw new AuthError("refused", "This is not a token.");
    }
    let current = keys && Date.now() - fetchedAt < KEYS_FRESH_MS ? keys : await loadKeys();
    // A key change: the token names a key that this server did not fetch yet. Look one more time.
    if (kid && !current.keys.some((key) => key.kid === kid) && Date.now() - lastExtraFetch > 30_000) {
      lastExtraFetch = Date.now();
      current = await loadKeys();
    }

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, createLocalJWKSet(current), { issuer: ISSUER, audience: "authenticated", algorithms: ["ES256"] }));
    } catch {
      throw new AuthError("refused", "The token is not valid.");
    }
    if (payload.purpose !== undefined || typeof payload.sub !== "string" || typeof payload.app_id !== "string") {
      throw new AuthError("refused", "The token is not an access token.");
    }
    if (accepted !== null && !accepted.includes(payload.app_id)) throw new AuthError("refused", "The token is for another app.");
    return {
      userId: payload.sub,
      appId: payload.app_id,
      email: typeof payload.email === "string" ? payload.email : null,
      scopes: Array.isArray(payload.scopes) ? payload.scopes.filter((s): s is string => typeof s === "string") : [],
    };
  };
}
