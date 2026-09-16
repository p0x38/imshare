import Database from "better-sqlite3";

const db = new Database("./dev.db");

db.pragma("foreign_keys = OFF");

const tables = [
    "user",
    "account",
    "session",
    "verification",
    "category",
    "post",
    "tag",
    "post_tag",
    "upload",
    "comment",
    "post_reaction",
    "comment_reaction",
    "profile_link",
    "report",
    "emoji",
    "notification",
    "moderation_log",
];

const backup = db.prepare("ATTACH DATABASE ? AS backup");

backup.run("./dev.db.backup");

const transaction = db.transaction(() => {
    for (const table of tables) {
        if (table === "upload") {
            db.prepare(
                `
        INSERT INTO main."upload" (
          "id",
          "filename",
          "originalName",
          "mimeType",
          "size",
          "createdAt",
          "userId",
          "postId",
          "contentHash",
          "thumbhash",
          "width",
          "height"
        )
        SELECT
          "id",
          "filename",
          "originalName",
          "mimeType",
          "size",
          "createdAt",
          "userId",
          "postId",
          "contentHash",
          "thumbhash",
          NULL,
          NULL
        FROM backup."upload"
      `,
            ).run();

            continue;
        }

        const columns = db.prepare(`PRAGMA main.table_info("${table}")`).all() as {
            name: string;
        }[];

        const names = columns.map((column) => `"${column.name}"`).join(", ");

        db.prepare(
            `
      INSERT INTO main."${table}" (${names})
      SELECT ${names}
      FROM backup."${table}"
    `,
        ).run();
    }
});

transaction();

db.pragma("foreign_keys = ON");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();

if (foreignKeyErrors.length > 0) {
    console.error("Foreign key violations:");
    console.error(foreignKeyErrors);
    process.exitCode = 1;
} else {
    console.log("Data restored successfully.");
}

for (const table of tables) {
    const mainCount = db.prepare(`SELECT COUNT(*) AS count FROM main."${table}"`).get() as {
        count: number;
    };

    const backupCount = db.prepare(`SELECT COUNT(*) AS count FROM backup."${table}"`).get() as {
        count: number;
    };

    console.log(`${table}: ${mainCount.count} / ${backupCount.count}`);
}

db.close();
