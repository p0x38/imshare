import Database from "better-sqlite3";

const paths = ["./dev.db.backup", "./dev.db"];

for (const path of paths) {
    console.log(`\n=== ${path} ===`);

    const db = new Database(path, { readonly: true });

    const tables = db
        .prepare(
            `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name != '_prisma_migrations'
        ORDER BY name
      `,
        )
        .all() as { name: string }[];

    for (const { name } of tables) {
        const columns = db.prepare(`PRAGMA table_info("${name}")`).all() as {
            name: string;
            type: string;
            notnull: number;
            dflt_value: unknown;
            pk: number;
        }[];

        const count = db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as {
            count: number;
        };

        console.log(`\n${name}: ${count.count} rows`);
        console.log(columns.map((column) => column.name).join(", "));
    }

    db.close();
}
