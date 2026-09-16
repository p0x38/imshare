export class ConfigDslError extends Error {
    constructor(
        message: string,
        readonly line: number,
        readonly column: number,
    ) {
        super(`Config error at ${line}:${column}: ${message}`);
        this.name = "ConfigDslError";
    }
}

type ConfigObject = Record<string, unknown>;
type TokenType = "identifier" | "string" | "number" | "boolean" | "symbol" | "newline" | "eof";

interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

const SIZE_UNITS: Record<string, number> = {
    B: 1,
    KB: 1_000,
    MB: 1_000_000,
    GB: 1_000_000_000,
    KiB: 1024,
    MiB: 1024 ** 2,
    GiB: 1024 ** 3,
};
const DURATION_UNITS: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};

export function parseConfigDsl(content: string): unknown {
    return new Parser(tokenize(content)).parse();
}
export function stringifyConfigDsl(value: unknown): string {
    if (!isObject(value)) throw new TypeError("Config root must be an object");
    return `${writeObject(value as ConfigObject, 0)}\n`;
}

function writeObject(value: ConfigObject, depth: number): string {
    const indent = "    ".repeat(depth);
    const childIndent = "    ".repeat(depth + 1);
    const lines: string[] = [];
    for (const [key, child] of Object.entries(value)) {
        if (isObject(child)) {
            lines.push(`${indent}${key} {`, writeObject(child, depth + 1), `${indent}}`);
        } else {
            lines.push(`${childIndent}${key} = ${formatValue(child)}`);
        }
    }
    return lines.join("\n");
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
    if (value === null) return "null";
    throw new TypeError("Unsupported configuration value");
}

function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    let line = 1;
    let column = 1;

    const charAt = (position: number): string => source.charAt(position);
    const advance = (count = 1) => {
        for (let i = 0; i < count; i++) {
            if (charAt(index) === "\n") {
                line++;
                column = 1;
            } else column++;
            index++;
        }
    };

    while (index < source.length) {
        const char = charAt(index);
        if (char === " " || char === "\t" || char === "\r") {
            advance();
            continue;
        }
        if (char === "\n") {
            tokens.push({ type: "newline", value: "\n", line, column });
            advance();
            continue;
        }
        if (char === "#" || (char === "/" && charAt(index + 1) === "/")) {
            while (index < source.length && charAt(index) !== "\n") advance();
            continue;
        }
        if (char === '"' || char === "'") {
            const result = readString(source, index, line, column);
            tokens.push(result.token);
            advance(result.end - index);
            continue;
        }
        if (/[0-9-]/.test(char)) {
            const startLine = line,
                startColumn = column;
            let end = index + 1;
            while (end < source.length && /[A-Za-z0-9_.+-]/.test(charAt(end))) end++;
            tokens.push({
                type: "number",
                value: source.slice(index, end),
                line: startLine,
                column: startColumn,
            });
            advance(end - index);
            continue;
        }
        if (/[A-Za-z_]/.test(char)) {
            const startLine = line,
                startColumn = column;
            let end = index + 1;
            while (end < source.length && /[A-Za-z0-9_-]/.test(charAt(end))) end++;
            const value = source.slice(index, end);
            tokens.push({
                type: value === "true" || value === "false" ? "boolean" : "identifier",
                value,
                line: startLine,
                column: startColumn,
            });
            advance(end - index);
            continue;
        }
        if ("{}[]=,.".includes(char)) {
            tokens.push({ type: "symbol", value: char, line, column });
            advance();
            continue;
        }
        throw new ConfigDslError(`Unexpected character ${JSON.stringify(char)}`, line, column);
    }
    tokens.push({ type: "eof", value: "", line, column });
    return tokens;
}

