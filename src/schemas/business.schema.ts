import { array, enum as enum_, object, string } from "zod";
import { SocialPlatform } from "../generated/prisma/enums";

export const updateBusinessProfileSchema = object({
  name: string().min(1, "Business name cannot be empty").optional(),
  description: string().optional(),
});

export const updateBusinessSocialsSchema = object({
  socials: array(
    object({
      platform: enum_(Object.values(SocialPlatform) as [SocialPlatform, ...SocialPlatform[]]),
      url: string().url("Invalid URL"),
    }),
  ).min(1, "At least one social entry is required"),
});

export type UpdateBusinessProfileInput = ReturnType<typeof updateBusinessProfileSchema.parse>;
export type UpdateBusinessSocialsInput = ReturnType<typeof updateBusinessSocialsSchema.parse>;
