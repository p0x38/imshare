import { createHash, createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import path from "node:path";
import { loadConfigSync } from "./config.js";
import ipaddr from "ipaddr.js";

const DATA_DIR = path.resolve(process.cwd(), "data", "federation");
const KEYS_FILE = path.join(DATA_DIR, "keys.json");
const FOLLOWERS_FILE = path.join(DATA_DIR, "followers.json");
const INBOX_DIR = path.join(DATA_DIR, "inbox");
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

function federationTimeoutMs(): number {
    return loadConfigSync().federation?.remoteFetchTimeoutMs ?? 10_000;
}

function deliveryTimeoutMs(): number {
    return loadConfigSync().federation?.deliveryTimeoutMs ?? 10_000;
}

interface ActorKey {
    actorUrl: string;
    publicKeyPem: string;
    privateKeyPem: string;
}

type KeyStore = Record<string, ActorKey>;

export interface FederationFollower {
    actorId: string;
    inbox: string;
    sharedInbox?: string;
}

type FollowerStore = Record<string, FederationFollower[]>;

interface SignatureFields {
    keyId: string;
    algorithm: string;
    headers: string[];
    signature: string;
}

interface RemoteActor {
    id?: string;
    inbox?: string;
    endpoints?: { sharedInbox?: string };
    publicKey?: {
        id?: string;
        owner?: string;
        publicKeyPem?: string;
    };
}

interface FederationHttpResponse {
    status: number;
    ok: boolean;
    body: Buffer;
}

const cache = new Map<string, ActorKey>();

function isPublicIp(address: string): boolean {
    if (isIP(address) === 0) return false;

    const parsed = ipaddr.parse(address);

    return parsed.range() === "unicast";
}

async function requestFederationUrl(
    rawUrl: string,
    options: {
        method: string;
        headers?: HeadersInit;
        body?: string;
        timeoutMs: number;
    },
): Promise<FederationHttpResponse> {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("Federation URL is invalid.");
    }
    if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        !url.hostname
    )
        throw new Error("Federation URL must be an HTTP(S) URL without credentials.");
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
        throw new Error("Remote federation requires HTTPS.");

    const signal = AbortSignal.timeout(options.timeoutMs);
    signal.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const literalFamily = isIP(hostname);
    const addresses: LookupAddress[] = literalFamily
        ? [{ address: hostname, family: literalFamily }]
        : await new Promise<LookupAddress[]>((resolve, reject) => {
              const onAbort = () => reject(signal.reason);
              signal.addEventListener("abort", onAbort, { once: true });
              dnsLookup(hostname, { all: true, verbatim: true }).then(
                  (resolved) => {
                      signal.removeEventListener("abort", onAbort);
                      resolve(resolved);
                  },
                  (error: unknown) => {
                      signal.removeEventListener("abort", onAbort);
                      reject(error);
                  },
              );
          });
    signal.throwIfAborted();
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address)))
        throw new Error("Federation URL must resolve only to public IP addresses.");

    const transport = url.protocol === "https:" ? https : http;
    const headers = Object.fromEntries(new Headers(options.headers).entries());
    const requestOptions: http.RequestOptions = {
        method: options.method,
        headers,
        lookup: ((_hostname, lookupOptions, callback) => {
            const candidates =
                lookupOptions.family === 4 || lookupOptions.family === 6
                    ? addresses.filter(({ family }) => family === lookupOptions.family)
                    : addresses;
            const available = candidates.length > 0 ? candidates : addresses;
            if (lookupOptions.all) {
                callback(null, available);
                return;
            }
            const selected = available[0]!;
            callback(null, selected.address, selected.family);
        }) satisfies LookupFunction,
    };

    return new Promise((resolve, reject) => {
        const request = transport.request(url, requestOptions, (response) => {
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer | string) => {
                const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                size += data.length;
                if (size > 1_048_576) {
                    request.destroy(new Error("Federation response exceeds the size limit."));
                    return;
                }
                chunks.push(data);
            });
            response.on("end", () => {
                signal.removeEventListener("abort", onAbort);
                resolve({
                    status: response.statusCode ?? 502,
                    ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
                    body: Buffer.concat(chunks),
                });
            });
            response.on("error", reject);
        });
        const onAbort = () => request.destroy(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
        request.on("close", () => signal.removeEventListener("abort", onAbort));
        request.on("error", reject);
        request.end(options.body);
    });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
        return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {
        return fallback;
    }
}

