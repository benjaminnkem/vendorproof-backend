import { config } from "dotenv";
import { NodeEnv } from "../@types";

config();

export const env = {
  DATABASE_URL: process.env["DATABASE_URL"]!,
  JWT_SECRET: process.env["JWT_SECRET"]!,
  PORT: process.env["PORT"] || "3000",
  NODE_ENV: <NodeEnv>process.env["NODE_ENV"] || "development",
  REDIS_CONNECTION_STRING: process.env["REDIS_CONNECTION_STRING"]!,
};
