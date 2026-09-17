import nodemailer from "nodemailer";

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

export class MailService {
    private readonly transporter: ReturnType<typeof nodemailer.createTransport>;

    constructor(private readonly config: SmtpConfig) {
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.password,
            },
        });
    }

    async send(message: MailMessage): Promise<void> {
        await this.transporter.sendMail({
            from: this.config.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
        });
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
