import net from "node:net";
import tls, { type TLSSocket } from "node:tls";

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
}

interface SmtpReply {
    code: number;
    lines: string[];
}

class SmtpConnection {
    private socket: net.Socket | TLSSocket;
    private buffer = "";
    private pending: Array<{
        resolve: (reply: SmtpReply) => void;
        reject: (error: Error) => void;
    }> = [];

    private constructor(
        socket: net.Socket | TLSSocket,
        private readonly host: string,
    ) {
        this.socket = socket;
        this.attachSocket();
    }

    static async connect(config: SmtpConfig): Promise<SmtpConnection> {
        const socket = config.secure
            ? tls.connect({ host: config.host, port: config.port, servername: config.host })
            : net.connect({ host: config.host, port: config.port });

        const connection = new SmtpConnection(socket, config.host);
        await connection.waitForConnect();
        return connection;
    }

    private attachSocket(): void {
        this.socket.setEncoding("utf8");
        this.socket.on("data", (chunk: string) => this.consume(chunk));
        this.socket.on("error", (error) => this.fail(error));
        this.socket.on("close", () => {
            if (this.pending.length > 0) this.fail(new Error("SMTP connection closed unexpectedly."));
        });
    }

    private consume(chunk: string): void {
        this.buffer += chunk;
        while (true) {
            const match = /(?:^|\r?\n)(\d{3})([ -])(.*?)(?=\r?\n|$)/.exec(this.buffer);
            if (!match) return;

            const lineEnd = this.buffer.indexOf("\n", match.index);
            const consumed = lineEnd === -1 ? this.buffer.length : lineEnd + 1;
            const line = this.buffer.slice(match.index, consumed).replace(/\r?\n$/, "");
            this.buffer = this.buffer.slice(consumed);

            const pending = this.pending[0];
            if (!pending) continue;

            const code = Number(match[1]);
            const multiline = match[2] === "-";
            const reply = (pending as typeof pending).length;
            void reply;

            if (multiline) {
                const existing = (pending as unknown as { lines?: string[] }).lines ?? [];
                existing.push(line);
                (pending as unknown as { lines: string[] }).lines = existing;
                continue;
            }

            const state = pending as unknown as { lines?: string[] };
            const lines = [...(state.lines ?? []), line];
            this.pending.shift();
            pending.resolve({ code, lines });
        }
    }

    private fail(error: Error): void {
        const pending = this.pending.splice(0);
        for (const waiter of pending) waiter.reject(error);
    }

    private waitForConnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket instanceof tls.TLSSocket) {
                if (this.socket.readyState === "open") resolve();
                else this.socket.once("secureConnect", resolve);
            } else if (this.socket.readyState === "open") {
                resolve();
            } else {
                this.socket.once("connect", resolve);
            }
            this.socket.once("error", reject);
        });
    }

    private command(command: string): Promise<SmtpReply> {
        return new Promise((resolve, reject) => {
            const pending = { resolve, reject } as {
                resolve: (reply: SmtpReply) => void;
                reject: (error: Error) => void;
                lines?: string[];
            };
            this.pending.push(pending);
            this.socket.write(`${command}\r\n`);
        });
    }

    async expect(command: string, ...acceptedCodes: number[]): Promise<SmtpReply> {
        const reply = await this.command(command);
        if (!acceptedCodes.includes(reply.code)) {
            throw new Error(`SMTP command failed (${reply.code}): ${reply.lines.at(-1) ?? "Unknown SMTP error."}`);
        }
        return reply;
    }

    async startTls(): Promise<void> {
        await this.expect("STARTTLS", 220);
        const existing = this.socket;
        existing.removeAllListeners("data");
        existing.removeAllListeners("error");
        existing.removeAllListeners("close");

        const secure = tls.connect({ socket: existing, servername: this.host });
        this.socket = secure;
        this.buffer = "";
        this.attachSocket();
        await new Promise<void>((resolve, reject) => {
            secure.once("secureConnect", resolve);
            secure.once("error", reject);
        });
    }

    close(): void {
        this.socket.end();
    }
}

function encodeHeader(value: string): string {
    return value.replace(/[\r\n]/g, " ").trim();
}

function encodeAddress(value: string): string {
    const match = /<([^<>\s]+)>/.exec(value);
    return match?.[1] ?? value.trim();
}

function dotStuff(body: string): string {
    return body.replace(/(^|\n)\./g, "$1..\").replace(/\r?\n/g, "\r\n");
}

function responseHasCapability(reply: SmtpReply, capability: string): boolean {
    const needle = capability.toUpperCase();
    return reply.lines.some((line) => line.slice(4).toUpperCase().startsWith(needle));
}

export async function sendTestEmail(config: SmtpConfig, recipient: string): Promise<void> {
    const connection = await SmtpConnection.connect(config);
    try {
        await connection.expect("EHLO imshare", 250);
        const capabilities = await connection.expect("EHLO imshare", 250);
        if (!config.secure && config.port !== 465 && responseHasCapability(capabilities, "STARTTLS")) {
            await connection.startTls();
            await connection.expect("EHLO imshare", 250);
        } else if (!config.secure && config.port !== 465) {
            throw new Error("SMTP server does not advertise STARTTLS.");
        }

        const authReply = await connection.expect("EHLO imshare", 250);
        const authLine = authReply.lines.find((line) => /^250[- ]AUTH\s/i.test(line));
        const mechanisms = authLine?.slice(9).trim().toUpperCase().split(/\s+/) ?? [];

        if (mechanisms.includes("PLAIN")) {
            const encoded = Buffer.from(`\u0000${config.user}\u0000${config.password}`, "utf8").toString("base64");
            await connection.expect(`AUTH PLAIN ${encoded}`, 235);
        } else if (mechanisms.includes("LOGIN")) {
            await connection.expect("AUTH LOGIN", 334);
            await connection.expect(Buffer.from(config.user, "utf8").toString("base64"), 334);
            await connection.expect(Buffer.from(config.password, "utf8").toString("base64"), 235);
        } else {
            throw new Error("SMTP server does not advertise AUTH PLAIN or AUTH LOGIN.");
        }

        const from = encodeAddress(config.from);
        const to = encodeAddress(recipient);
        if (!from || !to) throw new Error("SMTP sender or recipient address is invalid.");

        await connection.expect(`MAIL FROM:<${from}>`, 250);
        await connection.expect(`RCPT TO:<${to}>`, 250, 251);
        await connection.expect("DATA", 354);

        const now = new Date().toISOString();
        const body = [
            `From: ${encodeHeader(config.from)}`,
            `To: ${encodeHeader(recipient)}`,
            "Subject: imshare SMTP test",
            "Date: " + now,
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: 8bit",
            "",
            "This is a test email from imshare.",
            "",
            `Sent at: ${now}`,
            "",
            "If you received this message, SMTP submission is working.",
        ].join("\r\n");
        connection.expect(`${dotStuff(body)}\r\n.`, 250);
    } finally {
        try {
            await connection.expect("QUIT", 221);
        } catch {
            // Ignore cleanup failures after a successful or failed send attempt.
        }
        connection.close();
    }
}
