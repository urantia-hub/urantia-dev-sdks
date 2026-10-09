// The requests of a sign-in with a UrantiaHub account. No browser API and no other package, so the
// browser entry and the server entry share them.

import { generatePKCE, randomToken } from "./pkce.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const DEFAULT_API_URL = "https://api.urantia.dev";

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
  /**
   * Ask the reader which account to use ("Continue as …?"), in place of a silent sign-in.
   * Pass true for the first sign-in after your app signed the reader out without `signOutUrl`.
   */
  askAccount?: boolean;
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
  if (input.askAccount) params.set("prompt", "select_account");
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
  input: { appId: string; code: string; codeVerifier?: string; redirectUri?: string; appSecret?: string } & Endpoints,
): Promise<Tokens> {
  const body: Record<string, unknown> = { appId: input.appId, code: input.code };
  if (input.codeVerifier) body.codeVerifier = input.codeVerifier;
  if (input.redirectUri) body.redirectUri = input.redirectUri;
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
