import { createHash, createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data", "federation");
const KEYS_FILE = path.join(DATA_DIR, "keys.json");
const FOLLOWERS_FILE = path.join(DATA_DIR, "followers.json");
const INBOX_DIR = path.join(DATA_DIR, "inbox");
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

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

const cache = new Map<string, ActorKey>();

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
    let parsed: URL;
    try {
        parsed = new URL(actorUrl);
    } catch {
        throw new Error("Remote actor URL is invalid.");
    }
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production")
        throw new Error("Remote federation requires HTTPS.");
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname))
        throw new Error("Remote actor must not resolve to a local host.");

    const response = await fetch(parsed, {
        headers: { accept: "application/activity+json, application/ld+json" },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Remote actor returned HTTP ${response.status}.`);
    const actor = (await response.json()) as RemoteActor;
    if (
        typeof actor.id !== "string" ||
        actor.id !== actorUrl ||
        typeof actor.publicKey?.publicKeyPem !== "string"
    )
        throw new Error("Remote actor has no usable public key.");
    return actor;
}

export async function verifyFederationRequest(
    request: Request,
    body: string,
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
    const actor = await fetchRemoteActor(actorUrl);
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
    const response = await fetch(options.inbox, {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status };
}
