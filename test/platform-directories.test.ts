import { expect, test } from "vitest";
import { getPlatformDirectories } from "../src/lib/platform-directories.js";

test("returns absolute platform directories", () => {
    const directories = getPlatformDirectories();

    expect(directories.data).toMatch(/imshare|ImShare/);
    expect(directories.cache).toMatch(/imshare|ImShare/);
    expect(directories.config).toMatch(/imshare|ImShare/);
});
