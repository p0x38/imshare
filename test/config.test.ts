import { expect, test } from "vitest";
import { validateConfigText } from "../src/lib/config.js";

const requiredConfig = `
server {
    host = "127.0.0.1"
    port = 5454
}

storage {
    uploadDirectory = "uploads"
    maxFileSize = 25MiB
}

site {
    name = "imshare-test"
    version = "1.0.0"
}

auth {
    baseUrl = "https://example.com"
}
`;

test("validateConfigText applies storage and cache defaults", () => {
    const config = validateConfigText(requiredConfig);

    expect(config.storage.dataDirectory).toBe("data");
    expect(config.storage.cache).toEqual({
        ttl: 30 * 86_400_000,
        useHashedDirectory: true,
    });
});

test("validateConfigText accepts explicit cache settings", () => {
    const config = validateConfigText(`
server {
    host = "127.0.0.1"
    port = 5454
}

storage {
    dataDirectory = "contents"
    uploadDirectory = "contents/uploads"
    maxFileSize = 25MiB
    cache {
        ttl = 7d
        useHashedDirectory = false
    }
}

site {
    name = "imshare-test"
    version = "1.0.0"
}

auth {
    baseUrl = "https://example.com"
}
`);

    expect(config.storage.dataDirectory).toBe("contents");
    expect(config.storage.cache).toEqual({
        ttl: 7 * 86_400_000,
        useHashedDirectory: false,
    });
});

test("validateConfigText rejects invalid cache TTL", () => {
    expect(() =>
        validateConfigText(`
server {
    host = "127.0.0.1"
    port = 5454
}

storage {
    uploadDirectory = "uploads"
    maxFileSize = 25MiB
    cache {
        ttl = 0
    }
}

site {
    name = "imshare-test"
    version = "1.0.0"
}

auth {
    baseUrl = "https://example.com"
}
`),
    ).toThrow(/Invalid server configuration/);
});

test("validateConfigText applies federation and p2p defaults", () => {
    const config = validateConfigText(requiredConfig);

    expect(config.federation).toEqual({
        enabled: true,
        incomingEnabled: true,
        outgoingEnabled: true,
        publicDiscovery: true,
        sharedInboxEnabled: true,
        deliveryTimeoutMs: 10_000,
        remoteFetchTimeoutMs: 10_000,
    });
    expect(config.p2p).toEqual({
        enabled: false,
        incomingEnabled: false,
        outgoingEnabled: false,
        discovery: "manual",
        iceServers: [],
    });
});

test("validateConfigText accepts explicit federation and p2p settings", () => {
    const config = validateConfigText(`
${requiredConfig}
federation {
    enabled = false
    incomingEnabled = false
    outgoingEnabled = true
    publicDiscovery = false
    sharedInboxEnabled = false
    deliveryTimeoutMs = 2500
    remoteFetchTimeoutMs = 3500
}

p2p {
    enabled = true
    incomingEnabled = true
    outgoingEnabled = true
    discovery = "signaling"
    signalingUrl = "https://signal.example/ws"
    iceServers = ["stun:stun.example:3478"]
}
`);

    expect(config.federation).toMatchObject({
        enabled: false,
        incomingEnabled: false,
        outgoingEnabled: true,
        publicDiscovery: false,
        sharedInboxEnabled: false,
        deliveryTimeoutMs: 2500,
        remoteFetchTimeoutMs: 3500,
    });
    expect(config.p2p).toMatchObject({
        enabled: true,
        incomingEnabled: true,
        outgoingEnabled: true,
        discovery: "signaling",
        signalingUrl: "https://signal.example/ws",
        iceServers: ["stun:stun.example:3478"],
    });
});

test("validateConfigText rejects invalid federation timeout values", () => {
    expect(() =>
        validateConfigText(`
${requiredConfig}
federation {
    deliveryTimeoutMs = 0
}
`),
    ).toThrow(/Invalid server configuration/);
});

test("validateConfigText rejects an invalid p2p discovery mode", () => {
    expect(() =>
        validateConfigText(`
${requiredConfig}
p2p {
    discovery = "broadcast"
}
`),
    ).toThrow(/Invalid server configuration/);
});
