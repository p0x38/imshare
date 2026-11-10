import { describe, expect, it } from "vitest";
import { resolveCrawlerPolicy } from "../src/lib/crawler-policy.js";

const user = {
    allowSearchEngineIndex: true,
    allowAiCrawler: false,
    allowImageCrawler: true,
    allowCustomCrawler: false,
};

describe("resolveCrawlerPolicy", () => {
    it("inherits the owner's settings", () => {
        expect(resolveCrawlerPolicy(user)).toEqual({
            search: true,
            ai: false,
            image: true,
            custom: false,
        });
    });

    it("allows individual overrides", () => {
        expect(
            resolveCrawlerPolicy(user, {
                allowSearchEngineIndex: false,
                allowAiCrawler: true,
                allowImageCrawler: null,
                allowCustomCrawler: null,
            }),
        ).toEqual({
            search: false,
            ai: true,
            image: true,
            custom: false,
        });
    });

    it("supports explicitly denying everything", () => {
        expect(
            resolveCrawlerPolicy(user, {
                allowSearchEngineIndex: false,
                allowAiCrawler: false,
                allowImageCrawler: false,
                allowCustomCrawler: false,
            }),
        ).toEqual({
            search: false,
            ai: false,
            image: false,
            custom: false,
        });
    });

    it("supports explicitly allowing everything", () => {
        expect(
            resolveCrawlerPolicy(user, {
                allowSearchEngineIndex: true,
                allowAiCrawler: true,
                allowImageCrawler: true,
                allowCustomCrawler: true,
            }),
        ).toEqual({
            search: true,
            ai: true,
            image: true,
            custom: true,
        });
    });
});
