type WeightedScoreInput = {
  selfie?: number;
  nin?: number;
  cac?: number;
  tin?: number;
};

export const KYC_WEIGHTS = {
  selfie: 10,
  nin: 10,
  cac: 20,
  tin: 10,
} as const;

const clamp = (value: number, min = 0, max = 1): number => {
  return Math.min(max, Math.max(min, value));
};

export const toPercentage = (value: number): number => {
  return Math.round(clamp(value) * 10000) / 100;
};

const normalize = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

const levenshteinDistance = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;

  const dp: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );

  for (let i = 0; i < rows; i += 1) {
    dp[i]![0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    dp[0]![j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[a.length]![b.length]!;
};

export const nameSimilarityScore = (left: string, right: string): number => {
  const a = normalize(left);
  const b = normalize(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const distance = levenshteinDistance(a, b);
  const longest = Math.max(a.length, b.length);

  return clamp(1 - distance / longest);
};

export const ninConfidenceFromMatches = (params: {
  firstNameMatch: boolean;
  lastNameMatch: boolean;
  isSwappedNameMatch: boolean;
}): number => {
  const { firstNameMatch, lastNameMatch, isSwappedNameMatch } = params;

  if (firstNameMatch && lastNameMatch) {
    return 1;
  }

  if (isSwappedNameMatch) {
    return 0.7;
  }

  if (firstNameMatch || lastNameMatch) {
    return 0.5;
  }

  return 0;
};

export const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const weightedBusinessTrustScore = (
  input: WeightedScoreInput,
): number => {
  const entries = [
    ["selfie", input.selfie, KYC_WEIGHTS.selfie],
    ["nin", input.nin, KYC_WEIGHTS.nin],
    ["cac", input.cac, KYC_WEIGHTS.cac],
    ["tin", input.tin, KYC_WEIGHTS.tin],
  ] as const;

  const available = entries.filter(([, score]) => typeof score === "number");

  if (!available.length) {
    return 0;
  }

  const totalWeight = available.reduce((sum, [, , weight]) => sum + weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const weighted = available.reduce((sum, [, score, weight]) => {
    return sum + (clamp((score ?? 0) / 100, 0, 1) * weight) / totalWeight;
  }, 0);

  return toPercentage(weighted);
};
