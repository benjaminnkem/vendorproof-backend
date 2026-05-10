import { JwtPayload, verify } from "jsonwebtoken";
import { CustomError, HttpStatus } from "../@types";
import asyncHandler from "../config/async-handler";
import { env } from "../config/env";
import { isBefore } from "date-fns";
import { prisma } from "../config/db";

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new CustomError(
      HttpStatus.UNAUTHORIZED,
      "Authorization header missing or malformed",
    );
  }

  const token = authHeader.split(" ")[1];

  const payload = verify(token!, env.JWT_SECRET) as JwtPayload;

  const userId = Number(payload.sub as string);
  const exp = new Date(payload.exp as number);

  if (isBefore(exp, new Date())) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Token has expired");
  }

  const tokenValid = await prisma.userAuth.findFirst({
    where: {
      userId,
      accessToken: token!,
    },
  });

  if (!tokenValid) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid token");
  }

  req.userId = userId;

  next();
});
