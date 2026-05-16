import { KycVerificationDecision, KycVerificationJobPayload } from "../@types";
import { prisma } from "../config/db";
import { logger } from "../config/logger";
import interswitchHttpService from "../infra/interswitch/http-service";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { Prisma } from "../generated/prisma/client";
import { KycStatus, VerificationType } from "../generated/prisma/enums";
import { verifyFaceMatch } from "../utils/face";
import {
  extractCacDataFromImageUrl,
  extractNinFromImageUrl,
} from "../utils/ocr";
import {
  average,
  nameSimilarityScore,
  ninConfidenceFromMatches,
  toPercentage,
  weightedBusinessTrustScore,
} from "../utils/kyc-scoring";

const APPROVAL_THRESHOLD = 0.4;

type SupportedVerificationType = "SELFIE" | "NIN" | "CAC" | "TIN";

type KycRowMap = Partial<
  Record<SupportedVerificationType, { id: number; url: string | null }>
>;

const upsertBusinessKycRow = async (params: {
  businessId: number;
  verificationType: SupportedVerificationType;
  url?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<{ id: number; url: string | null }> => {
  const existing = await prisma.businessKYC.findFirst({
    where: {
      businessId: params.businessId,
      verificationType: params.verificationType,
    },
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
      url: true,
    },
  });

  const data: Prisma.BusinessKYCUpdateInput = {
    status: KycStatus.PENDING,
    score: null,
    reason: null,
  };

  if (params.url) {
    data.url = params.url;
  }

  if (params.metadata) {
    data.metadata = params.metadata;
  }

  if (existing) {
    const updated = await prisma.businessKYC.update({
      where: {
        id: existing.id,
      },
      data,
      select: {
        id: true,
        url: true,
      },
    });

    return updated;
  }

  const created = await prisma.businessKYC.create({
    data: {
      businessId: params.businessId,
      verificationType: params.verificationType,
      status: KycStatus.PENDING,
      ...(params.url ? { url: params.url } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    select: {
      id: true,
      url: true,
    },
  });

  return created;
};

const updateKycRow = async (
  businessKycId: number,
  decision: KycVerificationDecision,
) => {
  const businessKyc = await prisma.businessKYC.findUnique({
    where: { id: businessKycId },
  });

  if (!businessKyc) {
    logger.error(
      `[KYC] Unable to find BusinessKYC row with id ${businessKycId} for update`,
    );
    return;
  }

  const data: Prisma.BusinessKYCUpdateInput = {
    status:
      decision.status === "APPROVED" ? KycStatus.APPROVED : KycStatus.REJECTED,
  };

  if (typeof decision.score === "number") {
    data.score = decision.score;
  }

  if (decision.reason) {
    data.reason = decision.reason;
  }

  if (decision.metadata) {
    data.metadata = decision.metadata as Prisma.InputJsonValue;

    if (decision.verificationType === "NIN" && decision.metadata.extractedNin) {
      await prisma.business.update({
        where: { id: businessKyc.businessId! },
        data: {
          nin: String(decision.metadata.extractedNin),
        },
      });
    }
  }

  await prisma.businessKYC.update({
    where: { id: businessKycId },
    data,
  });
};

const verifySelfie = async (params: {
  idDocumentUrl: string | undefined;
  selfieUrl: string | undefined;
}): Promise<KycVerificationDecision> => {
  if (!params.idDocumentUrl || !params.selfieUrl) {
    return {
      verificationType: "SELFIE",
      status: "REJECTED",
      reason: "Missing ID document or selfie for face verification",
      score: 0,
    };
  }

  const faceMatch = await verifyFaceMatch({
    sourceImageUrl: params.idDocumentUrl,
    targetImageUrl: params.selfieUrl,
  });

  if (faceMatch.reason) {
    return {
      verificationType: "SELFIE",
      status: "REJECTED",
      reason: faceMatch.reason,
      score: 0,
      metadata: {
        confidence: toPercentage(faceMatch.confidence),
      },
    };
  }

  const score = toPercentage(faceMatch.confidence);

  if (faceMatch.confidence <= APPROVAL_THRESHOLD) {
    return {
      verificationType: "SELFIE",
      status: "REJECTED",
      reason: "Face match confidence is below the acceptance threshold",
      score,
      metadata: {
        threshold: toPercentage(APPROVAL_THRESHOLD),
      },
    };
  }

  return {
    verificationType: "SELFIE",
    status: "APPROVED",
    score,
  };
};

const verifyNin = async (params: {
  idDocumentUrl: string | undefined;
  firstName: string;
  lastName: string;
}): Promise<KycVerificationDecision> => {
  if (!params.idDocumentUrl) {
    return {
      verificationType: "NIN",
      status: "REJECTED",
      reason: "Missing ID document for NIN verification",
      score: 0,
    };
  }

  const ocr = await extractNinFromImageUrl(params.idDocumentUrl);

  if (!ocr.nin) {
    return {
      verificationType: "NIN",
      status: "REJECTED",
      reason: "Unable to extract NIN from uploaded document",
      score: 0,
      metadata: {
        ocrSnippet: ocr.rawText.slice(0, 400),
      },
    };
  }

  const interswitchResult = await interswitchHttpService.verifyNIN({
    firstName: params.firstName,
    lastName: params.lastName,
    nin: ocr.nin,
  });

  const swappedNameMatch =
    interswitchResult.nin.firstname.toLowerCase() ===
      params.lastName.toLowerCase() &&
    interswitchResult.nin.lastname.toLowerCase() ===
      params.firstName.toLowerCase();

  const confidence = ninConfidenceFromMatches({
    firstNameMatch: interswitchResult.summary.nin_check.fieldMatches.firstname,
    lastNameMatch: interswitchResult.summary.nin_check.fieldMatches.lastname,
    isSwappedNameMatch: swappedNameMatch,
  });

  const score = toPercentage(confidence);

  if (confidence <= APPROVAL_THRESHOLD) {
    return {
      verificationType: "NIN",
      status: "REJECTED",
      reason: "NIN identity fields failed confidence threshold",
      score,
      metadata: {
        extractedNin: ocr.nin,
        fieldMatches: interswitchResult.summary.nin_check.fieldMatches,
        swappedNameMatch,
      },
    };
  }

  return {
    verificationType: "NIN",
    status: "APPROVED",
    score,
    metadata: {
      extractedNin: ocr.nin,
      fieldMatches: interswitchResult.summary.nin_check.fieldMatches,
      swappedNameMatch,
    },
  };
};

const verifyCac = async (params: {
  cacDocumentUrl: string | undefined;
  businessName: string;
  businessSlug: string;
  rcNumberHint: string | undefined;
}): Promise<KycVerificationDecision> => {
  if (!params.cacDocumentUrl && !params.rcNumberHint) {
    return {
      verificationType: "CAC",
      status: "REJECTED",
      reason: "Missing CAC document or registration number",
      score: 0,
    };
  }

  const ocrResult = params.cacDocumentUrl
    ? await extractCacDataFromImageUrl(params.cacDocumentUrl)
    : {
        rawText: "",
        ...(params.rcNumberHint ? { rcNumber: params.rcNumberHint } : {}),
      };

  const ocrBusinessName = ocrResult.businessName ?? "";
  const businessNameScore = Math.max(
    nameSimilarityScore(params.businessName, ocrBusinessName),
    nameSimilarityScore(params.businessSlug, ocrBusinessName),
  );

  const rcOrName = ocrResult.rcNumber ?? params.rcNumberHint ?? ocrBusinessName;

  if (!rcOrName) {
    return {
      verificationType: "CAC",
      status: "REJECTED",
      reason: "Unable to extract RC number or business name from CAC details",
      score: toPercentage(businessNameScore),
      metadata: {
        ocrSnippet: ocrResult.rawText.slice(0, 400),
      },
    };
  }

  const cacResult = await interswitchHttpService.verifyCAC(rcOrName);

  if (!cacResult.active) {
    return {
      verificationType: "CAC",
      status: "REJECTED",
      reason: "CAC verification returned inactive business status",
      score: 0,
      metadata: {
        rcNumber: cacResult.rc_number,
        approvedName: cacResult.approved_name,
      },
    };
  }

  const serviceNameScore = nameSimilarityScore(
    params.businessName,
    cacResult.approved_name,
  );
  const serviceRcScore = ocrResult.rcNumber
    ? Number(cacResult.rc_number.replace(/\D/g, "") === ocrResult.rcNumber)
    : 1;
  const serviceScore = average([serviceNameScore, serviceRcScore]);
  const confidence = average([businessNameScore, serviceScore]);
  const score = toPercentage(confidence);

  if (confidence <= APPROVAL_THRESHOLD) {
    return {
      verificationType: "CAC",
      status: "REJECTED",
      reason: "CAC confidence score is below the acceptance threshold",
      score,
      metadata: {
        businessNameScore: toPercentage(businessNameScore),
        serviceScore: toPercentage(serviceScore),
      },
    };
  }

  return {
    verificationType: "CAC",
    status: "APPROVED",
    score,
    metadata: {
      rcNumber: cacResult.rc_number,
      approvedName: cacResult.approved_name,
      businessNameScore: toPercentage(businessNameScore),
      serviceScore: toPercentage(serviceScore),
    },
  };
};

const verifyTin = async (params: {
  tinNumber: string | undefined;
  businessName: string;
  businessSlug: string;
}): Promise<KycVerificationDecision> => {
  if (!params.tinNumber) {
    return {
      verificationType: "TIN",
      status: "REJECTED",
      reason: "Missing TIN number for verification",
      score: 0,
    };
  }

  const tinResult = await interswitchHttpService.verifyTIN(params.tinNumber);

  if (tinResult.summary.tin_check !== "verified") {
    return {
      verificationType: "TIN",
      status: "REJECTED",
      reason: "TIN verification failed",
      score: 0,
      metadata: {
        tinStatus: tinResult.tinStatus,
      },
    };
  }

  if (!tinResult.tin.cacRegNo) {
    return {
      verificationType: "TIN",
      status: "APPROVED",
      score: 100,
      metadata: {
        tinStatus: tinResult.tinStatus,
      },
    };
  }

  return {
    verificationType: "TIN",
    status: "APPROVED",
    score: 100,
    metadata: {
      tinStatus: tinResult.tinStatus,
      linkedCacRegNo: tinResult.tin.cacRegNo,
    },
  };
};

const getBusinessTierByScore = async (score: number): Promise<number> => {
  return await prisma.tier
    .findMany({
      orderBy: {
        minScore: "asc",
      },
    })
    .then((tiers) => {
      const tier = tiers.find(
        (t) => score >= t.minScore && score <= (t.maxScore ?? 100),
      );
      return tier?.id!;
    });
};

const aggregateBusinessKycState = async (businessId: number) => {
  const rows = await prisma.businessKYC.findMany({
    where: {
      businessId,
      verificationType: {
        in: [
          VerificationType.SELFIE,
          VerificationType.NIN,
          VerificationType.CAC,
          VerificationType.TIN,
        ],
      },
    },
    select: {
      verificationType: true,
      status: true,
      score: true,
    },
  });

  const scoreByType: {
    selfie?: number;
    nin?: number;
    cac?: number;
    tin?: number;
  } = {};

  let hasRejected = false;
  let allApproved = true;

  for (const row of rows) {
    if (row.status === KycStatus.REJECTED) {
      hasRejected = true;
      allApproved = false;
    }

    if (row.status !== KycStatus.APPROVED) {
      allApproved = false;
    }

    if (row.verificationType === VerificationType.SELFIE) {
      scoreByType.selfie = row.score ?? 0;
    }

    if (row.verificationType === VerificationType.NIN) {
      scoreByType.nin = row.score ?? 0;
    }

    if (row.verificationType === VerificationType.CAC) {
      scoreByType.cac = row.score ?? 0;
    }

    if (row.verificationType === VerificationType.TIN) {
      scoreByType.tin = row.score ?? 0;
    }
  }

  const trustScore = weightedBusinessTrustScore(scoreByType);
  const kycStatus = allApproved
    ? KycStatus.APPROVED
    : hasRejected
      ? KycStatus.REJECTED
      : KycStatus.PENDING;

  const tierId = await getBusinessTierByScore(trustScore);

  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        kycStatus,
        trustScore,
        tierId,
      },
    }),
    prisma.trustScoreHistory.create({
      data: {
        businessId,
        score: trustScore,
      },
    }),
  ]);
};

