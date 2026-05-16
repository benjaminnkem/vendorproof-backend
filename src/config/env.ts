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
  SMS_GATE_USERNAME: process.env["SMS_GATE_USERNAME"]!,
  SMS_GATE_PASSWORD: process.env["SMS_GATE_PASSWORD"]!,
  SQUAD_SECRET_KEY: process.env["SQUAD_SECRET_KEY"]!,
  SQUAD_BASE_URL:
    process.env["SQUAD_BASE_URL"] || "https://sandbox-api-d.squadco.com",
  APP_BASE_URL: process.env["APP_BASE_URL"]!,
  CHECKOUT_REDIRECT_URL: process.env["CHECKOUT_REDIRECT_URL"]!,
  FRONTEND_URL: process.env["FRONTEND_URL"]!,
  MOBILE_DEEP_LINK_SCHEME: process.env["MOBILE_DEEP_LINK_SCHEME"]!,
};
