// The server entry of @urantia/auth. It keeps no state and touches no browser API, so it works in any
// server runtime with fetch and Web Crypto: Node, Workers, Bun, Deno.
//
// A sign-in with a UrantiaHub account from a server:
//   1. createAuthorizeUrl  → keep `state` and `codeVerifier` in a short-lived HttpOnly cookie, send the reader to `url`
//   2. on return: compare `state`, then exchangeCode → keep the tokens in your own HttpOnly session cookie
//   3. refreshTokens before the access token ends
//   4. to sign out: revokeTokens, clear your cookie, send the reader to signOutUrl

import { createLocalJWKSet, decodeProtectedHeader, type JSONWebKeySet, jwtVerify } from "jose";
import { generatePKCE, randomToken } from "./pkce.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const DEFAULT_API_URL = "https://api.urantia.dev";
const ISSUER = "https://accounts.urantiahub.com";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
  scopes: string[];
  /** When the access token ends. ISO date. */
  expiresAt: string;
};

export type Claims = { userId: string; appId: string; email: string | null; scopes: string[] };

/**
 * refused: the service said no. For a refresh, sign the reader out.
 * unavailable: the service gave an answer that is not usable (5xx, or not the expected form). Try again later.
 * network: the request itself failed. Try again later.
 */
export type AuthErrorKind = "refused" | "unavailable" | "network";

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  readonly status?: number;
  constructor(kind: AuthErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
    this.status = status;
  }
}

type Endpoints = { loginUrl?: string; apiUrl?: string; fetch?: Fetch };

const trim = (url: string) => url.replace(/\/+$/, "");

/** The address of the sign-in page, with a new state and a new PKCE verifier. Keep both until the reader returns. */
export async function createAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  scopes: string[];
  loginUrl?: string;
}): Promise<{ url: string; state: string; codeVerifier: string }> {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = randomToken(32);
  const params = new URLSearchParams({
    app_id: input.appId,
    redirect_uri: input.redirectUri,
    state,
    code_challenge: codeChallenge,
  });
  if (input.scopes.length > 0) params.set("scope", input.scopes.join(","));
  return { url: `${trim(input.loginUrl ?? DEFAULT_LOGIN_URL)}/login?${params}`, state, codeVerifier };
}

async function post(path: string, body: Record<string, unknown>, options: Endpoints): Promise<unknown> {
  const doFetch: Fetch = options.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${trim(options.apiUrl ?? DEFAULT_API_URL)}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("network", "The request to the sign-in service failed.");
  }
  const answer = (await res.json().catch(() => null)) as { data?: unknown; detail?: string; title?: string } | null;
  if (!res.ok) {
    const message = answer?.detail ?? answer?.title ?? `The sign-in service answered ${res.status}.`;
    throw new AuthError(res.status >= 500 ? "unavailable" : "refused", message, res.status);
  }
  return answer?.data;
}

function toTokens(data: unknown): Tokens {
  const d = data as Partial<Tokens> | null | undefined;
  if (!d || typeof d.accessToken !== "string" || typeof d.refreshToken !== "string" || typeof d.userId !== "string" || typeof d.expiresAt !== "string") {
    throw new AuthError("unavailable", "The sign-in service gave an answer with no tokens.");
  }
  return {
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    userId: d.userId,
    email: typeof d.email === "string" ? d.email : null,
    scopes: Array.isArray(d.scopes) ? d.scopes.filter((s): s is string => typeof s === "string") : [],
    expiresAt: d.expiresAt,
  };
}

/** Exchange the code from the return address for tokens. Compare `state` yourself before this call. */
export async function exchangeCode(
  input: { appId: string; code: string; codeVerifier: string; redirectUri: string; appSecret?: string } & Endpoints,
): Promise<Tokens> {
  const body: Record<string, unknown> = { appId: input.appId, code: input.code, codeVerifier: input.codeVerifier, redirectUri: input.redirectUri };
  if (input.appSecret) body.appSecret = input.appSecret;
  return toTokens(await post("/auth/token", body, input));
}

/** A new pair of tokens. The old refresh token stops working. On `refused`, the sign-in has ended. */
export async function refreshTokens(input: { appId: string; refreshToken: string } & Endpoints): Promise<Tokens> {
  return toTokens(await post("/auth/refresh", { appId: input.appId, refreshToken: input.refreshToken }, input));
}

/**
 * End this sign-in on the service. It never throws: your own sign-out must go on when the service is down.
 *
 * `revoked: false` means that the service did not confirm it, so the refresh token can still be alive there.
 * Clear your own session in each case, and keep the refresh token to try again later if that matters to you.
 * Pass the sign-out token to signOutUrl.
 */
export async function revokeTokens(input: { appId: string; refreshToken: string } & Endpoints): Promise<{ revoked: boolean; signOutToken: string | null }> {
  try {
    const data = (await post("/auth/revoke", { appId: input.appId, refreshToken: input.refreshToken }, input)) as { signOutToken?: unknown } | undefined;
    // The service always answers with this field, null or text. Without it, this was not its answer.
    if (!data || !("signOutToken" in data)) return { revoked: false, signOutToken: null };
    return { revoked: true, signOutToken: typeof data.signOutToken === "string" ? data.signOutToken : null };
  } catch {
    return { revoked: false, signOutToken: null };
  }
}

/**
 * Where to send the reader after your own sign-out, so the UrantiaHub account session ends too.
 * `returnTo` must be an address that the app registered.
 */
export function signOutUrl(input: { appId: string; returnTo: string; signOutToken: string | null; loginUrl?: string }): string {
  const params = new URLSearchParams({ app_id: input.appId, return_to: input.returnTo });
  if (input.signOutToken) params.set("token", input.signOutToken);
  return `${trim(input.loginUrl ?? DEFAULT_LOGIN_URL)}/signout?${params}`;
}

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