function readString(
    source: string,
    start: number,
    line: number,
    column: number,
): { token: Token; end: number } {
    const quote = source.charAt(start);
    let index = start + 1;
    let value = "";
    while (index < source.length) {
        const char = source.charAt(index);
        if (char === quote)
            return {
                token: { type: "string", value: JSON.stringify(value), line, column },
                end: index + 1,
            };
        if (char === "\n") throw new ConfigDslError("Unterminated string", line, column);
        if (char === "\\") {
            const next = source.charAt(index + 1);
            if (!next) throw new ConfigDslError("Unterminated string", line, column);
            const escapes: Record<string, string> = {
                n: "\n",
                r: "\r",
                t: "\t",
                "\\": "\\",
                '"': '"',
                "'": "'",
            };
            if (escapes[next] === undefined)
                throw new ConfigDslError(`Unsupported escape \\${next}`, line, column);
            value += escapes[next];
            index += 2;
            continue;
        }
        value += char;
        index++;
    }
    throw new ConfigDslError("Unterminated string", line, column);
}

class Parser {
    private index = 0;
    constructor(private readonly tokens: Token[]) {}

    parse(): ConfigObject {
        const root = this.parseObjectBody(false);
        this.skipNewlines();
        this.expect("eof");
        return root;
    }

    private parseObjectBody(expectClosing: boolean): ConfigObject {
        const object: ConfigObject = {};
        this.skipNewlines();
        while (!this.at("eof") && !(expectClosing && this.atSymbol("}"))) {
            const key = this.expect("identifier").value;
            if (this.atSymbol("{")) {
                this.advance();
                if (key in object) this.fail(`Duplicate key ${key}`);
                object[key] = this.parseObjectBody(true);
                this.expectSymbol("}");
            } else {
                this.expectSymbol("=");
                if (key in object) this.fail(`Duplicate key ${key}`);
                object[key] = this.parseValue();
            }
            if (this.atSymbol(",")) this.advance();
            this.skipNewlines();
        }
        return object;
    }

    private parseValue(): unknown {
        const token = this.current();
        if (token.type === "string") {
            this.advance();
            return JSON.parse(token.value) as string;
        }
        if (token.type === "boolean") {
            this.advance();
            return token.value === "true";
        }
        if (token.type === "number") {
            this.advance();
            return parseNumber(token);
        }
        if (token.type === "identifier" && token.value === "null") {
            this.advance();
            return null;
        }
        if (token.type === "symbol" && token.value === "[") return this.parseArray();
        this.fail("Expected a value");
    }

    private parseArray(): unknown[] {
        this.expectSymbol("[");
        const values: unknown[] = [];
        this.skipNewlines();
        while (!this.atSymbol("]")) {
            values.push(this.parseValue());
            if (this.atSymbol(",")) this.advance();
            else if (!this.atSymbol("]")) this.fail("Expected ',' or ']' in array");
            this.skipNewlines();
        }
        this.expectSymbol("]");
        return values;
    }

    private current(): Token {
        const token = this.tokens[this.index];
        if (!token) throw new Error("Config parser reached an invalid token position");
        return token;
    }

    private advance(): Token {
        const token = this.current();
        this.index++;
        return token;
    }

    private at(type: TokenType): boolean {
        return this.current().type === type;
    }
    private atSymbol(value: string): boolean {
        const token = this.current();
        return token.type === "symbol" && token.value === value;
    }
    private expect(type: TokenType): Token {
        const token = this.current();
        if (token.type !== type) this.fail(`Expected ${type}`);
        this.index++;
        return token;
    }
    private expectSymbol(value: string): Token {
        const token = this.current();
        if (token.type !== "symbol" || token.value !== value) this.fail(`Expected '${value}'`);
        this.index++;
        return token;
    }
    private skipNewlines(): void {
        while (this.at("newline")) this.advance();
    }
    private fail(message: string): never {
        const token = this.current();
        throw new ConfigDslError(message, token.line, token.column);
    }
}

function parseNumber(token: Token): number {
    const match = token.value.match(/^(-?\d+(?:\.\d+)?)([A-Za-z]+)?$/);
    if (!match) throw new ConfigDslError(`Invalid number ${token.value}`, token.line, token.column);
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount))
        throw new ConfigDslError(`Invalid number ${token.value}`, token.line, token.column);
    if (!unit) return amount;
    const multiplier = SIZE_UNITS[unit] ?? DURATION_UNITS[unit];
    if (!multiplier) throw new ConfigDslError(`Unknown unit ${unit}`, token.line, token.column);
    return amount * multiplier;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
