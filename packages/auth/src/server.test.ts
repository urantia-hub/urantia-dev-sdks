import { readFileSync } from "node:fs";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  createAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  revokeTokens,
  signOutUrl,
  createTokenVerifier,
} from "./server.js";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const TOKENS = {
  accessToken: "access",
  refreshToken: "refresh",
  userId: "reader-1",
  email: "reader@example.com",
  scopes: ["profile"],
  expiresAt: "2026-10-08T12:15:00.000Z",
};

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

describe("createAuthorizeUrl", () => {
  it("makes a URL to the sign-in page with the app, the address, the permissions, the state, and an S256 challenge", async () => {
    const { url, state, codeVerifier } = await createAuthorizeUrl({
      appId: "my-app",
      redirectUri: "https://app.example/callback",
      scopes: ["profile", "bookmarks"],
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://accounts.urantiahub.com/login");
    expect(parsed.searchParams.get("app_id")).toBe("my-app");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example/callback");
    expect(parsed.searchParams.get("scope")).toBe("profile,bookmarks");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("code_challenge")).toBe(await s256(codeVerifier));
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(state.length).toBeGreaterThanOrEqual(32);
  });

  it("makes a new state and a new verifier at each call", async () => {
    const input = { appId: "my-app", redirectUri: "https://app.example/callback", scopes: ["profile"] };
    const a = await createAuthorizeUrl(input);
    const b = await createAuthorizeUrl(input);
    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  it("uses another sign-in host when given one", async () => {
    const { url } = await createAuthorizeUrl({ appId: "a", redirectUri: "http://localhost:3000/cb", scopes: [], loginUrl: "http://localhost:3001/" });
    expect(url.startsWith("http://localhost:3001/login?")).toBe(true);
  });
});

describe("exchangeCode, refreshTokens, revokeTokens", () => {
  it("sends the code, the verifier, and the address to /auth/token, and returns the tokens", async () => {
    const fetch = vi.fn(async () => json(200, { data: TOKENS }));
    const tokens = await exchangeCode({ appId: "my-app", code: "c1", codeVerifier: "v1", redirectUri: "https://app.example/callback", fetch });
    expect(tokens).toEqual(TOKENS);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.urantia.dev/auth/token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ appId: "my-app", code: "c1", codeVerifier: "v1", redirectUri: "https://app.example/callback" });
  });

  it("sends the app secret only when one is given", async () => {
    const fetch = vi.fn(async () => json(200, { data: TOKENS }));
    await exchangeCode({ appId: "a", code: "c", codeVerifier: "v", redirectUri: "https://x/cb", appSecret: "s3", fetch });
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).appSecret).toBe("s3");
  });

  it("throws an AuthError with the status and the message of the API on a refusal", async () => {
    const fetch = vi.fn(async () => json(400, { detail: "Authorization code has expired." }));
    const error = await exchangeCode({ appId: "a", code: "c", codeVerifier: "v", redirectUri: "https://x/cb", fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ kind: "refused", status: 400, message: "Authorization code has expired." });
  });

  // A caller must tell "sign the reader out" from "try again later".
  it("names a failed request network, and a 5xx answer unavailable", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await refreshTokens({ appId: "a", refreshToken: "r", fetch: down }).catch((e) => e)).toMatchObject({ kind: "network" });
    const busy = vi.fn(async () => json(503, { detail: "Try again." }));
    expect(await refreshTokens({ appId: "a", refreshToken: "r", fetch: busy }).catch((e) => e)).toMatchObject({ kind: "unavailable", status: 503 });
  });

  it("refuses an answer that is not a set of tokens", async () => {
    const fetch = vi.fn(async () => json(200, { data: { accessToken: "only" } }));
    expect(await refreshTokens({ appId: "a", refreshToken: "r", fetch }).catch((e) => e)).toMatchObject({ kind: "unavailable" });
  });

  it("refreshes", async () => {
    const fetch = vi.fn(async () => json(200, { data: TOKENS }));
    expect(await refreshTokens({ appId: "my-app", refreshToken: "r1", fetch })).toEqual(TOKENS);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.urantia.dev/auth/refresh");
    expect(JSON.parse(init.body as string)).toEqual({ appId: "my-app", refreshToken: "r1" });
  });

  it("revokes, and gives the sign-out token", async () => {
    const fetch = vi.fn(async () => json(200, { data: { signOutToken: "so1" } }));
    expect(await revokeTokens({ appId: "my-app", refreshToken: "r1", fetch })).toEqual({ revoked: true, signOutToken: "so1" });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("https://api.urantia.dev/auth/revoke");
  });

  // A sign-out must go on when the API is down: the app still clears its own session.
  // It must also say that the sign-in is still alive on the service, so the app does not believe it ended.
  it("does not throw when the revoke request fails, and says that nothing was revoked", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await revokeTokens({ appId: "a", refreshToken: "r", fetch: down })).toEqual({ revoked: false, signOutToken: null });
    const busy = vi.fn(async () => json(503, { detail: "Try again." }));
    expect(await revokeTokens({ appId: "a", refreshToken: "r", fetch: busy })).toEqual({ revoked: false, signOutToken: null });
    const odd = vi.fn(async () => json(200, { nothing: true }));
    expect(await revokeTokens({ appId: "a", refreshToken: "r", fetch: odd })).toEqual({ revoked: false, signOutToken: null });
  });
});

