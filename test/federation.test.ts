import { generateKeyPairSync } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import {
    assertFederationActivityActor,
    deliverActivity,
    sha256Base64,
    signFederationRequest,
    verifyFederationRequest,
} from "../src/lib/federation.js";

afterEach(() => {
    vi.restoreAllMocks();
});

function createKeyPair() {
    return generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
}

test("sha256Base64 returns the SHA-256 digest used by federation signatures", () => {
    expect(sha256Base64("hello")).toBe("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
});

test("signFederationRequest signs GET metadata requests", () => {
    const pair = createKeyPair();
    const headers = signFederationRequest(
        "GET",
        "https://remote.example/federation/inbox?limit=1",
        undefined,
        "https://local.example/federation/actors/p0x38#main-key",
        pair.privateKey,
    );

    expect(headers.get("accept")).toContain("application/activity+json");
    expect(headers.get("date")).toBeTruthy();
    expect(headers.get("digest")).toBeNull();
    expect(headers.get("signature")).toContain('algorithm="hs2019"');
    expect(headers.get("signature")).toContain('headers="(request-target) host date"');
});

test("signFederationRequest signs request bodies with a digest and content type", () => {
    const pair = createKeyPair();
    const body = JSON.stringify({ type: "Create", id: "activity-1" });
    const headers = signFederationRequest(
        "POST",
        "https://remote.example/federation/inbox",
        body,
        "https://local.example/federation/actors/p0x38#main-key",
        pair.privateKey,
    );

    expect(headers.get("content-type")).toBe("application/activity+json");
    expect(headers.get("digest")).toBe("SHA-256=" + sha256Base64(body));
    expect(headers.get("signature")).toContain(
        'headers="(request-target) host date digest content-type"',
    );
});

test("verifyFederationRequest accepts a valid signed request and matching actor key", async () => {
    const pair = createKeyPair();
    const actorUrl = "https://remote.example/users/alice";
    const inboxUrl = "https://local.example/federation/actors/p0x38/inbox";
    const body = JSON.stringify({ type: "Follow", actor: actorUrl });

    const headers = signFederationRequest(
        "POST",
        inboxUrl,
        body,
        actorUrl + "#main-key",
        pair.privateKey,
    );
    const actor = {
        id: actorUrl,
        inbox: actorUrl + "/inbox",
        publicKey: {
            id: actorUrl + "#main-key",
            owner: actorUrl,
            publicKeyPem: pair.publicKey,
        },
    };

    await expect(
        verifyFederationRequest(
            new Request(inboxUrl, { method: "POST", headers, body }),
            body,
            async () => actor,
        ),
    ).resolves.toEqual({
        actor,
        keyId: actorUrl + "#main-key",
    });
});

test("verifyFederationRequest rejects a body whose digest does not match", async () => {
    const pair = createKeyPair();
    const body = JSON.stringify({ type: "Follow" });
    const headers = signFederationRequest(
        "POST",
        "https://local.example/federation/actors/p0x38/inbox",
        body,
        "https://remote.example/users/alice#main-key",
        pair.privateKey,
    );

    const tamperedBody = JSON.stringify({ type: "Tampered" });
    await expect(
        verifyFederationRequest(
            new Request("https://local.example/federation/actors/p0x38/inbox", {
                method: "POST",
                headers,
                body: tamperedBody,
            }),
            tamperedBody,
        ),
    ).rejects.toThrow("Federation content digest does not match the request body.");
});

test("verifyFederationRequest rejects signatures with an unsupported algorithm", async () => {
    const pair = createKeyPair();
    const body = JSON.stringify({ type: "Follow" });
    const headers = signFederationRequest(
        "POST",
        "https://local.example/federation/actors/p0x38/inbox",
        body,
        "https://remote.example/users/alice#main-key",
        pair.privateKey,
    );
    const signature = headers.get("signature")!.replace(
        'algorithm="hs2019"',
        'algorithm="rsa-sha1"',
    );
    headers.set("signature", signature);

    await expect(
        verifyFederationRequest(
            new Request("https://local.example/federation/actors/p0x38/inbox", {
                method: "POST",
                headers,
                body,
            }),
            body,
        ),
    ).rejects.toThrow("Invalid federation signature.");
});

test("assertFederationActivityActor requires the activity actor to match the verified signer", () => {
    const actor = "https://remote.example/users/alice";
    expect(() => assertFederationActivityActor({ actor }, actor)).not.toThrow();
    expect(() =>
        assertFederationActivityActor({ actor }, "https://remote.example/users/bob"),
    ).toThrow("Federation activity actor does not match the verified signer.");
    expect(() => assertFederationActivityActor({ actor: { id: actor } }, actor)).toThrow(
        "Federation activity actor does not match the verified signer.",
    );
});

test.each([
    "http://127.0.0.1/inbox",
    "http://[::1]/inbox",
    "http://169.254.169.254/",
    "http://localhost/inbox",
])("deliverActivity rejects private federation destinations (%s)", async (inbox) => {
    const pair = createKeyPair();
    await expect(
        deliverActivity({
            inbox,
            actorUrl: "https://local.example/federation/actors/alice",
            activity: { type: "Create" },
            privateKeyPem: pair.privateKey,
        }),
    ).rejects.toThrow("Federation URL must resolve only to public IP addresses.");
});
