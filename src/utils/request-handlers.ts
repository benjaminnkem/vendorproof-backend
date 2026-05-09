import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { CustomError, HttpStatus } from "../@types";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error(err?.message || JSON.stringify(err));

  let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message || "Internal Server Error";
  }

  if (err instanceof jwt.JsonWebTokenError) {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Invalid token";
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Token expired";
  }

  if (err instanceof ZodError) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = "Validation Error";
  }

  return res.status(statusCode).json({
    status: "error",
    message,
    statusCode: statusCode,
    timestamp: new Date().toISOString(),
  });
};
