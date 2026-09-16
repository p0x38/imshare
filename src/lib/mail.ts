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

export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}

interface SmtpReply {
    code: number;
    lines: string[];
}

type Socket = net.Socket | TLSSocket;

class SmtpConnection {
    private constructor(
        private socket: Socket,
        private readonly host: string,
    ) {}

    static async connect(config: SmtpConfig): Promise<SmtpConnection> {
        const socket = config.secure
            ? tls.connect({ host: config.host, port: config.port, servername: config.host })
            : net.connect({ host: config.host, port: config.port });
        const connection = new SmtpConnection(socket, config.host);
        await connection.connected();
        const greeting = await connection.readReply();
        if (greeting.code !== 220) {
            throw new Error(
                `SMTP server rejected the connection (${greeting.code}): ${greeting.lines.at(-1) ?? "Unknown SMTP error."}`,
            );
        }
        return connection;
    }

    private connected(): Promise<void> {
        return new Promise((resolve, reject) => {
            const onError = (error: Error) => reject(error);
            this.socket.once("error", onError);
            if (this.socket instanceof tls.TLSSocket) {
                if (this.socket.readyState === "open") resolve();
                else this.socket.once("secureConnect", resolve);
            } else if (this.socket.readyState === "open") {
                resolve();
            } else {
                this.socket.once("connect", resolve);
            }
        });
    }

    private readReply(): Promise<SmtpReply> {
        return new Promise((resolve, reject) => {
            let buffer = "";
            const lines: string[] = [];
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("SMTP server timed out waiting for a response."));
            }, 30_000);

            const cleanup = () => {
                clearTimeout(timeout);
                this.socket.off("data", onData);
                this.socket.off("error", onError);
                this.socket.off("close", onClose);
            };
            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };
            const onClose = () => {
                cleanup();
                reject(new Error("SMTP connection closed unexpectedly."));
            };
            const onData = (chunk: Buffer | string) => {
                buffer += chunk.toString();
                const parts = buffer.split(/\r?\n/);
                buffer = parts.pop() ?? "";
                for (const line of parts) {
                    if (!/^\d{3}[ -]/.test(line)) continue;
                    lines.push(line);
                    if (/^\d{3} /.test(line)) {
                        cleanup();
                        resolve({ code: Number(line.slice(0, 3)), lines });
                        return;
                    }
                }
            };
            this.socket.on("data", onData);
            this.socket.on("error", onError);
            this.socket.on("close", onClose);
        });
    }

    async command(command: string, ...acceptedCodes: number[]): Promise<SmtpReply> {
        const replyPromise = this.readReply();
        this.socket.write(`${command}\r\n`);
        const reply = await replyPromise;
        if (!acceptedCodes.includes(reply.code)) {
            throw new Error(`SMTP command failed (${reply.code}): ${reply.lines.at(-1) ?? "Unknown SMTP error."}`);
        }
        return reply;
    }

    async startTls(): Promise<void> {
        await this.command("STARTTLS", 220);
        const plain = this.socket;
        const secure = tls.connect({ socket: plain, servername: this.host });
        this.socket = secure;
        await new Promise<void>((resolve, reject) => {
            secure.once("secureConnect", resolve);
            secure.once("error", reject);
        });
    }

    close(): void {
        this.socket.end();
    }
}

function header(value: string): string {
    return value.replace(/[\r\n]/g, " ").trim();
}

function address(value: string): string {
    return /<([^<>\s]+)>/.exec(value)?.[1] ?? value.trim();
}

function dotStuff(body: string): string {
    return body.replace(/(^|\r\n)\./g, "$1..").replace(/\r?\n/g, "\r\n");
}

function capabilities(reply: SmtpReply): Set<string> {
    const result = new Set<string>();
    for (const line of reply.lines) {
        const value = line.slice(4).trim();
        const mechanism = value.match(/^AUTH\s+(.+)$/i);
        const methods = mechanism?.[1];
        if (methods) for (const item of methods.split(/\s+/)) result.add(item.toUpperCase());
    }
    return result;
}

export class MailService {
    constructor(private readonly config: SmtpConfig) {}

    async send(message: MailMessage): Promise<void> {
        const connection = await SmtpConnection.connect(this.config);
        try {
            let ehlo = await connection.command("EHLO imshare", 250);
            if (!this.config.secure && this.config.port !== 465) {
                if (!ehlo.lines.some((line) => /^250[ -]STARTTLS\b/i.test(line))) {
                    throw new Error("SMTP server does not advertise STARTTLS.");
                }
                await connection.startTls();
                ehlo = await connection.command("EHLO imshare", 250);
            }

            const auth = capabilities(ehlo);
            if (auth.has("PLAIN")) {
                const encoded = Buffer.from(`\0${this.config.user}\0${this.config.password}`).toString("base64");
                await connection.command(`AUTH PLAIN ${encoded}`, 235);
            } else if (auth.has("LOGIN")) {
                await connection.command("AUTH LOGIN", 334);
                await connection.command(Buffer.from(this.config.user).toString("base64"), 334);
                await connection.command(Buffer.from(this.config.password).toString("base64"), 235);
            } else {
                throw new Error("SMTP server does not advertise AUTH PLAIN or AUTH LOGIN.");
            }

            const from = address(this.config.from);
            const to = address(message.to);
            if (!from || !to || !from.includes("@") || !to.includes("@")) {
                throw new Error("SMTP sender or recipient address is invalid.");
            }

            await connection.command(`MAIL FROM:<${from}>`, 250);
            await connection.command(`RCPT TO:<${to}>`, 250, 251);
            await connection.command("DATA", 354);
            const now = new Date().toUTCString();
            const body = [
                `From: ${header(this.config.from)}`,
                `To: ${header(message.to)}`,
                `Subject: ${header(message.subject)}`,
                `Date: ${now}`,
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=utf-8",
                "Content-Transfer-Encoding: 8bit",
                "",
                message.text.replace(/\r?\n/g, "\r\n"),
            ].join("\r\n");
            await connection.command(`${dotStuff(body)}\r\n.`, 250);
        } finally {
            try {
                await connection.command("QUIT", 221);
            } catch {
                // The connection may already have failed; cleanup is best effort.
            }
            connection.close();
        }
    }

    async sendTest(recipient: string): Promise<void> {
        await this.send({
            to: recipient,
            subject: "imshare SMTP test",
            text: [
                "This is a test email from imshare.",
                "",
                "The configured SMTP server accepted this message.",
                "",
                `Sent at: ${new Date().toUTCString()}`,
            ].join("\n"),
        });
    }
}

export function createMailService(smtp: SmtpConfig | null): MailService | null {
    if (!smtp?.host || !smtp.port || !smtp.user || !smtp.password || !smtp.from) return null;
    return new MailService(smtp);
}
