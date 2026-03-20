import type {
  UrantiaAuthOptions,
  Session,
  SignInOptions,
  AuthStateChangeCallback,
} from "./types.js";

const DEFAULT_LOGIN_URL = "https://accounts.urantiahub.com";
const DEFAULT_API_URL = "https://api.urantia.dev";
const STORAGE_KEY = "urantia_auth_session";

export class UrantiaAuth {
  private readonly appId: string;
  private readonly appSecret?: string;
  private readonly loginUrl: string;
  private readonly apiUrl: string;
  private readonly redirectUri?: string;
  private session: Session | null = null;
  private listeners: Set<AuthStateChangeCallback> = new Set();

  constructor(options: UrantiaAuthOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.loginUrl = (options.loginUrl ?? DEFAULT_LOGIN_URL).replace(/\/+$/, "");
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    this.redirectUri = options.redirectUri;

    // Restore session from storage in browser
    if (typeof window !== "undefined") {
      this.restoreSession();
    }
  }

  /**
   * Start the OAuth sign-in flow.
   *
   * **Browser (popup mode):** Opens a popup window to accounts.urantiahub.com/login.
   * After the user signs in, the popup redirects back with an authorization code
   * which is exchanged for an access token.
   *
   * **Browser (redirect mode):** Redirects the current page to the login URL.
   * After sign-in, call `handleCallback()` on the redirect URI page.
   *
   * **Server:** Pass an authorization `code` obtained from the OAuth flow
   * to exchange it for a token directly.
   */
  async signIn(options?: SignInOptions & { code?: string }): Promise<Session> {
    // Server-side: direct code exchange
    if (options?.code) {
      return this.exchangeCode(options.code);
    }

    // Browser: must have a redirectUri
    if (typeof window === "undefined") {
      throw new Error(
        "UrantiaAuth.signIn() requires a `code` parameter in server environments. " +
          "Use the browser flow or obtain an authorization code first."
      );
    }

    if (!this.redirectUri) {
      throw new Error(
        "UrantiaAuth requires a `redirectUri` option for browser sign-in."
      );
    }

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const scopes = options?.scopes ?? [];
    const state = crypto.randomUUID();
    const mode = options?.mode ?? "popup";

    // Store PKCE verifier and state for callback
    sessionStorage.setItem(
      "urantia_auth_pkce",
      JSON.stringify({ codeVerifier, state })
    );

    const loginParams = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
    });
    if (scopes.length > 0) {
      loginParams.set("scopes", scopes.join(","));
    }

    const loginPageUrl = `${this.loginUrl}/login?${loginParams}`;

    if (mode === "redirect") {
      window.location.href = loginPageUrl;
      // This will navigate away — return a never-resolving promise
      return new Promise(() => {});
    }

    // Popup mode
    return new Promise((resolve, reject) => {
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        loginPageUrl,
        "urantia_auth",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        reject(new Error("Failed to open popup window. Please allow popups."));
        return;
      }

      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            reject(new Error("Sign-in popup was closed."));
            return;
          }
          const url = new URL(popup.location.href);
          if (url.origin === window.location.origin) {
            clearInterval(interval);
            popup.close();
            const code = url.searchParams.get("code");
            if (!code) {
              const error = url.searchParams.get("error") || "No code received";
              reject(new Error(error));
              return;
            }
            this.exchangeCode(code, codeVerifier).then(resolve, reject);
          }
        } catch {
          // Cross-origin — popup hasn't redirected back yet
        }
      }, 200);
    });
  }

  /**
   * Handle the OAuth callback on the redirect URI page.
   * Call this in your redirect page to complete the sign-in flow.
   */
  async handleCallback(url?: string): Promise<Session> {
    const callbackUrl = new URL(url ?? window.location.href);
    const code = callbackUrl.searchParams.get("code");
    const returnedState = callbackUrl.searchParams.get("state");
    const error = callbackUrl.searchParams.get("error");

    if (error) {
      throw new Error(error);
    }
    if (!code) {
      throw new Error("No authorization code in callback URL.");
    }

    // Verify state and retrieve PKCE verifier
    const stored = sessionStorage.getItem("urantia_auth_pkce");
    if (!stored) {
      throw new Error("No PKCE data found. Was signIn() called first?");
    }
    const { codeVerifier, state } = JSON.parse(stored);
    sessionStorage.removeItem("urantia_auth_pkce");

    if (returnedState && returnedState !== state) {
      throw new Error("State mismatch — possible CSRF attack.");
    }

    return this.exchangeCode(code, codeVerifier);
  }

  /** Sign out and clear the session. */
  signOut(): void {
    this.session = null;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage may be unavailable
      }
    }
    this.notifyListeners();
  }

  /** Get the current session, or null if not signed in. */
  getSession(): Session | null {
    if (this.session && new Date(this.session.expiresAt) < new Date()) {
      this.signOut();
      return null;
    }
    return this.session;
  }

  /** Get the current access token, or null if not signed in. */
  getToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  /** Listen for auth state changes (sign-in / sign-out). Returns an unsubscribe function. */
  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    this.listeners.add(callback);
    // Fire immediately with current state
    callback(this.session);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ─── Private ───

  private async exchangeCode(
    code: string,
    codeVerifier?: string
  ): Promise<Session> {
    const body: Record<string, string> = {
      code,
      appId: this.appId,
    };
    if (this.appSecret) body.appSecret = this.appSecret;
    if (codeVerifier) body.codeVerifier = codeVerifier;

    const res = await fetch(`${this.apiUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(
        err?.detail || err?.title || `Token exchange failed: ${res.status}`
      );
    }

    const { data } = await res.json();
    const session: Session = {
      user: {
        id: data.userId,
        email: data.email ?? null,
        scopes: data.scopes ?? [],
      },
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
    };

    this.session = session;
    this.persistSession();
    this.notifyListeners();
    return session;
  }

  private persistSession(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    } catch {
      // Storage may be unavailable
    }
  }

  private restoreSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session: Session = JSON.parse(raw);
      if (new Date(session.expiresAt) > new Date()) {
        this.session = session;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Corrupt or unavailable
    }
  }

  private notifyListeners(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.session);
      } catch {
        // Don't let listener errors break the auth flow
      }
    }
  }
}

// ─── PKCE Helpers ───

async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array);

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(codeVerifier)
  );
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
