import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { CustomError, HttpStatus } from "../@types";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err);
  logger.error(err?.message || JSON.stringify(err));

  let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message || "Internal Server Error";
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Token expired";
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Invalid token";
  } else if (err instanceof ZodError) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = "Validation Error";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const knownErr = err as Prisma.PrismaClientKnownRequestError;
    if (knownErr.code === "P2002") {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "A record with that value already exists";
    } else if (knownErr.code === "P2025") {
      statusCode = HttpStatus.NOT_FOUND;
      message = "Record not found";
    } else {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "Database request error";
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = "Invalid request data";
  }

  return res.status(statusCode).json({
    status: "error",
    message,
    statusCode: statusCode,
    timestamp: new Date().toISOString(),
  });
};
