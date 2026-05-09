import axios from "axios";
import { env } from "../../config/env";

const interswitchClient = axios.create({
  baseURL: env.INTERSWITCH_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Client-Id": env.INTERSWITCH_CLIENT_ID,
    "Client-Secret": env.INTERSWITCH_CLIENT_SECRET,
  },
});

export default interswitchClient;