async function writeJson(file: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, file);
}

export async function getOrCreateActorKey(actorId: string, actorUrl: string): Promise<ActorKey> {
    const cached = cache.get(actorId);
    if (cached && cached.actorUrl === actorUrl) return cached;

    const store = await readJson<KeyStore>(KEYS_FILE, {});
    const existing = store[actorId];
    if (
        existing &&
        existing.actorUrl === actorUrl &&
        existing.privateKeyPem &&
        existing.publicKeyPem
    ) {
        cache.set(actorId, existing);
        return existing;
    }

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const key: ActorKey = {
        actorUrl,
        publicKeyPem: pair.publicKey,
        privateKeyPem: pair.privateKey,
    };
    store[actorId] = key;
    await writeJson(KEYS_FILE, store);
    cache.set(actorId, key);
    return key;
}

export function sha256Base64(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("base64");
}

function parseSignatureHeader(value: string): SignatureFields | null {
    const fields = new Map<string, string>();
    for (const match of value.matchAll(/([a-zA-Z][a-zA-Z0-9_-]*)="([^"]*)"/g))
        fields.set(match[1]!.toLowerCase(), match[2]!);
    const keyId = fields.get("keyid");
    const algorithm = fields.get("algorithm");
    const signature = fields.get("signature");
    const headers = fields.get("headers");
    if (!keyId || !algorithm || !signature || !headers) return null;
    const parsedHeaders = headers
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((header) => header.toLowerCase());
    if (!parsedHeaders.includes("(request-target)") || !parsedHeaders.includes("host")) return null;
    return { keyId, algorithm, headers: parsedHeaders, signature };
}

function headerValue(headers: Headers, name: string): string | null {
    return headers.get(name);
}

function signingString(request: Request, fields: SignatureFields): string | null {
    const url = new URL(request.url);
    const values: string[] = [];
    for (const name of fields.headers) {
        if (name === "(request-target)") {
            values.push(
                `(request-target): ${request.method.toLowerCase()} ${url.pathname}${url.search}`,
            );
            continue;
        }
        const value = headerValue(request.headers, name);
        if (value === null) return null;
        values.push(`${name}: ${value}`);
    }
    return values.join("\n");
}

export function signFederationRequest(
    method: string,
    url: string,
    body: string | undefined,
    keyId: string,
    privateKeyPem: string,
): Headers {
    const target = new URL(url);
    const headers = new Headers({
        accept: "application/activity+json, application/ld+json",
        host: target.host,
        date: new Date().toUTCString(),
    });
    if (body !== undefined) {
        headers.set("content-type", "application/activity+json");
        headers.set("digest", `SHA-256=${sha256Base64(body)}`);
    }

    const signedHeaders =
        body === undefined
            ? ["(request-target)", "host", "date"]
            : ["(request-target)", "host", "date", "digest", "content-type"];
    const request = new Request(url, { method, headers, body });
    const fields: SignatureFields = {
        keyId,
        algorithm: "hs2019",
        headers: signedHeaders,
        signature: "",
    };
    const canonical = signingString(request, fields);
    if (!canonical) throw new Error("Unable to construct federation signature.");

    const signer = createSign("sha256");
    signer.update(canonical, "utf8");
    fields.signature = signer.sign(privateKeyPem, "base64");
    headers.set(
        "signature",
        `keyId="${keyId}",algorithm="hs2019",headers="${signedHeaders.join(" ")}",signature="${fields.signature}",`,
    );
    return headers;
}

function actorUrlFromKeyId(keyId: string): string | null {
    try {
        const url = new URL(keyId);
        url.hash = "";
        return url.toString();
    } catch {
        return null;
    }
}

async function fetchRemoteActor(actorUrl: string): Promise<RemoteActor> {
    const response = await requestFederationUrl(actorUrl, {
        method: "GET",
        headers: { accept: "application/activity+json, application/ld+json" },
        timeoutMs: federationTimeoutMs(),
    });
    if (!response.ok) throw new Error(`Remote actor returned HTTP ${response.status}.`);
    let actor: RemoteActor;
    try {
        actor = JSON.parse(response.body.toString("utf8")) as RemoteActor;
    } catch {
        throw new Error("Remote actor returned invalid JSON.");
    }
    if (
        typeof actor.id !== "string" ||
        actor.id !== actorUrl ||
        typeof actor.publicKey?.publicKeyPem !== "string"
    )
        throw new Error("Remote actor has no usable public key.");
    return actor;
}