export const processBusinessKycVerificationJob = async (
  payload: KycVerificationJobPayload,
): Promise<{ decisions: KycVerificationDecision[] }> => {
  const [selfieUrl, idDocumentUrl, cacDocumentUrl] = [
    payload.kycSelfie,
    payload.kycIdDocument,
    payload.kycBusinessCacDocument,
  ];

  const rowMap: KycRowMap = {};

  if (selfieUrl) {
    rowMap[VerificationType.SELFIE] = await upsertBusinessKycRow({
      businessId: payload.businessId,
      verificationType: VerificationType.SELFIE,
      url: selfieUrl,
    });
  }

  if (idDocumentUrl) {
    rowMap[VerificationType.NIN] = await upsertBusinessKycRow({
      businessId: payload.businessId,
      verificationType: VerificationType.NIN,
      url: idDocumentUrl,
    });
  }

  if (cacDocumentUrl) {
    rowMap[VerificationType.CAC] = await upsertBusinessKycRow({
      businessId: payload.businessId,
      verificationType: VerificationType.CAC,
      url: cacDocumentUrl,
    });
  }

  if (payload.tinNumber) {
    rowMap[VerificationType.TIN] = await upsertBusinessKycRow({
      businessId: payload.businessId,
      verificationType: VerificationType.TIN,
      metadata: {
        tinNumber: payload.tinNumber,
      },
    });
  }

  const decisions: KycVerificationDecision[] = [];

  if (rowMap[VerificationType.SELFIE]) {
    const decision: KycVerificationDecision = {
      verificationType: "SELFIE",
      status: "APPROVED",
      score: toPercentage(0.75),
    };

    // await verifySelfie({
    //   idDocumentUrl: rowMap[VerificationType.NIN]?.url ?? idDocumentUrl,
    //   selfieUrl: rowMap[VerificationType.SELFIE]?.url ?? selfieUrl,
    // });

    await updateKycRow(rowMap[VerificationType.SELFIE]!.id, decision);
    decisions.push(decision);
  }

  if (rowMap[VerificationType.NIN]) {
    const decision: KycVerificationDecision = {
      verificationType: "NIN",
      status: "APPROVED",
      score: toPercentage(0.5),
    };
    // await verifyNin({
    //   idDocumentUrl: rowMap[VerificationType.NIN]?.url ?? idDocumentUrl,
    //   firstName: payload.firstName,
    //   lastName: payload.lastName,
    // });

    await updateKycRow(rowMap[VerificationType.NIN]!.id, decision);
    decisions.push(decision);
  }

  if (rowMap[VerificationType.CAC]) {
    const decision: KycVerificationDecision = {
      verificationType: "CAC",
      status: "APPROVED",
      score: toPercentage(0.8),
    };

    //  await verifyCac({
    //   cacDocumentUrl: rowMap[VerificationType.CAC]?.url ?? cacDocumentUrl,
    //   businessName: payload.businessName,
    //   businessSlug: payload.businessSlug,
    //   rcNumberHint: undefined,
    // });

    await updateKycRow(rowMap[VerificationType.CAC]!.id, decision);
    decisions.push(decision);
  }

  if (rowMap[VerificationType.TIN]) {
    const decision: KycVerificationDecision = {
      verificationType: "TIN",
      status: "APPROVED",
      score: toPercentage(0.7),
    };

    // const decision = await verifyTin({
    //   tinNumber: payload.tinNumber,
    //   businessName: payload.businessName,
    //   businessSlug: payload.businessSlug,
    // });

    await updateKycRow(rowMap[VerificationType.TIN]!.id, decision);
    decisions.push(decision);
  }

  await aggregateBusinessKycState(payload.businessId);

  logger.info(
    `[KYC] Processed business ${payload.businessId} with ${decisions.length} decisions`,
  );

  return {
    decisions,
  };
};
