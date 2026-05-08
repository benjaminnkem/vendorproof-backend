import { CustomError, HttpStatus } from "../@types";
import asyncHandler from "../config/async-handler";
import { testDbConnection } from "../config/db";
import { testCacheConnection } from "../config/redis";
import * as miscService from "../services/misc.service";

export const healthCheck = asyncHandler(async (req, res) => {
  const tests = await Promise.all([testDbConnection(), testCacheConnection()]);

  const allHealthy = tests.every((result) => result === true);

  if (allHealthy) {
    res.json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "API is healthy",
      data: null,
    });
  } else {
    throw new CustomError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "API health check failed",
    );
  }
});

export const getConfigs = asyncHandler((req, res) => {
  const data = miscService.getConfigs();

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Configurations retrieved successfully",
    data,
  });
});
