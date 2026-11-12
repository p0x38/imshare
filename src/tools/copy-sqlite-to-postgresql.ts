import "dotenv/config";

import Database from "better-sqlite3";
import { Client } from "pg";
import path from "node:path";

const TABLES = [
    "category",
    "tag",
    "user",
    "session",
    "account",
    "verification",
    "two_factor",
    "api_token",
    "push_subscription",
    "post",
    "post_revision",
    "post_view",
    "upload",
    "emoji",
    "post_reaction",
    "comment",
    "comment_reaction",
    "report",
    "notification",
    "profile_link",
    "post_tag",
    "follow",
    "moderation_log",
] as const;

type TableName = (typeof TABLES)[number];
type SqliteRow = Record<string, unknown>;

interface SqliteColumn {
    name: string;
}

interface PgColumn {
    column_name: string;
    data_type: string;
}

function quoteIdentifier(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
}

function getSqliteCount(database: Database.Database, table: TableName): number {
    const result = database
        .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
        .get() as { count: number };

    return result.count;
}

async function getPostgresCount(client: Client, table: TableName): Promise<number> {
    const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.${quoteIdentifier(table)}`,
    );

    return Number(result.rows[0]?.count ?? 0);
}

function convertValue(value: unknown, dataType: string, table: string, column: string): unknown {
    if (value === null || value === undefined) {
        return null;
    }

    if (dataType !== "boolean") {
        return value;
    }

    if (value === true || value === 1 || value === "1") {
        return true;
    }

    if (value === false || value === 0 || value === "0") {
        return false;
    }

    throw new Error(
        `Cannot convert ${table}.${column} value to PostgreSQL boolean: ${String(value)}`,
    );
}

async function main(): Promise<void> {
    const apply = process.argv.includes("--apply");
    const sqlitePath = path.resolve(process.env.SQLITE_DATABASE_PATH ?? "dev.db");
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL must point to PostgreSQL.");
    }

    const targetUrl = new URL(databaseUrl);

    if (!["postgresql:", "postgres:"].includes(targetUrl.protocol)) {
        throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
    }

    // The `schema` parameter is Prisma-specific.
    targetUrl.searchParams.delete("schema");

    const sqlite = new Database(sqlitePath, {
        readonly: true,
        fileMustExist: true,
    });

    const postgres = new Client({
        connectionString: targetUrl.toString(),
    });

    let connected = false;

    try {
        await postgres.connect();
        connected = true;

        console.log(`SQLite source: ${sqlitePath}`);
        console.log(
            `PostgreSQL target: ${targetUrl.hostname}:${targetUrl.port || "5432"}${targetUrl.pathname}`,
        );

        // Validate the source tables.
        const sourceTables = new Set(
            (
                sqlite
                    .prepare(
                        `SELECT name FROM sqlite_master
                         WHERE type = 'table'
                         AND name NOT LIKE 'sqlite_%'`,
                    )
                    .all() as Array<{ name: string }>
            )
                .map((table) => table.name)
                .filter(
                    (name) =>
                        name !== "_prisma_migrations" &&
                        name !== "post_search" &&
                        !name.startsWith("post_search_"),
                ),
        );

        const missingSource = TABLES.filter((table) => !sourceTables.has(table));

        const unexpectedSource = [...sourceTables].filter(
            (table) => !TABLES.includes(table as TableName),
        );

        if (missingSource.length > 0 || unexpectedSource.length > 0) {
            throw new Error(
                [
                    "SQLite table mismatch.",
                    `Missing: ${missingSource.join(", ") || "none"}`,
                    `Unexpected: ${unexpectedSource.join(", ") || "none"}`,
                ].join("\n"),
            );
        }

        // Validate the PostgreSQL tables.
        const targetResult = await postgres.query<{ table_name: string }>(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_type = 'BASE TABLE'
             AND table_name <> '_prisma_migrations'`,
        );

        const targetTables = new Set(targetResult.rows.map((table) => table.table_name));

        const missingTarget = TABLES.filter((table) => !targetTables.has(table));

        if (missingTarget.length > 0) {
            throw new Error(`Missing PostgreSQL tables: ${missingTarget.join(", ")}`);
        }

        const tableColumns = new Map<TableName, PgColumn[]>();
        const sourceCounts = new Map<TableName, number>();

        console.log("\nPreflight:");

        for (const table of TABLES) {
            const sqliteColumns = (
                sqlite
                    .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
                    .all() as SqliteColumn[]
            ).map((column) => column.name);

            const pgResult = await postgres.query<PgColumn>(
                `SELECT column_name, data_type
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = $1
                 ORDER BY ordinal_position`,
                [table],
            );

            const pgColumns = pgResult.rows;
            const pgColumnNames = new Set(pgColumns.map((column) => column.column_name));
            const sqliteColumnNames = new Set(sqliteColumns);

            const missingInPostgres = sqliteColumns.filter((column) => !pgColumnNames.has(column));

            const missingInSqlite = pgColumns
                .map((column) => column.column_name)
                .filter((column) => !sqliteColumnNames.has(column));

            if (missingInPostgres.length > 0 || missingInSqlite.length > 0) {
                throw new Error(
                    [
                        `Column mismatch in table "${table}".`,
                        `Missing in PostgreSQL: ${missingInPostgres.join(", ") || "none"}`,
                        `Missing in SQLite: ${missingInSqlite.join(", ") || "none"}`,
                    ].join("\n"),
                );
            }

            tableColumns.set(table, pgColumns);

            const sourceCount = getSqliteCount(sqlite, table);
            const targetCount = await getPostgresCount(postgres, table);

            if (targetCount !== 0) {
                throw new Error(
                    `PostgreSQL table "${table}" already contains ${targetCount} rows. Import aborted.`,
                );
            }

            sourceCounts.set(table, sourceCount);
            console.log(`${table}: ${sourceCount} rows`);
        }

        console.log("\nAll tables and columns match.");
        console.log("All PostgreSQL application tables are empty.");

        if (!apply) {
            console.log("\nDry run only. No records were copied.");
            console.log("Review the counts, then run again with --apply.");
            return;
        }

        // Lock the destination tables and recheck before copying.
        await postgres.query("BEGIN");

        try {
            await postgres.query(
                `LOCK TABLE ${TABLES.map((table) => `public.${quoteIdentifier(table)}`).join(
                    ", ",
                )} IN ACCESS EXCLUSIVE MODE`,
            );

            for (const table of TABLES) {
                const count = await getPostgresCount(postgres, table);

                if (count !== 0) {
                    throw new Error(
                        `PostgreSQL table "${table}" is no longer empty. Import aborted.`,
                    );
                }
            }

            for (const table of TABLES) {
                const columns = (
                    sqlite
                        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
                        .all() as SqliteColumn[]
                ).map((column) => column.name);

                const pgColumnTypes = new Map(
                    tableColumns
                        .get(table)!
                        .map((column) => [column.column_name, column.data_type]),
                );

                const columnSql = columns.map(quoteIdentifier).join(", ");

                const statement = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`);

                let batch: SqliteRow[] = [];
                let copied = 0;

                async function insertBatch(): Promise<void> {
                    if (batch.length === 0) return;

                    const values: unknown[] = [];
                    const tuples = batch.map((row) => {
                        const placeholders = columns.map((column) => {
                            const dataType = pgColumnTypes.get(column);

                            if (!dataType) {
                                throw new Error(
                                    `Missing PostgreSQL column type for ${table}.${column}`,
                                );
                            }

                            values.push(convertValue(row[column], dataType, table, column));

                            return `$${values.length}`;
                        });

                        return `(${placeholders.join(", ")})`;
                    });

                    await postgres.query(
                        `INSERT INTO public.${quoteIdentifier(table)}
                         (${columnSql})
                         VALUES ${tuples.join(", ")}`,
                        values,
                    );

                    copied += batch.length;
                    batch = [];
                }

                for (const row of statement.iterate() as Iterable<SqliteRow>) {
                    batch.push(row);

                    if (batch.length >= 100) {
                        await insertBatch();
                    }
                }

                await insertBatch();

                console.log(`Copied ${table}: ${copied} rows`);
            }

            // Verify every table before committing.
            for (const table of TABLES) {
                const expected = sourceCounts.get(table)!;
                const actual = await getPostgresCount(postgres, table);

                if (actual !== expected) {
                    throw new Error(
                        `Verification failed for ${table}: expected ${expected}, got ${actual}`,
                    );
                }
            }

            await postgres.query("COMMIT");
            console.log("\nImport completed and all row counts match.");
        } catch (error) {
            await postgres.query("ROLLBACK");
            throw error;
        }
    } finally {
        sqlite.close();

        if (connected) {
            await postgres.end();
        }
    }
}

main().catch((error: unknown) => {
    console.error("\nSQLite to PostgreSQL copy failed:", error);
    process.exitCode = 1;
});
