export interface UrantiaAuthOptions {
  /** Your OAuth app ID (registered at api.urantia.dev). */
  appId: string;
  /** Your OAuth app secret. Required for server-side token exchange. */
  appSecret?: string;
  /** Base URL for the login page. Defaults to https://accounts.urantiahub.com */
  loginUrl?: string;
  /** Base URL for the API. Defaults to https://api.urantia.dev */
  apiUrl?: string;
  /** Redirect URI registered with your app. Required for browser sign-in. */
  redirectUri?: string;
}

export interface User {
  id: string;
  email: string | null;
  scopes: string[];
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface SignInOptions {
  /** OAuth scopes to request (e.g. ['bookmarks', 'notes']). */
  scopes?: string[];
  /** Use popup (default) or redirect flow in the browser. */
  mode?: "popup" | "redirect";
}

export type AuthStateChangeCallback = (session: Session | null) => void;
