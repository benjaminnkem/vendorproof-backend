import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";

export interface SquadInitPayload {
  email: string;
  amount: number; // in NGN — will be converted to kobo
  transactionRef: string;
  customerName: string;
  callbackUrl: string;
}

export interface SquadInitResult {
  checkoutUrl: string;
  transactionRef: string;
}

export const initializeTransaction = async (
  payload: SquadInitPayload,
): Promise<SquadInitResult> => {
  const { data } = await axios.post(
    `${env.SQUAD_BASE_URL}/transaction/initiate`,
    {
      email: payload.email,
      amount: Math.round(payload.amount * 100), // kobo
      currency: "NGN",
      initiate_type: "inline",
      transaction_ref: payload.transactionRef,
    },
    {
      headers: {
        Authorization: `${env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  return {
    checkoutUrl: data.data.checkout_url,
    transactionRef: data.data.transaction_ref,
  };
};

export const verifyTransaction = async (transactionRef: string) => {
  const { data } = await axios.get(
    `${env.SQUAD_BASE_URL}/transaction/verify/${transactionRef}`,
    {
      headers: {
        Authorization: `${env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  return data.data as {
    transaction_status: string;
    transaction_ref: string;
    amount: number; // in kobo
  };
};

export const verifyWebhookSignature = (
  rawBody: string,
  signatureHeader: string,
): boolean => {
  const hash = crypto
    .createHmac("sha512", env.SQUAD_SECRET_KEY)
    .update(rawBody)
    .digest("hex")
    .toUpperCase();
  return hash === signatureHeader?.toUpperCase();
};
