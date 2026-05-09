import bcrypt from "bcryptjs";
import multer from "multer";

const SALT_ROUNDS = 10;

export const hashPassword = async (value: string): Promise<string> => {
  return bcrypt.hash(value, SALT_ROUNDS);
};

export const comparePassword = async (
  plainTextValue: string,
  hashedValue: string,
): Promise<boolean> => {
  return bcrypt.compare(plainTextValue, hashedValue);
};

export const parseJsonField = <T>(value: unknown, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const bufferUploader = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      return callback(null, false);
    }
    callback(null, true);
  },
});

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const toQueueFile = (file: Express.Multer.File | undefined) => {
  if (!file) {
    return undefined;
  }

  return {
    bufferBase64: file.buffer.toString("base64"),
    mimetype: file.mimetype,
    originalname: file.originalname,
  };
};

export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+234${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return `+234${cleaned.slice(1)}`;
  } else if (cleaned.length === 13 && cleaned.startsWith("234")) {
    return `+${cleaned}`;
  } else if (cleaned.length === 14 && cleaned.startsWith("+234")) {
    return cleaned;
  } else {
    throw new Error("Invalid phone number format");
  }
};

export const generateOtp = (length: number = 6): string => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};
