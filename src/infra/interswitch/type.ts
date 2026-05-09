export type VerifyTINResponse = {
  summary: {
    tin_check: "verified" | "unverified";
  };
  tinStatus: {
    state: "complete" | "incomplete";
    status: "verified";
  };
  tin: {
    tin: string;
    taxpayerName: string;
    cacRegNo: string;
    jittin: string;
    taxOffice: string;
    phone: string;
    email: string;
  };
};

export type VerifyNINRequest = {
  firstName: string;
  lastName: string;
  nin: string;
};

export type VerifyNINResponse = {
  nin: {
    nin: string;
    phone: string;
    gender: "m" | "f";
    photo: string;
    firstname: string;
    lastname: string;
    middlename: string;
  };
  summary: {
    nin_check: {
      status: "EXACT_MATCH" | string;
      fieldMatches: {
        firstname: boolean;
        lastname: boolean;
      };
    };
  };
  ninStatus: {
    state: "complete" | "incomplete";
    status: "verified";
  };
};

export type VerifyCACResponse = {
  id: number;
  rc_number: string;
  registration_date: string;
  active: boolean;
  classification: string;
  classification_id: number;
  company_type_name: string;
  nature_of_business_name: string;
  approved_name: string;
  email: string;
  state: string;
  city: string;
  office_address: string;
  branch_address: string;
  head_office_address: string;
};
