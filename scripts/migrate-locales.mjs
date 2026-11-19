import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdout } from "node:process";

const localeDirectory = path.resolve("src/client/locales");
const languages = ["en", "ja"];

// Keep existing top-level translation groups intact. This migration only
// assigns those groups to namespaces; it does not rename or rewrite keys.
const namespaceGroups = {
    common: ["common", "states", "posts", "search"],
    navigation: ["nav", "footer"],
    settings: [
        "settings",
        "language",
        "english",
        "japanese",
        "appearance",
        "light",
        "dark",
        "automaticDevice",
        "interfaceAnimations",
        "buttonRipple",
        "accentColor",
        "default",
        "blue",
        "purple",
        "green",
        "orange",
        "settingsSaved",
    ],
    privacy: ["privacyConsent"],
    developer: [
        "developer",
        "developerDescription",
        "seasonalEventOverride",
        "seasonalEventOverrideHelp",
        "seasonalEventAutomatic",
        "seasonalEventNone",
        "seasonalEventGodzillaDay",
        "seasonalEventAprilFools",
        "seasonalEventCustomization",
        "seasonalEventCustomizationHelp",
        "seasonalEventEnabled",
        "seasonalEventName",
        "seasonalEventPriority",
        "seasonalEventPriorityHelp",
        "seasonalEventDateRanges",
        "seasonalEventDateRangesHelp",
        "seasonalEventStart",
        "seasonalEventEnd",
        "seasonalEventAddRange",
        "seasonalEventRemoveRange",
        "seasonalEventNoRanges",
        "seasonalEventReset",
        "seasonalEventResetAll",
        "seasonalEventInvalidDate",
        "seasonalEventStorageError",
    ],
    home: ["home", "recentPosts"],
    posts: ["postsPage", "postGrid", "recommendations", "taxonomy", "postUi"],
    dashboard: ["dashboard", "dashboardPage", "dashboardPosts", "dashboardPost"],
    account: ["accountProfile", "accountPage", "accountPreferences", "accountUi"],
    editor: ["postEditor"],
    admin: ["admin", "adminUsers"],
    faq: ["faq"],
    badges: ["badges"],
};

function getShape(value) {
    if (Array.isArray(value)) return value.map(getShape);

    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, getShape(value[key])]),
        );
    }

    return typeof value;
}

function validateNamespaceMapping(source) {
    const assignedKeys = Object.values(namespaceGroups).flat();
    const duplicateKeys = assignedKeys.filter((key, index) => assignedKeys.indexOf(key) !== index);
    const unknownKeys = assignedKeys.filter((key) => !Object.hasOwn(source, key));
    const unmappedKeys = Object.keys(source).filter((key) => !assignedKeys.includes(key));

    if (duplicateKeys.length || unknownKeys.length || unmappedKeys.length) {
        throw new Error(
            [
                duplicateKeys.length ? `Duplicate assignments: ${duplicateKeys.join(", ")}` : "",
                unknownKeys.length ? `Unknown source keys: ${unknownKeys.join(", ")}` : "",
                unmappedKeys.length ? `Unmapped source keys: ${unmappedKeys.join(", ")}` : "",
            ]
                .filter(Boolean)
                .join("\n"),
        );
    }
}

const resources = {};

for (const language of languages) {
    const sourcePath = path.join(localeDirectory, `${language}.json`);
    const source = JSON.parse(await readFile(sourcePath, "utf8"));

    validateNamespaceMapping(source);
    resources[language] = source;
}

if (JSON.stringify(getShape(resources.en)) !== JSON.stringify(getShape(resources.ja))) {
    throw new Error("English and Japanese locale structures do not match; no files were changed.");
}

const outputs = [];

for (const language of languages) {
    for (const [namespace, keys] of Object.entries(namespaceGroups)) {
        const destinationDirectory = path.join(localeDirectory, language);
        const destinationPath = path.join(destinationDirectory, `${namespace}.json`);

        await mkdir(destinationDirectory, { recursive: true });

        const content = Object.fromEntries(keys.map((key) => [key, resources[language][key]]));
        outputs.push({
            path: destinationPath,
            content: `${JSON.stringify(content, null, 4)}\n`,
        });
    }
}

// Refuse to overwrite existing namespace files. The old flat files remain
// untouched until every new namespace file has been written successfully.
for (const output of outputs) {
    try {
        await readFile(output.path);
        throw new Error(`Destination already exists: ${output.path}`);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

const createdFiles = [];

try {
    for (const output of outputs) {
        await writeFile(output.path, output.content, { encoding: "utf8", flag: "wx" });
        createdFiles.push(output.path);
    }
} catch (error) {
    await Promise.all(createdFiles.map((file) => rm(file, { force: true })));
    throw error;
}

stdout.write(
    `Created ${Object.keys(namespaceGroups).length} namespaces for ${languages.length} locales.\n` +
        "The original flat locale files were preserved for the i18n code migration.\n",
);
