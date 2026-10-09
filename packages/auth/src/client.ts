import { AuthError, exchangeCode, refreshTokens, revokeTokens, signOutUrl, type Tokens } from "./flow.js";
import { generatePKCE, randomToken } from "./pkce.js";
import type { AuthStateChangeCallback, Session, SignInOptions, UrantiaAuthOptions } from "./types.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const DEFAULT_API_URL = "https://api.urantia.dev";
const STORAGE_KEY = "urantia_auth_session";
const PKCE_KEY = "urantia_auth_pkce";
// The count of sign-outs in this browser. Each tab reads it at once, with no wait for a storage event.
const SIGN_OUTS_KEY = "urantia_auth_sign_outs";
// Set by a sign-out with no trip to the accounts site. The next sign-in then asks which account.
const ASK_ACCOUNT_KEY = "urantia_auth_ask_account";

function storageFlag(key: string, value?: boolean): boolean {
  try {
    if (value === true) localStorage.setItem(key, "1");
    else if (value === false) localStorage.removeItem(key);
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
// Refresh this long before the access token ends.
const REFRESH_AHEAD_MS = 2 * 60 * 1000;

const toSession = (tokens: Tokens): Session => ({
  user: { id: tokens.userId, email: tokens.email, scopes: tokens.scopes },
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresAt: tokens.expiresAt,
});

/**
 * Sign-in with a UrantiaHub account, in the browser. The tokens are kept in localStorage.
 * For a server that keeps the session in a cookie, use `@urantia/auth/server`.
 */
export class UrantiaAuth {
  private readonly appId: string;
  private readonly appSecret?: string;
  private readonly loginUrl: string;
  private readonly apiUrl: string;
  private readonly redirectUri?: string;
  private session: Session | null = null;
  private listeners: Set<AuthStateChangeCallback> = new Set();
  // One refresh at a time. A refresh token works one time, so two requests would end the sign-in.
  private refreshing: Promise<Session> | null = null;
  // Counts the sign-outs. A refresh that answers after a sign-out must not sign the reader in again.
  private signOuts = 0;
  // This page signed out. Kept here too, for a browser that gives no storage.
  private askAccount = false;

  constructor(options: UrantiaAuthOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.loginUrl = (options.loginUrl ?? DEFAULT_LOGIN_URL).replace(/\/+$/, "");
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    this.redirectUri = options.redirectUri;
    if (typeof window !== "undefined") {
      this.restoreSession();
      // Another tab of this app signed in, refreshed, or signed out.
      window.addEventListener?.("storage", (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY) return;
        // A removed key is a sign-out in the other tab. It counts as one here too, so a request that
        // is under way in this tab cannot sign the reader in again.
        if (!event.newValue) this.signOuts += 1;
        this.session = null;
        if (event.newValue) this.restoreSession();
        this.notify();
      });
    }
  }

  /**
   * Start the sign-in.
   *
   * Popup mode (the default) opens the sign-in page in a popup and resolves with the session.
   * Redirect mode sends this page to the sign-in page: call `handleCallback()` on the return page.
   * On a server, pass the `code` from the return address, or use `@urantia/auth/server`.
   */
  async signIn(options?: SignInOptions & { code?: string }): Promise<Session> {
    if (options?.code) return this.finish(options.code);

    if (typeof window === "undefined") {
      throw new Error("UrantiaAuth.signIn() needs a `code` on a server. Use `@urantia/auth/server` for the whole flow.");
    }
    if (!this.redirectUri) throw new Error("UrantiaAuth needs a `redirectUri` option for a sign-in in the browser.");

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = randomToken(32);
    // localStorage, so the data is there when an email link opens the return page in a new tab.
    localStorage.setItem(PKCE_KEY, JSON.stringify({ codeVerifier, state }));

    const params = new URLSearchParams({ app_id: this.appId, redirect_uri: this.redirectUri, state, code_challenge: codeChallenge });
    const scopes = options?.scopes ?? [];
    // The same name as the server entry sends. The sign-in page reads one name for both.
    if (scopes.length > 0) params.set("scope", scopes.join(","));
    // The reader is still signed in on the accounts site after a sign-out with no redirect.
    // So this sign-in is not silent: the accounts site shows its sign-in page.
    if (this.willAskAccount()) params.set("prompt", "select_account");
    const loginPageUrl = `${this.loginUrl}/login?${params}`;

    if ((options?.mode ?? "popup") === "redirect") {
      window.location.href = loginPageUrl;
      return new Promise(() => {});
    }

    return new Promise((resolve, reject) => {
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(loginPageUrl, "urantia_auth", `width=${width},height=${height},left=${left},top=${top},popup=1`);
      if (!popup) {
        reject(new Error("The popup did not open. Allow popups for this site."));
        return;
      }

      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            reject(new Error("The sign-in popup was closed."));
            return;
          }
          const url = new URL(popup.location.href);
          if (url.origin === window.location.origin) {
            clearInterval(interval);
            popup.close();
            this.handleCallback(url.toString()).then(resolve, reject);
          }
        } catch {
          // Another origin: the popup is still on the sign-in page.
        }
      }, 200);
    });
  }

  /** Finish a sign-in on the return page. It checks the `state` that `signIn()` sent. */
  async handleCallback(url?: string): Promise<Session> {
    const callbackUrl = new URL(url ?? window.location.href);
    const error = callbackUrl.searchParams.get("error");
    if (error) throw new Error(error);
    const code = callbackUrl.searchParams.get("code");
    if (!code) throw new Error("The return address has no code.");

    const stored = localStorage.getItem(PKCE_KEY);
    if (!stored) throw new Error("No sign-in was started in this browser. Call signIn() first.");
    const { codeVerifier, state } = JSON.parse(stored) as { codeVerifier: string; state: string };
    localStorage.removeItem(PKCE_KEY);

    // The state must come back, and it must be the one that was sent. A return with none is refused.
    if (!state || callbackUrl.searchParams.get("state") !== state) {
      throw new Error("The state of the return does not match the sign-in that was started.");
    }
    return this.finish(code, codeVerifier);
  }

  /** True when the next sign-in asks the reader which account to use: after a sign-out, until a sign-in. */
  willAskAccount(): boolean {
    return this.askAccount || storageFlag(ASK_ACCOUNT_KEY);
  }

  /**
   * Sign out. The sign-in in this browser ends at once, and the service is told in the background.
   * The page does not leave your app. The reader's next sign-in is not silent: the accounts site shows its sign-in page.
   *
   * With `returnTo` (an address that your app registered), the page then goes to the accounts site,
   * which ends the UrantiaHub account session too and sends the reader back. Use it for a sign-out
   * on a shared computer.
   */
  async signOut(options?: { returnTo?: string }): Promise<void> {
    const refreshToken = this.session?.refreshToken;
    this.markSignOut();
    this.clear();
    // The reader can still be signed in on the accounts site: with no trip there, and also when the
    // trip does not end that session. So each sign-out makes the next sign-in ask which account.
    // Only a finished sign-in stops that.
    this.askAccount = true;
    storageFlag(ASK_ACCOUNT_KEY, true);
    try {
      localStorage.removeItem(PKCE_KEY);
    } catch {
      // Storage is not available.
    }
    if (!refreshToken) return;
    const { signOutToken } = await revokeTokens({ appId: this.appId, refreshToken, apiUrl: this.apiUrl });
    if (options?.returnTo && typeof window !== "undefined") {
      window.location.href = signOutUrl({ appId: this.appId, returnTo: options.returnTo, signOutToken, loginUrl: this.loginUrl });
    }
  }

  /**
   * The session, or null. A session whose access token is near its end is refreshed in the
   * background: `onAuthStateChange` fires when the new one is there.
   */
  getSession(): Session | null {
    if (!this.session) return null;
    const endsIn = new Date(this.session.expiresAt).getTime() - Date.now();
    if (endsIn < REFRESH_AHEAD_MS) this.refreshSession().catch(() => {});
    return endsIn > 0 ? this.session : null;
  }

  /** The access token, or null. */
  getToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  /**
   * Get a new access token now. If the service refuses the refresh token, the sign-in ends.
   * If the service is down or the request fails, the sign-in is kept, and this throws.
   */
  refreshSession(): Promise<Session> {
    if (this.refreshing) return this.refreshing;
    const current = this.session;
    if (!current?.refreshToken) return Promise.reject(new Error("No refresh token."));

    const startedAt = this.signOutCount();
    this.refreshing = refreshTokens({ appId: this.appId, refreshToken: current.refreshToken, apiUrl: this.apiUrl })
      .then((tokens) => this.keepUnlessSignedOut(tokens, startedAt))
      .catch((error) => {
        if (error instanceof AuthError && error.kind === "refused") this.clear();
        throw error;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  /** Listen for a sign-in, a refresh, and a sign-out. Returns a function that stops it. */
  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.session);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Each request that ends in a session passes here. If the reader signed out while the request was
  // under way, the new pair is ended on the service and no session is kept.
  private keepUnlessSignedOut(tokens: Tokens, startedAt: string): Session {
    if (this.signOutCount() !== startedAt) {
      void revokeTokens({ appId: this.appId, refreshToken: tokens.refreshToken, apiUrl: this.apiUrl });
      throw new Error("Signed out.");
    }
    return this.keep(toSession(tokens));
  }

  private async finish(code: string, codeVerifier?: string): Promise<Session> {
    const startedAt = this.signOutCount();
    const tokens = await exchangeCode({
      appId: this.appId,
      code,
      codeVerifier,
      redirectUri: this.redirectUri,
      appSecret: this.appSecret,
      apiUrl: this.apiUrl,
    });
    const session = await this.keepUnlessSignedOut(tokens, startedAt);
    // The reader signed in again, so the next sign-in does not need the question.
    this.askAccount = false;
    storageFlag(ASK_ACCOUNT_KEY, false);
    return session;
  }

  // The sign-outs that this client knows of: its own, and those of each other tab of this browser.
  private signOutCount(): string {
    let shared = "";
    try {
      shared = localStorage.getItem(SIGN_OUTS_KEY) ?? "";
    } catch {
      // Storage is not available.
    }
    return `${this.signOuts}:${shared}`;
  }

  private markSignOut(): void {
    this.signOuts += 1;
    try {
      localStorage.setItem(SIGN_OUTS_KEY, String(Number(localStorage.getItem(SIGN_OUTS_KEY) ?? "0") + 1));
    } catch {
      // Storage is not available. The count in memory still holds for this tab.
    }
  }

  private keep(session: Session): Session {
    this.session = session;
    try {
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage is not available.
    }
    this.notify();
    return session;
  }

  private clear(): void {
    this.session = null;
    try {
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is not available.
    }
    this.notify();
  }

  private restoreSession(): void {
    let session: Session | null = null;
    try {
      session = asSession(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      // Not readable, or not available.
    }
    // A session whose access token ended is kept: the first use refreshes it.
    if (session) {
      this.session = session;
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is not available.
    }
  }

  private notify(): void {
    for (const callback of this.listeners) {
      try {
        callback(this.session);
      } catch {
        // A listener that throws must not break the sign-in.
      }
    }
  }
}

// What is under the storage key, as a session, or null if it is not one. Another script on the page, or
// an older version, can leave anything there.
function asSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Partial<Session>;
  if (typeof s.accessToken !== "string" || !s.accessToken) return null;
  if (typeof s.refreshToken !== "string" || !s.refreshToken) return null;
  if (typeof s.expiresAt !== "string" || Number.isNaN(new Date(s.expiresAt).getTime())) return null;
  if (typeof s.user !== "object" || s.user === null || typeof s.user.id !== "string") return null;
  return {
    user: {
      id: s.user.id,
      email: typeof s.user.email === "string" ? s.user.email : null,
      scopes: Array.isArray(s.user.scopes) ? s.user.scopes.filter((x): x is string => typeof x === "string") : [],
    },
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    expiresAt: s.expiresAt,
  };
}
