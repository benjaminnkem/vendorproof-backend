export class CustomError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

declare global {
  namespace Express {
    export interface Request {
      userId?: number;
    }
  }
}