describe("signOutUrl", () => {
  it("builds the address with the app, the return address, and the token", () => {
    const url = new URL(signOutUrl({ appId: "my-app", returnTo: "https://app.example/", signOutToken: "so1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.urantiahub.com/signout");
    expect(Object.fromEntries(url.searchParams)).toEqual({ app_id: "my-app", return_to: "https://app.example/", token: "so1" });
  });
  it("leaves the token out when there is none", () => {
    expect(new URL(signOutUrl({ appId: "a", returnTo: "https://x/", signOutToken: null })).searchParams.has("token")).toBe(false);
  });
});

describe("createTokenVerifier", () => {
  const makeKey = async (kid: string) => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" } };
  };
  const sign = (privateKey: CryptoKey, kid: string, claims: Record<string, unknown> = {}, audience = "authenticated") =>
    new SignJWT({ app_id: "my-app", scopes: ["profile"], email: null, ...claims })
      .setProtectedHeader({ alg: "ES256", kid })
      .setSubject("reader-1")
      .setIssuer("https://accounts.urantiahub.com")
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);

  it("verifies a token against the key file and returns the claims", async () => {
    const key = await makeKey("k1");
    const fetch = vi.fn(async () => json(200, { keys: [key.jwk] }));
    const verify = createTokenVerifier({ appId: "my-app", fetch });
    expect(await verify(await sign(key.privateKey, "k1"))).toEqual({ userId: "reader-1", appId: "my-app", email: null, scopes: ["profile"] });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("https://accounts.urantiahub.com/.well-known/jwks.json");
  });

  it("fetches the keys one time for many tokens", async () => {
    const key = await makeKey("k1");
    const fetch = vi.fn(async () => json(200, { keys: [key.jwk] }));
    const verify = createTokenVerifier({ appId: "my-app", fetch });
    await verify(await sign(key.privateKey, "k1"));
    await verify(await sign(key.privateKey, "k1"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // A key change: the API signs with a new key before this server fetched the key file again.
  it("fetches the keys again one time for a key id that it does not know", async () => {
    const oldKey = await makeKey("k1");
    const newKey = await makeKey("k2");
    let served = [oldKey.jwk];
    const fetch = vi.fn(async () => json(200, { keys: served }));
    const verify = createTokenVerifier({ appId: "my-app", fetch });
    await verify(await sign(oldKey.privateKey, "k1"));
    served = [oldKey.jwk, newKey.jwk];
    expect((await verify(await sign(newKey.privateKey, "k2"))).userId).toBe("reader-1");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not fetch the keys again for each token with a made-up key id", async () => {
    const key = await makeKey("k1");
    const fetch = vi.fn(async () => json(200, { keys: [key.jwk] }));
    const verify = createTokenVerifier({ appId: "my-app", fetch });
    for (let i = 0; i < 5; i++) await verify(await sign(key.privateKey, `made-up-${i}`)).catch(() => {});
    // The first load, and one more look.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // The same key signs the tokens of each app. A backend that takes any of them takes the token that
  // another app holds for the same reader.
  it("needs the app to be named, or a plain statement that any app is accepted", async () => {
    const key = await makeKey("k1");
    const fetch = vi.fn(async () => json(200, { keys: [key.jwk] }));
    // @ts-expect-error appId or anyApp is required
    expect(() => createTokenVerifier({ fetch })).toThrow(/appId/);
    const open = createTokenVerifier({ anyApp: true, fetch });
    expect((await open(await sign(key.privateKey, "k1", { app_id: "another-app" }))).appId).toBe("another-app");
  });

  it("accepts a list of apps", async () => {
    const key = await makeKey("k1");
    const verify = createTokenVerifier({ appId: ["web", "mobile"], fetch: vi.fn(async () => json(200, { keys: [key.jwk] })) });
    expect((await verify(await sign(key.privateKey, "k1", { app_id: "mobile" }))).appId).toBe("mobile");
    expect(await verify(await sign(key.privateKey, "k1", { app_id: "my-app" })).catch((e) => e)).toMatchObject({ kind: "refused" });
  });

  it("refuses a token of another app", async () => {
    const key = await makeKey("k1");
    const verify = createTokenVerifier({ appId: "other-app", fetch: vi.fn(async () => json(200, { keys: [key.jwk] })) });
    expect(await verify(await sign(key.privateKey, "k1")).catch((e) => e)).toMatchObject({ kind: "refused" });
  });

  it("refuses a sign-out token, a token of another key, and text that is not a token", async () => {
    const key = await makeKey("k1");
    const other = await makeKey("k1");
    const verify = createTokenVerifier({ appId: "my-app", fetch: vi.fn(async () => json(200, { keys: [key.jwk] })) });
    expect(await verify(await sign(key.privateKey, "k1", { purpose: "signout" }, "signout")).catch((e) => e)).toMatchObject({ kind: "refused" });
    expect(await verify(await sign(other.privateKey, "k1")).catch((e) => e)).toMatchObject({ kind: "refused" });
    expect(await verify("abc").catch((e) => e)).toMatchObject({ kind: "refused" });
  });

  it("names it unavailable, not refused, when the key file cannot be read", async () => {
    const key = await makeKey("k1");
    const verify = createTokenVerifier({ appId: "my-app", fetch: vi.fn(async () => { throw new TypeError("fetch failed"); }) });
    expect(await verify(await sign(key.privateKey, "k1")).catch((e) => e)).toMatchObject({ kind: "unavailable" });
  });
});

describe("the server entry", () => {
  it("has no reference to the browser", () => {
    for (const file of ["src/server.ts", "src/flow.ts", "src/pkce.ts"]) {
      const text = readFileSync(file, "utf8");
      for (const word of ["window", "document", "localStorage", "sessionStorage"]) expect(text).not.toContain(word);
    }
  });
});
