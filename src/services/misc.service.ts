import {
  SocialPlatform,
  TierNames,
  VerificationType,
} from "../generated/prisma/enums";

export const getConfigs = () => {
  return {
    tierNames: Object.values(TierNames),
    socials: Object.values(SocialPlatform),
    businessVerificationTypes: Object.values(VerificationType),
  };
};
