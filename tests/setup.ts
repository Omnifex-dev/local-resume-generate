// Loads .env so integration tests can reach the docker-compose database,
// then fills safe defaults so unit tests run without any configuration.
import { randomBytes } from "node:crypto";
import "dotenv/config";

process.env.HAS_TEST_DB = process.env.DATABASE_URL ? "1" : "";
process.env.DATABASE_URL ||= "postgres://unused:unused@127.0.0.1:1/unused";
process.env.ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
