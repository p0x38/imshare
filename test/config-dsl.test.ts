import { expect, test } from "vitest";
import { ConfigDslError, parseConfigDsl, stringifyConfigDsl } from "../src/lib/config-dsl.js";

test("configuration DSL parses nested objects, arrays, booleans, nulls, and units", () => {
    expect(
        parseConfigDsl(`
server {
    host = "127.0.0.1"
    port = 5454
    enabled = true
    disabled = false
    optional = null
    maxFileSize = 25MiB
    cacheTtl = 7d
    trustedProxies = ["127.0.0.1", "::1"]
}
`),
    ).toEqual({
        server: {
            host: "127.0.0.1",
            port: 5454,
            enabled: true,
            disabled: false,
            optional: null,
            maxFileSize: 25 * 1024 ** 2,
            cacheTtl: 7 * 86_400_000,
            trustedProxies: ["127.0.0.1", "::1"],
        },
    });
});

test("configuration DSL formatter round-trips nested configuration values", () => {
    const value = {
        site: { name: "imshare test", enabled: true, description: "Line one\nLine two" },
        storage: { maxFileSize: 25 * 1024 ** 2, folders: ["uploads", "avatars"], optional: null },
    };

    expect(parseConfigDsl(stringifyConfigDsl(value))).toEqual(value);
});

test("configuration DSL reports duplicate keys with source positions", () => {
    try {
        parseConfigDsl('site {\n    name = "first"\n    name = "second"\n}\n');
        throw new Error("Expected duplicate-key validation to fail.");
    } catch (error) {
        expect(error).toBeInstanceOf(ConfigDslError);
        expect(error).toMatchObject({ line: 3 });
    }
});

test("configuration DSL rejects unknown units and malformed strings", () => {
    expect(() => parseConfigDsl("storage {\n    maxFileSize = 10XB\n}\n")).toThrow(ConfigDslError);
    expect(() => parseConfigDsl('site {\n    name = "unterminated\n}\n')).toThrow(ConfigDslError);
});
