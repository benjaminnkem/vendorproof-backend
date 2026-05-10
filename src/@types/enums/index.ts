export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
}

export enum QueueNames {
  KYC_VERIFICATION = "kyc_verification",
  SEND_SMS = "send_sms",
  UPLOAD_BUSINESS_SHOWCASE_IMAGES = "upload_business_showcase_images",
}