export function assertFederationActivityActor(
    activity: Record<string, unknown>,
    verifiedActorId: string,
): asserts activity is Record<string, unknown> & { actor: string } {
    if (typeof activity.actor !== "string" || activity.actor !== verifiedActorId)
        throw new Error("Federation activity actor does not match the verified signer.");
}

export async function verifyFederationRequest(
    request: Request,
    body: string,
    loadActor: (actorUrl: string) => Promise<RemoteActor> = fetchRemoteActor,
): Promise<{ actor: RemoteActor; keyId: string }> {
    const signatureHeader = request.headers.get("signature");
    if (!signatureHeader) throw new Error("Federation signature is required.");
    const fields = parseSignatureHeader(signatureHeader);
    if (!fields || !["hs2019", "rsa-sha256"].includes(fields.algorithm.toLowerCase()))
        throw new Error("Invalid federation signature.");

    const date = request.headers.get("date");
    const timestamp = date ? Date.parse(date) : Number.NaN;
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS)
        throw new Error("Federation signature timestamp is outside the allowed window.");

    const expectedDigest = `SHA-256=${sha256Base64(body)}`;
    if (request.headers.get("digest") !== expectedDigest)
        throw new Error("Federation content digest does not match the request body.");

    const actorUrl = actorUrlFromKeyId(fields.keyId);
    if (!actorUrl) throw new Error("Federation key ID is invalid.");
    const actor = await loadActor(actorUrl);
    const keyId = actor.publicKey?.id;
    const owner = actor.publicKey?.owner;
    const publicKeyPem = actor.publicKey?.publicKeyPem;
    if (keyId !== fields.keyId || owner !== actorUrl || !publicKeyPem)
        throw new Error("Federation actor key metadata does not match the signature.");

    const canonical = signingString(request, fields);
    if (!canonical) throw new Error("Federation signature references an unavailable header.");
    const verifier = createVerify("sha256");
    verifier.update(canonical, "utf8");
    if (!verifier.verify(publicKeyPem, fields.signature, "base64"))
        throw new Error("Federation signature verification failed.");
    return { actor, keyId: fields.keyId };
}

export async function getFollowers(userId: string): Promise<FederationFollower[]> {
    const store = await readJson<FollowerStore>(FOLLOWERS_FILE, {});
    return store[userId] ?? [];
}

export async function addFollower(userId: string, follower: FederationFollower): Promise<void> {
    const store = await readJson<FollowerStore>(FOLLOWERS_FILE, {});
    const current = store[userId] ?? [];
    store[userId] = [...current.filter((value) => value.actorId !== follower.actorId), follower];
    await writeJson(FOLLOWERS_FILE, store);
}

export async function removeFollower(userId: string, actorId: string): Promise<void> {
    const store = await readJson<FollowerStore>(FOLLOWERS_FILE, {});
    store[userId] = (store[userId] ?? []).filter((value) => value.actorId !== actorId);
    await writeJson(FOLLOWERS_FILE, store);
}

export async function storeIncomingActivity(activity: unknown): Promise<string> {
    const serialized = JSON.stringify(activity);
    const id =
        typeof activity === "object" &&
        activity !== null &&
        "id" in activity &&
        typeof activity.id === "string"
            ? activity.id
            : `${Date.now()}-${Math.random()}`;
    const digest = createHash("sha256").update(id, "utf8").digest("hex");
    const file = path.join(INBOX_DIR, `${digest}.json`);
    await writeJson(file, JSON.parse(serialized));
    return file;
}

export async function deliverActivity(options: {
    inbox: string;
    actorUrl: string;
    activity: unknown;
    privateKeyPem: string;
}): Promise<{ ok: boolean; status: number }> {
    const body = JSON.stringify(options.activity);
    const keyId = `${options.actorUrl}#main-key`;
    const headers = signFederationRequest(
        "POST",
        options.inbox,
        body,
        keyId,
        options.privateKeyPem,
    );
    const response = await requestFederationUrl(options.inbox, {
        method: "POST",
        headers,
        body,
        timeoutMs: deliveryTimeoutMs(),
    });
    return { ok: response.ok, status: response.status };
}
