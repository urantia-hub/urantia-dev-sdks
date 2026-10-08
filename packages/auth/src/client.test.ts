import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UrantiaAuth } from "./client.js";

// A small browser: storage, a location, and fetch.
const storage = new Map<string, string>();
const location = { href: "https://app.example/", origin: "https://app.example" };
const fetchMock = vi.fn();
const listeners = new Map<string, (e: unknown) => void>();

beforeEach(() => {
  storage.clear();
  location.href = "https://app.example/";
  fetchMock.mockReset();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  listeners.clear();
  vi.stubGlobal("window", {
    location,
    addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokens = (minutes: number, refreshToken = "r2") => ({
  data: { accessToken: "a2", refreshToken, userId: "reader-1", email: null, scopes: ["profile"], expiresAt: new Date(Date.now() + minutes * 60_000).toISOString() },
});
const stored = (minutes: number) =>
  JSON.stringify({ user: { id: "reader-1", email: null, scopes: ["profile"] }, accessToken: "a1", refreshToken: "r1", expiresAt: new Date(Date.now() + minutes * 60_000).toISOString() });
const make = () => new UrantiaAuth({ appId: "my-app", redirectUri: "https://app.example/callback" });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("a stored session whose access token ended", () => {
  // 0.2.0 deleted it, and the refresh token with it. With a 15-minute token that signs a reader out
  // after each short break.
  it("is kept, and is refreshed at the first use", async () => {
    storage.set("urantia_auth_session", stored(-30));
    fetchMock.mockResolvedValue(json(200, tokens(15)));
    const auth = make();
    const seen: Array<string | null> = [];
    auth.onAuthStateChange((s) => seen.push(s?.accessToken ?? null));
    expect(auth.getSession()).toBeNull();
    await flush();
    expect(auth.getSession()?.accessToken).toBe("a2");
    expect(seen.at(-1)).toBe("a2");
    expect(JSON.parse(storage.get("urantia_auth_session") as string).refreshToken).toBe("r2");
  });

  it("is removed when it has no refresh token", () => {
    storage.set("urantia_auth_session", JSON.stringify({ ...JSON.parse(stored(-30)), refreshToken: "" }));
    expect(make().getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
  });
});

describe("a refresh that fails", () => {
  it("signs the reader out when the service refuses the token", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockResolvedValue(json(401, { detail: "Invalid refresh token." }));
    const auth = make();
    await expect(auth.refreshSession()).rejects.toThrow("Invalid refresh token.");
    expect(storage.has("urantia_auth_session")).toBe(false);
  });

  // An outage is not a sign-out. The reader's sign-in must be there when the service is back.
  it.each([
    ["the service is down", () => json(503, { detail: "Try again." })],
    ["the request itself fails", () => { throw new TypeError("fetch failed"); }],
  ])("keeps the sign-in when %s", async (_name, answer) => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockImplementation(async () => answer());
    const auth = make();
    await expect(auth.refreshSession()).rejects.toThrow();
    expect(storage.has("urantia_auth_session")).toBe(true);
    expect(auth.getSession()?.refreshToken).toBe("r1");
  });

  it("makes one request when two callers refresh at the same time", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockResolvedValue(json(200, tokens(15)));
    const auth = make();
    await Promise.all([auth.refreshSession(), auth.refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the return from the sign-in page", () => {
  const begin = () => storage.set("urantia_auth_pkce", JSON.stringify({ codeVerifier: "v1", state: "s1" }));

  it("exchanges the code when the state is the one that was sent", async () => {
    begin();
    fetchMock.mockResolvedValue(json(200, tokens(15)));
    const session = await make().handleCallback("https://app.example/callback?code=c1&state=s1");
    expect(session.accessToken).toBe("a2");
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({ code: "c1", codeVerifier: "v1", redirectUri: "https://app.example/callback" });
  });

  // 0.2.0 accepted a return with no state at all.
  it.each(["https://app.example/callback?code=c1", "https://app.example/callback?code=c1&state=other", "https://app.example/callback?code=c1&state="])(
    "refuses %s",
    async (url) => {
      begin();
      await expect(make().handleCallback(url)).rejects.toThrow(/state/i);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("signOut", () => {
  it("clears the sign-in at once, and tells the service in the background", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockResolvedValue(json(200, { data: { signOutToken: "so1" } }));
    const auth = make();
    const done = auth.signOut();
    expect(auth.getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
    await done;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.urantia.dev/auth/revoke");
    expect(JSON.parse(init.body as string)).toEqual({ appId: "my-app", refreshToken: "r1" });
    expect(location.href).toBe("https://app.example/");
  });

  it("goes on when the service is down", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const auth = make();
    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(auth.getSession()).toBeNull();
  });

  it("also ends the UrantiaHub account session when a return address is given", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockResolvedValue(json(200, { data: { signOutToken: "so1" } }));
    await make().signOut({ returnTo: "https://app.example/" });
    const url = new URL(location.href);
    expect(url.origin + url.pathname).toBe("https://accounts.urantiahub.com/signout");
    expect(Object.fromEntries(url.searchParams)).toEqual({ app_id: "my-app", return_to: "https://app.example/", token: "so1" });
  });
});

// Findings of the commit scan, 2026-10-08.
describe("a sign-out while a refresh is under way", () => {
  it("stays signed out when the refresh answers after it", async () => {
    storage.set("urantia_auth_session", stored(30));
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/auth/refresh") ? new Promise<Response>((r) => (answer = r)) : Promise.resolve(json(200, { data: { signOutToken: null } })),
    );
    const auth = make();
    const refresh = auth.refreshSession().catch(() => "stopped");
    await auth.signOut();
    answer(json(200, tokens(15, "r-new")));
    await refresh;
    await flush();
    expect(auth.getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
    // The pair that arrived late is ended on the service too.
    const revoked = fetchMock.mock.calls.filter(([u]) => (u as string).endsWith("/auth/revoke")).map(([, init]) => JSON.parse((init as RequestInit).body as string).refreshToken);
    expect(revoked).toContain("r-new");
  });
});

describe("signOut, completely", () => {
  it("removes what a sign-in that was started left in storage", async () => {
    storage.set("urantia_auth_session", stored(30));
    storage.set("urantia_auth_pkce", JSON.stringify({ codeVerifier: "v", state: "s" }));
    fetchMock.mockResolvedValue(json(200, { data: { signOutToken: null } }));
    await make().signOut();
    expect(storage.has("urantia_auth_pkce")).toBe(false);
  });

  // The app has more than one tab open. A sign-out in one is a sign-out in each.
  it("signs out a second tab of the app, and signs it in when the first tab does", () => {
    storage.set("urantia_auth_session", stored(30));
    const other = make();
    const seen: Array<string | null> = [];
    other.onAuthStateChange((s) => seen.push(s?.accessToken ?? null));
    storage.delete("urantia_auth_session");
    listeners.get("storage")?.({ key: "urantia_auth_session", newValue: null });
    expect(other.getSession()).toBeNull();
    const fresh = JSON.stringify({ ...JSON.parse(stored(30)), accessToken: "a9" });
    storage.set("urantia_auth_session", fresh);
    listeners.get("storage")?.({ key: "urantia_auth_session", newValue: fresh });
    expect(other.getSession()?.accessToken).toBe("a9");
    expect(seen).toEqual(["a1", null, "a9"]);
  });
});

// Second round of the commit scan, 2026-10-08.
describe("a sign-out in another tab", () => {
  it("holds against a refresh that is under way in this tab", async () => {
    storage.set("urantia_auth_session", stored(30));
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/auth/refresh") ? new Promise<Response>((r) => (answer = r)) : Promise.resolve(json(200, { data: { signOutToken: null } })),
    );
    const auth = make();
    const refresh = auth.refreshSession().catch(() => "stopped");
    // The other tab signs out: the key goes, and this tab hears it.
    storage.delete("urantia_auth_session");
    listeners.get("storage")?.({ key: "urantia_auth_session", newValue: null });
    answer(json(200, tokens(15, "r-new")));
    await refresh;
    await flush();
    expect(auth.getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
  });
});

describe("a sign-out while a sign-in is finishing", () => {
  it("stays signed out when the code exchange answers after it", async () => {
    storage.set("urantia_auth_pkce", JSON.stringify({ codeVerifier: "v1", state: "s1" }));
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/auth/token") ? new Promise<Response>((r) => (answer = r)) : Promise.resolve(json(200, { data: { signOutToken: null } })),
    );
    const auth = make();
    const signIn = auth.handleCallback("https://app.example/callback?code=c1&state=s1").catch(() => "stopped");
    await auth.signOut();
    answer(json(200, tokens(15, "r-late")));
    expect(await signIn).toBe("stopped");
    await flush();
    expect(auth.getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
    const revoked = fetchMock.mock.calls.filter(([u]) => (u as string).endsWith("/auth/revoke")).map(([, init]) => JSON.parse((init as RequestInit).body as string).refreshToken);
    expect(revoked).toContain("r-late");
  });
});

describe("what is read from storage", () => {
  // Another script on the page, or an old version, can leave anything under the key.
  it.each([
    ["text that is not JSON", "not json"],
    ["a list", "[]"],
    ["a session with no access token", JSON.stringify({ refreshToken: "r", expiresAt: new Date().toISOString(), user: { id: "u" } })],
    ["a session with a date that is not a date", JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: "soon", user: { id: "u", email: null, scopes: [] } })],
    ["a session with no reader", JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: new Date().toISOString() })],
  ])("is dropped when it is %s", (_name, value) => {
    storage.set("urantia_auth_session", value);
    const auth = make();
    expect(auth.getSession()).toBeNull();
    expect(storage.has("urantia_auth_session")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// Third round of the commit scan. A storage event arrives late, so a tab cannot rely on it to know
// that another tab signed out. The mark of a sign-out is in storage itself, which each tab reads at once.
describe("a sign-out in another tab, before this tab hears of it", () => {
  it("still stops a refresh that answers in this tab", async () => {
    storage.set("urantia_auth_session", stored(30));
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/auth/refresh") ? new Promise<Response>((r) => (answer = r)) : Promise.resolve(json(200, { data: { signOutToken: null } })),
    );
    const tabA = make();
    const tabB = make();
    const refresh = tabB.refreshSession().catch(() => "stopped");
    await tabA.signOut();
    // No storage event reaches tab B here.
    answer(json(200, tokens(15, "r-new")));
    expect(await refresh).toBe("stopped");
    await flush();
    expect(storage.has("urantia_auth_session")).toBe(false);
  });

  it("lets a new sign-in work after a sign-out", async () => {
    storage.set("urantia_auth_session", stored(30));
    fetchMock.mockResolvedValue(json(200, { data: { signOutToken: null } }));
    const auth = make();
    await auth.signOut();
    storage.set("urantia_auth_pkce", JSON.stringify({ codeVerifier: "v1", state: "s1" }));
    fetchMock.mockResolvedValue(json(200, tokens(15)));
    const session = await auth.handleCallback("https://app.example/callback?code=c1&state=s1");
    expect(session.accessToken).toBe("a2");
    expect(storage.has("urantia_auth_session")).toBe(true);
  });
});

describe("the address of the sign-in page", () => {
  it("carries the permissions under the same name as the server entry", async () => {
    const auth = make();
    void auth.signIn({ scopes: ["profile", "bookmarks"], mode: "redirect" });
    await flush();
    await flush();
    const url = new URL(location.href);
    expect(url.searchParams.get("scope")).toBe("profile,bookmarks");
    expect(url.searchParams.has("scopes")).toBe(false);
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });
});
