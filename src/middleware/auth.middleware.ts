import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthPayload, CustomError, HttpStatus } from "../@types";
import { env } from "../config/env";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new CustomError(HttpStatus.UNAUTHORIZED, "No token provided"));
  }

  try {
    const token = authHeader.split(" ")[1]!;
    const payload = jwt.verify(token, env.JWT_SECRET as string) as unknown as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};
