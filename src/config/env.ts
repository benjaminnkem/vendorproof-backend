import { config } from "dotenv";
import { NodeEnv } from "../@types";

config();

export const env = {
  DATABASE_URL: process.env["DATABASE_URL"]!,
  JWT_SECRET: process.env["JWT_SECRET"]!,
  PORT: process.env["PORT"] || "3000",
  NODE_ENV: <NodeEnv>process.env["NODE_ENV"] || "local",
  REDIS_CONNECTION_STRING: process.env["REDIS_CONNECTION_STRING"]!,
  CLOUDINARY_API_SECRET: process.env["CLOUDINARY_API_SECRET"]!,
  CLOUDINARY_CLOUD_NAME: process.env["CLOUDINARY_CLOUD_NAME"]!,
  CLOUDINARY_API_KEY: process.env["CLOUDINARY_API_KEY"]!,
  INTERSWITCH_BASE_URL: process.env["INTERSWITCH_BASE_URL"]!,
  INTERSWITCH_CLIENT_ID: process.env["INTERSWITCH_CLIENT_ID"]!,
  INTERSWITCH_CLIENT_SECRET: process.env["INTERSWITCH_CLIENT_SECRET"]!,
};
