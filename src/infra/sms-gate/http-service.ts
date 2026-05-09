import { AxiosInstance } from "axios";
import smsGateClient from "./http-client";
import { SendSmsRequest } from "./types";

interface SmsGateHttpService {
  readonly client: AxiosInstance;

  sendSms: (body: SendSmsRequest) => Promise<void>;
}

class SmsGateHttpServiceImpl implements SmsGateHttpService {
  readonly client: AxiosInstance;

  constructor() {
    this.client = smsGateClient;
  }

  async sendSms(body: SendSmsRequest): Promise<void> {
    await this.client.post(
      "/messages",
      JSON.stringify({
        textMessage: {
          text: body.message,
        },
        phoneNumbers: body.to,
      }),
    );
  }
}

const smsGateService = new SmsGateHttpServiceImpl();

export default smsGateService;
