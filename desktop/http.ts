import https from "node:https";
import { lookup } from "node:dns";
import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
export function publicAddress(address: string) {
  if (address.includes(":"))
    return (
      !/^(::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(address) &&
      !address.toLowerCase().includes("ffff:")
    );
  const a = address.split(".").map(Number);
  return (
    a.length === 4 &&
    a.every((x) => x >= 0 && x <= 255) &&
    ![0, 10, 127].includes(a[0]) &&
    a[0] < 224 &&
    !(a[0] === 169 && a[1] === 254) &&
    !(a[0] === 172 && a[1] >= 16 && a[1] <= 31) &&
    !(a[0] === 192 && a[1] === 168) &&
    !(a[0] === 100 && a[1] >= 64 && a[1] <= 127) &&
    !(a[0] === 198 && (a[1] === 18 || a[1] === 19))
  );
}
export function httpsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 3000)
    throw Error("HTTPS URL required.");
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    u.hostname === "localhost"
  )
    throw Error("Use a public HTTPS URL without credentials or fragment.");
  return u;
}
export type HttpClient = (
  url: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) => Promise<IncomingMessage>;
export const requestHttps: HttpClient = async (url, headers = {}, signal) => {
  async function open(
    value: string,
    remaining: number,
  ): Promise<IncomingMessage> {
    const u = httpsUrl(value);
    const literal = u.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !publicAddress(literal))
      throw Error("Private/local network destinations are not allowed.");
    return new Promise((resolve, reject) => {
      const request = https.get(
        u,
        {
          headers: { "User-Agent": "Ember/1.0", ...headers },
          signal,
          lookup: ((hostname: any, options: any, cb: any) => {
            lookup(hostname, { all: true }, (error, addresses) => {
              if (error) return cb(error);
              const valid = addresses.filter((a) => publicAddress(a.address));
              if (valid.length !== addresses.length || !valid.length)
                return cb(
                  Error("Private/local network destinations are not allowed."),
                );
              if (options?.all) cb(null, valid);
              else cb(null, valid[0].address, valid[0].family);
            });
          }) as any,
        },
        (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
            response.resume();
            if (!remaining || !response.headers.location)
              return reject(Error("Invalid redirect."));
            void open(
              new URL(response.headers.location, u).href,
              remaining - 1,
            ).then(resolve, reject);
          } else resolve(response);
        },
      );
      request.setTimeout(30000, () =>
        request.destroy(Error("Connection timed out.")),
      );
      request.on("error", reject);
    });
  }
  return open(url, 5);
};
export async function jsonHttps(
  url: string,
  client: HttpClient = requestHttps,
  maxBytes = 8 * 1024 * 1024,
) {
  const response = await client(url, {'Accept':'application/json','Accept-Encoding':'identity'}, AbortSignal.timeout(30000));
  if (response.statusCode !== 200) {
    response.resume();
    throw Error("Provider returned HTTP " + response.statusCode + (response.statusCode===403 ? '. Access/challenge page blocked automatic refresh; import a downloaded catalog JSON file.' : ''));
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > maxBytes) {
      response.destroy();
      throw Error("JSON response exceeds size limit.");
    }
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/,'');
  if(/^\s*</.test(text)) throw Error('Provider returned an HTML page instead of a JSON catalog.');
  try {return JSON.parse(text);} catch {throw Error('Provider returned invalid JSON.');}
}
