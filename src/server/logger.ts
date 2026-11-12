import "server-only";
import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: "resume-generate" },
  // Never log secrets even if a caller passes them by accident.
  redact: {
    paths: ["password", "*.password", "passwordHash", "*.passwordHash", "token", "*.token", "apiKey", "*.apiKey"],
    censor: "[redacted]",
  },
});
