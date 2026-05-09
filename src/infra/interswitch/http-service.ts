import { AxiosInstance } from "axios";
import {
  VerifyCACResponse,
  VerifyNINRequest,
  VerifyNINResponse,
  VerifyTINResponse,
} from "./type";
import interswitchClient from "./http-client";

interface InterswitchHttpService {
  readonly client: AxiosInstance | null;

  getToken(): Promise<string>;
  verifyTIN(tin: string): Promise<VerifyTINResponse>;
  verifyNIN(body: VerifyNINRequest): Promise<VerifyNINResponse>;
  verifyCAC(companyNameOrRcNumber: string): Promise<VerifyCACResponse>;
}

class InterswitchHttpServiceImpl implements InterswitchHttpService {
  public readonly client: AxiosInstance;

  constructor() {
    this.client = interswitchClient;
  }

  async getToken(): Promise<string> {
    return "mock-interswitch-token";
  }

  async verifyTIN(tin: string): Promise<VerifyTINResponse> {
    return this.buildTinResponse(tin);
  }

  async verifyNIN(body: VerifyNINRequest): Promise<VerifyNINResponse> {
    return {
      nin: {
        nin: body.nin,
        phone: "+2348012345678",
        gender: "m",
        photo: "https://example.com/mock-nin-photo.jpg",
        firstname: body.firstName,
        lastname: body.lastName,
        middlename: "Mock",
      },
      summary: {
        nin_check: {
          status: "EXACT_MATCH",
          fieldMatches: {
            firstname: true,
            lastname: true,
          },
        },
      },
      ninStatus: {
        state: "complete",
        status: "verified",
      },
    };
  }

  async verifyCAC(companyNameOrRcNumber: string): Promise<VerifyCACResponse> {
    const rcNumber = /^\d+$/.test(companyNameOrRcNumber)
      ? companyNameOrRcNumber
      : "RC-0000001";
    const approvedName = /^\d+$/.test(companyNameOrRcNumber)
      ? "Mock Business Ltd"
      : companyNameOrRcNumber;

    return {
      id: 1,
      rc_number: rcNumber,
      registration_date: "2024-01-15",
      active: true,
      classification: "PRIVATE_COMPANY",
      classification_id: 101,
      company_type_name: "Private Company Limited by Shares",
      nature_of_business_name: "Technology Services",
      approved_name: approvedName,
      email: "hello@mockbusiness.example",
      state: "Lagos",
      city: "Ikeja",
      office_address: "1 Mock Avenue, Ikeja, Lagos",
      branch_address: "12 Sample Street, Abuja",
      head_office_address: "1 Mock Avenue, Ikeja, Lagos",
    };
  }

  private buildTinResponse(tin: string): VerifyTINResponse {
    return {
      summary: {
        tin_check: tin.trim() ? "verified" : "unverified",
      },
      tinStatus: {
        state: tin.trim() ? "complete" : "incomplete",
        status: "verified",
      },
      tin: {
        tin,
        taxpayerName: "Mock Taxpayer Ltd",
        cacRegNo: "RC-0000001",
        jittin: "JITTIN-000001",
        taxOffice: "Ikeja Tax Office",
        phone: "+2348012345678",
        email: "tax@mockbusiness.example",
      },
    };
  }
}

const interswitchHttpService: InterswitchHttpService =
  new InterswitchHttpServiceImpl();

export default interswitchHttpService;
export type { InterswitchHttpService };
