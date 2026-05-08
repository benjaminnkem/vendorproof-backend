import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { env } from "./config/env";
import { CustomError, HttpStatus } from "./@types";
import { errorHandler } from "./utils/request-handlers";
import { testDbConnection } from "./config/db";
import { testCacheConnection } from "./config/redis";
import router from "./routes";

const app = express();

app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  }),
);

app.use(
  compression({
    level: 6,
  }),
);

app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
  }),
);

app.disable("x-powered-by");

app.use((req, res, next) => {
  if (
    env.NODE_ENV?.toLowerCase() === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use("/health", async (req, res, next) => {
  const tests = await Promise.all([testDbConnection(), testCacheConnection()]);

  const allHealthy = tests.every((result) => result === true);

  try {
    if (allHealthy) {
      throw new CustomError(400, "Simulated error for testing purposes.");
      res.status(HttpStatus.OK).json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: "error",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
});

app.use("/api", router);

app.use((req, res) => {
  res.status(HttpStatus.NOT_FOUND).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

export default app;
