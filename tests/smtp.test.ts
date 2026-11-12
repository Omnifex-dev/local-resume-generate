import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { addressOf, buildMessage, sendMail, SmtpError } from "@/server/email/smtp";

/** A tiny scripted SMTP server (no TLS) that records what the client sends. */
function fakeServer(opts: { auth?: string; rejectRcpt?: boolean } = {}) {
  const seen: string[] = [];
  let data = "";
  const server = net.createServer((sock) => {
    let inData = false;
    let buf = "";
    sock.write("220 fake ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString();
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            sock.write("250 queued\r\n");
          } else data += `${line}\n`;
          continue;
        }
        seen.push(line);
        const cmd = line.split(" ")[0]!.toUpperCase();
        if (cmd === "EHLO") sock.write(`250-fake\r\n250-SIZE 1000000\r\n${opts.auth ? `250-AUTH ${opts.auth}\r\n` : ""}250 8BITMIME\r\n`);
        else if (cmd === "AUTH" && line.includes("LOGIN")) sock.write("334 VXNlcm5hbWU6\r\n");
        else if (cmd === "AUTH") sock.write("235 ok\r\n");
        else if (seen.at(-2)?.startsWith("AUTH LOGIN")) sock.write("334 UGFzc3dvcmQ6\r\n");
        else if (seen.at(-3)?.startsWith("AUTH LOGIN")) sock.write("235 ok\r\n");
        else if (cmd === "MAIL") sock.write("250 ok\r\n");
        else if (cmd === "RCPT") sock.write(opts.rejectRcpt ? "550 no such user\r\n" : "250 ok\r\n");
        else if (cmd === "DATA") {
          inData = true;
          sock.write("354 go ahead\r\n");
        } else if (cmd === "QUIT") sock.end("221 bye\r\n");
        else sock.write("500 what\r\n");
      }
    });
  });
  return new Promise<{ port: number; seen: string[]; data: () => string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ port: (server.address() as net.AddressInfo).port, seen, data: () => data, close: () => server.close() }),
    ),
  );
}

const msg = { from: "Resume Generate <no-reply@example.com>", to: "jane@example.com", subject: "123456 is your code", text: "Code: 123456", html: "<b>123456</b>" };
let close: (() => void) | undefined;
afterEach(() => close?.());

describe("sendMail", () => {
  it("delivers a message with AUTH PLAIN", async () => {
    const srv = await fakeServer({ auth: "PLAIN LOGIN" });
    close = srv.close;
    await sendMail({ host: "127.0.0.1", port: srv.port, user: "u", pass: "p" }, msg);
    expect(srv.seen).toContain(`AUTH PLAIN ${Buffer.from("\0u\0p").toString("base64")}`);
    expect(srv.seen).toContain("MAIL FROM:<no-reply@example.com>");
    expect(srv.seen).toContain("RCPT TO:<jane@example.com>");
    expect(srv.data()).toContain("Subject: 123456 is your code");
    expect(srv.data()).toContain(Buffer.from("Code: 123456").toString("base64"));
  });

  it("falls back to AUTH LOGIN", async () => {
    const srv = await fakeServer({ auth: "LOGIN" });
    close = srv.close;
    await sendMail({ host: "127.0.0.1", port: srv.port, user: "u", pass: "p" }, msg);
    expect(srv.seen).toEqual(expect.arrayContaining(["AUTH LOGIN", Buffer.from("u").toString("base64"), Buffer.from("p").toString("base64")]));
  });

  it("reports a refused recipient", async () => {
    const srv = await fakeServer({ rejectRcpt: true });
    close = srv.close;
    await expect(sendMail({ host: "127.0.0.1", port: srv.port }, msg)).rejects.toThrow(/550/);
  });

  it("fails cleanly when nothing listens", async () => {
    await expect(sendMail({ host: "127.0.0.1", port: 1, timeoutMs: 2000 }, msg)).rejects.toBeInstanceOf(SmtpError);
  });
});

describe("message building", () => {
  it("extracts addresses and rejects junk", () => {
    expect(addressOf("Name <a@b.co>")).toBe("a@b.co");
    expect(addressOf("a@b.co")).toBe("a@b.co");
    expect(() => addressOf("nope")).toThrow(SmtpError);
  });

  it("strips header line breaks and encodes non-ASCII", () => {
    const m = buildMessage({ ...msg, subject: "Hi\r\nBcc: evil@x.com", to: "Zoë <z@x.com>" });
    expect(m).not.toMatch(/\r\nBcc:/);
    expect(m).toContain("To: =?UTF-8?B?");
  });
});
