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
});

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
