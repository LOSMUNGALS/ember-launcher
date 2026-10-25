import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
declare const __EMBER_ACCOUNT_URL__: string;
export function accountEndpoint(value: string) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== "/")
    throw Error("Use the service origin only, without credentials or a path.");
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    )
  )
    throw Error("Account services require HTTPS, except on this computer.");
  return u.origin;
}
export class AccountClient {
  private restoring?: Promise<ReturnType<AccountClient["status"]>>;
  private credentialQueue = Promise.resolve();
  private remembered = false;
  private token = "";
  private verifiedAt = 0;
  private generation = 0;
  user?: {
    id: number;
    username: string;
    displayName?: string;
    email: string;
    role: "user" | "admin";
  };
  url = accountEndpoint(
    process.env.EMBER_ACCOUNT_URL ||
      (typeof __EMBER_ACCOUNT_URL__ === "string"
        ? __EMBER_ACCOUNT_URL__
        : "http://127.0.0.1:4783"),
  );
  constructor(
    private root: string,
    private protection?: {
      available: () => boolean;
      encrypt: (value: string) => Buffer;
      decrypt: (value: Buffer) => string;
    },
  ) {}
  private credentialFile() {
    return path.join(this.root, "remembered-session.bin");
  }
  private forget() {
    this.remembered = false;
    const task = this.credentialQueue
      .catch(() => {})
      .then(() => rm(this.credentialFile(), { force: true }));
    this.credentialQueue = task;
    return task;
  }
  async load() {
    if (!process.env.EMBER_ACCOUNT_URL)
      try {
        this.url = accountEndpoint(
          JSON.parse(
            await readFile(
              path.join(this.root, "account-service.json"),
              "utf8",
            ),
          ).url,
        );
      } catch {}
    try {
      if (!this.protection?.available()) return;
      const saved = JSON.parse(
        this.protection.decrypt(await readFile(this.credentialFile())),
      );
      if (
        saved.url === this.url &&
        typeof saved.token === "string" &&
        /^[\w-]{20,256}$/.test(saved.token)
      ) {
        this.token = saved.token;
        this.remembered = true;
      }
    } catch {
      /* Missing or unreadable device credentials require a normal login. */
    }
  }
  async restore() {
    if (this.user || !this.token) return this.status();
    if (this.restoring) return this.restoring;
    const generation = this.generation;
    this.restoring = (async () => {
      const data = await this.request("me");
      if (generation !== this.generation)
        throw Error("Session changed. Log in to continue.");
      this.user = data.user;
      this.verifiedAt = Date.now();
      return this.status();
    })().finally(() => {
      this.restoring = undefined;
    });
    return this.restoring;
  }
  async configure(url: string) {
    const next = accountEndpoint(url);
    await this.logout();
    this.url = next;
    await writeFile(
      path.join(this.root, "account-service.json"),
      JSON.stringify({ url: next }),
    );
    return this.status();
  }
  status() {
    return {
      user: this.user || null,
      url: this.url,
      remembered: this.remembered,
    };
  }
  async request(route: string, body?: unknown) {
    const token = this.token;
    let response: Response;
    try {
      response = await fetch(this.url + "/api/" + route, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(
          this.url.startsWith("https:") ? 75000 : 10000,
        ),
      });
    } catch {
      throw Error(
        this.url.startsWith("https:")
          ? "The Ember account service did not respond. It may be waking up; wait a moment and try again. Check Account service connection if the problem continues."
          : "Cannot reach the local account service. For shared Ember accounts, open Account service connection and save https://ember-accounts.onrender.com.",
      );
    }
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw Error("The account service returned an invalid response.");
    }
    if (!response.ok) {
      if (response.status === 401 && this.token === token) {
        this.token = "";
        this.user = undefined;
        this.verifiedAt = 0;
        await this.forget();
      }
      throw Error(String(data.error || "Account request failed."));
    }
    return data;
  }
  async login(payload: unknown) {
    const remember = (payload as any)?.remember === true;
    if (remember && !this.protection?.available())
      throw Error(
        "Secure device storage is unavailable. Uncheck Remember this device to sign in.",
      );
    const generation = ++this.generation;
    this.token = "";
    this.user = undefined;
    await this.forget();
    const data = await this.request("login", payload);
    if (this.generation !== generation) throw Error("Login was canceled.");
    this.token = data.token;
    this.user = data.user;
    this.verifiedAt = Date.now();
    if (remember) {
      const encrypted = this.protection!.encrypt(
        JSON.stringify({ url: this.url, token: this.token }),
      );
      const task = this.credentialQueue
        .catch(() => {})
        .then(async () => {
          if (generation !== this.generation) return;
          await mkdir(this.root, { recursive: true });
          await writeFile(this.credentialFile(), encrypted, { mode: 0o600 });
          this.remembered = true;
        });
      this.credentialQueue = task;
      await task;
    }
    return this.status();
  }
  async logout() {
    ++this.generation;
    const task = this.token
      ? this.request("logout", {}).catch(() => {})
      : Promise.resolve();
    this.token = "";
    this.user = undefined;
    this.verifiedAt = 0;
    await this.forget();
    await task;
    return this.status();
  }
  async require(force = false) {
    if (!this.token || !this.user) throw Error("Log in to Ember to continue.");
    if (force || Date.now() - this.verifiedAt > 30000) {
      const generation = this.generation;
      try {
        const data = await this.request("me");
        if (generation !== this.generation)
          throw Error("Session changed. Log in to continue.");
        this.user = data.user;
        this.verifiedAt = Date.now();
      } catch (e) {
        if (generation === this.generation) {
          this.user = undefined;
          this.verifiedAt = 0;
        }
        throw e;
      }
    }
    return this.user!;
  }
  async updates(before?: number) {
    await this.require(true);
    return this.request(
      "updates" + (before ? "?before=" + encodeURIComponent(before) : ""),
    );
  }
  async publish(payload: unknown) {
    await this.require(true);
    return this.request("updates", payload);
  }
}
