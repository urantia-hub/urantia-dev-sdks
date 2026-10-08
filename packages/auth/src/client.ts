import { AuthError, exchangeCode, refreshTokens, revokeTokens, signOutUrl, type Tokens } from "./flow.js";
import { generatePKCE, randomToken } from "./pkce.js";
import type { AuthStateChangeCallback, Session, SignInOptions, UrantiaAuthOptions } from "./types.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const DEFAULT_API_URL = "https://api.urantia.dev";
const STORAGE_KEY = "urantia_auth_session";
const PKCE_KEY = "urantia_auth_pkce";
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

  constructor(options: UrantiaAuthOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.loginUrl = (options.loginUrl ?? DEFAULT_LOGIN_URL).replace(/\/+$/, "");
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    this.redirectUri = options.redirectUri;
    if (typeof window !== "undefined") this.restoreSession();
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
    if (scopes.length > 0) params.set("scopes", scopes.join(","));
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

  /**
   * Sign out. The sign-in in this browser ends at once, and the service is told in the background.
   *
   * With `returnTo` (an address that your app registered), the page then goes to the accounts site,
   * which ends the UrantiaHub account session too and sends the reader back. Use it for a sign-out
   * on a shared computer.
   */
  async signOut(options?: { returnTo?: string }): Promise<void> {
    const refreshToken = this.session?.refreshToken;
    this.clear();
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

    this.refreshing = refreshTokens({ appId: this.appId, refreshToken: current.refreshToken, apiUrl: this.apiUrl })
      .then((tokens) => this.keep(toSession(tokens)))
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

  private async finish(code: string, codeVerifier?: string): Promise<Session> {
    const tokens = await exchangeCode({
      appId: this.appId,
      code,
      codeVerifier,
      redirectUri: this.redirectUri,
      appSecret: this.appSecret,
      apiUrl: this.apiUrl,
    });
    return this.keep(toSession(tokens));
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as Session;
      // A session whose access token ended is kept while it has a refresh token: the first use refreshes it.
      if (session.refreshToken || new Date(session.expiresAt) > new Date()) this.session = session;
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Not readable, or not available.
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
