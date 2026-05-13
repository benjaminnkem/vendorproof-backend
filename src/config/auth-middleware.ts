import { Request, Response, NextFunction } from "express";
import { verify, JwtPayload } from "jsonwebtoken";
import { CustomError, HttpStatus } from "../@types";
import { env } from "./env";
import { prisma } from "./db";

export interface AuthRequest extends Request {
  userAuthId?: number;
  businessId?: number | undefined;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new CustomError(HttpStatus.UNAUTHORIZED, "No token provided"));
  }

  const token = authHeader.slice(7);

  let decoded: JwtPayload;
  try {
    decoded = verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return next(
      new CustomError(HttpStatus.UNAUTHORIZED, "Invalid or expired token"),
    );
  }

  const userAuth = await prisma.userAuth.findUnique({
    where: { id: Number(decoded.sub), accessToken: token },
    select: {
      id: true,
      user: {
        select: {
          business: { select: { id: true } },
        },
      },
    },
  });

  if (!userAuth) {
    return next(new CustomError(HttpStatus.UNAUTHORIZED, "Session not found"));
  }

  req.userAuthId = userAuth.id;
  req.businessId = userAuth.user.business?.id ?? undefined;

  next();
};
