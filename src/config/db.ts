import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";
import chalk from "chalk";

declare global {
  var globalPrisma: PrismaClient | null;
}

if (!globalThis.globalPrisma) {
  globalThis.globalPrisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
    }),
  });

  globalThis.globalPrisma
    .$connect()
    .then(() => {
      console.log(chalk.green("Connected to the database successfully."));
    })
    .catch((error) => {
      console.error(chalk.red("Failed to connect to the database:"), error);
      process.exit(1);
    });
}

export const testDbConnection = async (): Promise<boolean> => {
  try {
    await globalThis.globalPrisma?.$queryRawUnsafe("SELECT 1");
    return true;
  } catch (error) {
    console.error(chalk.red("Database connection test failed:"), error);
    return false;
  }
};

export const closeDbConnection = async (): Promise<void> => {
  try {
    await globalThis.globalPrisma?.$disconnect();
    console.log(chalk.green("Database connection closed successfully."));
  } catch (error) {
    console.error(chalk.red("Failed to close database connection:"), error);
  }
};

export const prisma = globalThis.globalPrisma as PrismaClient;
