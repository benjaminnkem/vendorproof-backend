import { readFileSync } from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { load } from "js-yaml";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";
import { logger } from "./logger";

const setupSwaggerDocs = (app: Express): void => {
  if (env.NODE_ENV?.toLowerCase() === "production") {
    return;
  }

  try {
    const docsPath = path.join(process.cwd(), "docs.yaml");
    const rawSpec = readFileSync(docsPath, "utf8");
    const swaggerDocument = load(rawSpec) as Record<string, unknown>;

    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (error) {
    logger.warn("Swagger docs could not be loaded", error);
  }
};

export default setupSwaggerDocs;
