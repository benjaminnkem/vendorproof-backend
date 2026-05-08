import { number, object } from "zod";

export const calculateTriangleAreaSchema = object({
  base: number().positive("Base must be a positive number."),
  height: number().positive("Height must be a positive number."),
});

export type CalculateTriangleAreaInput = ReturnType<
  typeof calculateTriangleAreaSchema.parse
>;
