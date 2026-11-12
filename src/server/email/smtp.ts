/**
 * Minimal SMTP client for transactional mail (sign-up codes). Supports implicit
 * TLS (port 465), STARTTLS (587) and AUTH PLAIN / LOGIN. Credentials are never
 * sent over an unencrypted connection, except to localhost (e.g. a dev catcher).
 */
import net from "node:net";
import os from "node:os";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

export type SmtpConfig = {
  host: string;
  port: number;
  /** TLS from the first byte. Default: true for port 465. */
  secure?: boolean;
  user?: string;
  pass?: string;
  timeoutMs?: number;
  /** For tests against a local server with a self-signed certificate. */
  rejectUnauthorized?: boolean;
};

export type MailMessage = { from: string; to: string; subject: string; text: string; html?: string };

export class SmtpError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "SmtpError";
  }
}

type Reply = { code: number; lines: string[] };

const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "::1";
const noBreaks = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** "Name <a@b.c>" or "a@b.c" → "a@b.c" */
export function addressOf(value: string): string {
  const m = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(value);
  const addr = (m ? m[1]! : value).trim();
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(addr)) throw new SmtpError(`Invalid email address: ${value}`);
  return addr;
}

/** RFC 2047 encoded-word for non-ASCII header text. */
function encodeHeader(value: string): string {
  const v = noBreaks(value);
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function encodeMailbox(value: string): string {
  const m = /^(.*?)\s*<([^<>]+)>\s*$/.exec(noBreaks(value));
  if (!m || !m[1]) return addressOf(value);
  const name = m[1].replace(/^"|"$/g, "");
  const shown = /^[\x20-\x7e]*$/.test(name) ? `"${name.replace(/["\\]/g, "")}"` : encodeHeader(name);
  return `${shown} <${addressOf(value)}>`;
}

const base64Lines = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");

/** Builds the RFC 5322 message (text, or text + HTML alternative). */
export function buildMessage(msg: MailMessage, now = new Date()): string {
  const domain = addressOf(msg.from).split("@")[1] ?? "localhost";
  const headers = [
    `From: ${encodeMailbox(msg.from)}`,
    `To: ${encodeMailbox(msg.to)}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    `Date: ${now.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
  ];
  let body: string;
  if (msg.html) {
    const boundary = `=_rg_${randomUUID()}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(msg.text),
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(msg.html),
      `--${boundary}--`,
      "",
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64");
    body = base64Lines(msg.text);
  }
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/** One SMTP conversation over a socket that may be upgraded to TLS. */
class Connection {
  private socket!: net.Socket;
  private buffer = "";
  private pending: string[] = [];
  private replies: Reply[] = [];
  private waiter: { resolve: (r: Reply) => void; reject: (e: Error) => void } | null = null;
  private failure: Error | null = null;

  constructor(private readonly timeoutMs: number) {}

  attach(socket: net.Socket) {
    this.socket = socket;
    this.buffer = "";
    socket.setTimeout(this.timeoutMs);
    socket.on("data", (d: Buffer) => this.onData(d.toString("utf8")));
    socket.on("timeout", () => this.fail(new SmtpError("The mail server stopped responding.")));
    socket.on("error", (e) => this.fail(new SmtpError(`Mail server connection failed: ${e.message}`)));
    socket.on("close", () => this.fail(new SmtpError("The mail server closed the connection.")));
  }

  /** Stops listening to the plain socket before it is wrapped in TLS. */
  detach(): net.Socket {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("timeout");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
    this.socket.setTimeout(0);
    return this.socket;
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let i: number;
    while ((i = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, i).replace(/\r$/, "");
      this.buffer = this.buffer.slice(i + 1);
      this.pending.push(line);
      // The last line of a reply is "NNN text"; earlier ones are "NNN-text".
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), lines: this.pending.map((l) => l.slice(4)) };
        this.pending = [];
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = null;
          w.resolve(reply);
        } else this.replies.push(reply);
      }
    }
  }

  private fail(err: Error) {
    this.failure ??= err;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(err);
    }
  }

  read(): Promise<Reply> {
    const next = this.replies.shift();
    if (next) return Promise.resolve(next);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => (this.waiter = { resolve, reject }));
  }

  async command(line: string | null, expect: number[], what: string): Promise<Reply> {
    if (line !== null) this.socket.write(`${line}\r\n`);
    const reply = await this.read();
    if (!expect.includes(reply.code)) {
      throw new SmtpError(`Mail server refused ${what}: ${reply.code} ${reply.lines.join(" ")}`.trim(), reply.code);
    }
    return reply;
  }

  write(data: string) {
    this.socket.write(data);
  }

  end() {
    this.socket.end();
    this.socket.destroy();
  }
}

function connect(cfg: SmtpConfig, secure: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const onError = (e: Error) => reject(new SmtpError(`Couldn't connect to ${cfg.host}:${cfg.port}: ${e.message}`));
    const socket = secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized ?? true }, () => {
          socket.off("error", onError);
          resolve(socket);
        })
      : net.connect({ host: cfg.host, port: cfg.port }, () => {
          socket.off("error", onError);
          resolve(socket);
        });
    socket.once("error", onError);
    socket.setTimeout(cfg.timeoutMs ?? 20_000, () => socket.destroy(new Error("timed out")));
  });
}

