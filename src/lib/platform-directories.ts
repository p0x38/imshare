import os from "node:os";
import path from "node:path";

const APPLICATION_NAME = path.join("p0x38", "imshare");

export interface PlatformDirectories {
    data: string;
    cache: string;
    config: string;
}

export function getPlatformDirectories(): PlatformDirectories {
    const homeDirectory = os.homedir();

    switch (process.platform) {
        case "win32": {
            const localAppData =
                process.env.LOCALAPPDATA ?? path.join(homeDirectory, "AppData", "Local");

            const roamingAppData =
                process.env.APPDATA ?? path.join(homeDirectory, "AppData", "Roaming");

            return {
                data: path.join(localAppData, APPLICATION_NAME),
                cache: path.join(localAppData, APPLICATION_NAME, "Cache"),
                config: path.join(roamingAppData, APPLICATION_NAME),
            };
        }

        case "darwin": {
            const applicationSupport = path.join(
                homeDirectory,
                "Library",
                "Application Support",
                "ImShare",
            );

            return {
                data: applicationSupport,
                cache: path.join(homeDirectory, "Library", "Caches", "ImShare"),
                config: applicationSupport,
            };
        }

        default: {
            const dataHome =
                process.env.XDG_DATA_HOME ?? path.join(homeDirectory, ".local", "share");

            const cacheHome = process.env.XDG_CACHE_HOME ?? path.join(homeDirectory, ".cache");

            const configHome = process.env.XDG_CONFIG_HOME ?? path.join(homeDirectory, ".config");

            return {
                data: path.join(dataHome, APPLICATION_NAME),
                cache: path.join(cacheHome, APPLICATION_NAME),
                config: path.join(configHome, APPLICATION_NAME),
            };
        }
    }
}
