import axios from "axios";
import { env } from "../../config/env";

const smsGatePassword = env.SMS_GATE_PASSWORD!;
const smsGateUsername = env.SMS_GATE_USERNAME!;

const basicAuthToken = Buffer.from(
  `${smsGateUsername}:${smsGatePassword}`,
).toString("base64");

const smsGateClient = axios.create({
  baseURL: "https://api.sms-gate.app/3rdparty/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${basicAuthToken}`,
  },
});

export default smsGateClient;