function upgrade(socket: net.Socket, cfg: SmtpConfig): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secured = tls.connect({ socket, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized ?? true }, () => {
      secured.off("error", onError);
      resolve(secured);
    });
    const onError = (e: Error) => reject(new SmtpError(`TLS with the mail server failed: ${e.message}`));
    secured.once("error", onError);
  });
}

export async function sendMail(cfg: SmtpConfig, msg: MailMessage): Promise<void> {
  const secure = cfg.secure ?? cfg.port === 465;
  const conn = new Connection(cfg.timeoutMs ?? 20_000);
  const hostname = noBreaks(os.hostname()) || "localhost";
  conn.attach(await connect(cfg, secure));

  try {
    await conn.command(null, [220], "the connection");
    let ehlo = await conn.command(`EHLO ${hostname}`, [250], "EHLO");
    let encrypted = secure;

    const supports = (ext: string) => ehlo.lines.some((l) => l.toUpperCase().startsWith(ext));
    if (!encrypted && supports("STARTTLS")) {
      await conn.command("STARTTLS", [220], "STARTTLS");
      conn.attach(await upgrade(conn.detach(), cfg));
      encrypted = true;
      ehlo = await conn.command(`EHLO ${hostname}`, [250], "EHLO");
    }

    if (cfg.user) {
      if (!encrypted && !isLocal(cfg.host)) {
        throw new SmtpError("The mail server doesn't offer TLS, so the password wasn't sent. Use port 465 (SMTP_SECURE=true) or 587.");
      }
      const auth = ehlo.lines.find((l) => l.toUpperCase().startsWith("AUTH"))?.toUpperCase() ?? "";
      const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
      if (auth.includes("PLAIN") || !auth.includes("LOGIN")) {
        await conn.command(`AUTH PLAIN ${b64(`\0${cfg.user}\0${cfg.pass ?? ""}`)}`, [235], "the login (check SMTP_USER / SMTP_PASS)");
      } else {
        await conn.command("AUTH LOGIN", [334], "the login");
        await conn.command(b64(cfg.user), [334], "the login");
        await conn.command(b64(cfg.pass ?? ""), [235], "the login (check SMTP_USER / SMTP_PASS)");
      }
    }

    await conn.command(`MAIL FROM:<${addressOf(msg.from)}>`, [250], "the sender address");
    await conn.command(`RCPT TO:<${addressOf(msg.to)}>`, [250, 251], "the recipient address");
    await conn.command("DATA", [354], "the message");
    // Dot-stuffing (RFC 5321 4.5.2), then the end-of-data marker.
    conn.write(`${buildMessage(msg).replace(/^\./gm, "..")}\r\n.\r\n`);
    await conn.command(null, [250], "the message");
    await conn.command("QUIT", [221], "QUIT").catch(() => undefined);
  } finally {
    conn.end();
  }
}
