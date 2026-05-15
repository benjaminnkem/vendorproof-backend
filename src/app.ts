import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "./config/env";
import { CustomError, HttpStatus } from "./@types";
import { errorHandler } from "./utils/request-handlers";
import setupSwaggerDocs from "./config/swagger";
import router from "./routes";

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString("utf8");
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use(
  compression({
    level: 6,
  }),
);

app.use(
  cors({
    origin: "*",
  }),
);
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

setupSwaggerDocs(app);

app.use((req, res, next) => {
  if (
    env.NODE_ENV?.toLowerCase() === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
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
