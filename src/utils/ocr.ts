import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { env } from "../config/env";

export type CacOcrResult = {
  businessName?: string;
  rcNumber?: string;
  rawText: string;
};

type OcrVariant = {
  name: string;
  image: Buffer;
};

type OcrAttempt = {
  text: string;
  score: number;
};

type OcrWord = {
  text?: string;
  bbox?: {
    x0?: number;
    x1?: number;
    y0?: number;
    y1?: number;
  };
};

type NinFieldVariant = {
  name: string;
  image: Buffer;
};

const OCR_DEBUG_DIR = process.env["OCR_DEBUG_DIR"]
  ? path.resolve(process.cwd(), process.env["OCR_DEBUG_DIR"])
  : path.resolve(process.cwd(), "logs/ocr-debug");

const shouldSaveDebugImages = (): boolean => {
  return env.NODE_ENV.toLowerCase() === "local";
};

const toSafeLabel = (value: string): string => {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-{2,}/g, "-");
};

const saveDebugVariants = async (params: {
  scope: "nin" | "cac";
  sourceUrl: string;
  original: Buffer;
  variants: Array<{ name: string; image: Buffer }>;
}) => {
  if (!shouldSaveDebugImages()) {
    return;
  }

  const sourceName = (() => {
    try {
      const pathname = new URL(params.sourceUrl).pathname;
      const last = pathname.split("/").filter(Boolean).slice(-1)[0] ?? "image";
      return toSafeLabel(last);
    } catch {
      return "image";
    }
  })();

  const runLabel = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outDir = path.join(
    OCR_DEBUG_DIR,
    params.scope,
    `${sourceName}-${runLabel}`,
  );
  await fs.mkdir(outDir, { recursive: true });

  await sharp(params.original)
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(path.join(outDir, "00-original.jpg"));

  for (const [index, variant] of params.variants.entries()) {
    const indexLabel = String(index + 1).padStart(2, "0");
    const fileName = `${indexLabel}-${toSafeLabel(variant.name)}.jpg`;
    await sharp(variant.image)
      .jpeg({ quality: 95, mozjpeg: true })
      .toFile(path.join(outDir, fileName));
  }

  console.log(
    `[OCR_DEBUG] Saved ${params.scope.toUpperCase()} variants to ${outDir}`,
  );
};

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
};

const sanitizeOcrText = (text: string): string => {
  return text
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\t\f\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
};

const normalizeDigitLikeChars = (value: string): string => {
  return value
    .replace(/[Oo]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Zz]/g, "2")
    .replace(/[Gg]/g, "6")
    .replace(/[Tt]/g, "7")
    .replace(/[Aa]/g, "4")
    .replace(/[B]/g, "8");
};

const mergeOcrCandidates = (texts: string[]): string => {
  const unique = new Set<string>();

  for (const text of texts) {
    for (const line of text.split(/\n+/)) {
      const cleaned = sanitizeOcrText(line);
      if (cleaned.length >= 3) {
        unique.add(cleaned);
      }
    }
  }

  return Array.from(unique).join("\n");
};

const preprocessForOcrVariants = async (
  source: Buffer,
): Promise<OcrVariant[]> => {
  const base = sharp(source)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 3000, fit: "inside", withoutEnlargement: false })
    .median(1)
    .sharpen({ sigma: 1.2, m1: 0.9, m2: 1.2, x1: 2, y2: 10, y3: 20 });

  const balanced = await base.clone().normalize().toBuffer();
  const highContrast = await base
    .clone()
    .grayscale()
    .normalize()
    .linear(1.35, -(255 * 0.1))
    .threshold(150)
    .toBuffer();
  const adaptiveLight = await base
    .clone()
    .grayscale()
    .clahe({ width: 8, height: 8, maxSlope: 3 })
    .normalize()
    .threshold(118)
    .toBuffer();
  const adaptiveDark = await base
    .clone()
    .grayscale()
    .clahe({ width: 8, height: 8, maxSlope: 3 })
    .normalize()
    .threshold(168)
    .toBuffer();
  const textInk = await base
    .clone()
    .grayscale()
    .normalize()
    .linear(1.2, -(255 * 0.08))
    .threshold()
    .toBuffer();

  return [
    { name: "balanced", image: balanced },
    { name: "high-contrast", image: highContrast },
    { name: "adaptive-light", image: adaptiveLight },
    { name: "adaptive-dark", image: adaptiveDark },
    { name: "text-ink", image: textInk },
  ];
};

const preprocessNinFieldVariants = async (
  source: Buffer,
): Promise<NinFieldVariant[]> => {
  const metadata = await sharp(source).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    return [];
  }

  const regions: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }> = [
    {
      left: 0,
      top: Math.floor(height * 0.14),
      width: Math.ceil(width * 0.72),
      height: Math.ceil(height * 0.52),
    },
    {
      left: 0,
      top: Math.floor(height * 0.2),
      width: Math.ceil(width * 0.56),
      height: Math.ceil(height * 0.24),
    },
    {
      left: Math.floor(width * 0.02),
      top: Math.floor(height * 0.23),
      width: Math.ceil(width * 0.5),
      height: Math.ceil(height * 0.14),
    },
    {
      left: Math.floor(width * 0.02),
      top: Math.floor(height * 0.25),
      width: Math.ceil(width * 0.46),
      height: Math.ceil(height * 0.11),
    },
    {
      left: Math.floor(width * 0.08),
      top: Math.floor(height * 0.24),
      width: Math.ceil(width * 0.36),
      height: Math.ceil(height * 0.1),
    },
  ];

  const variants: NinFieldVariant[] = [];

  for (const [index, region] of regions.entries()) {
    const extracted = sharp(source)
      .extract({
        left: Math.max(0, Math.min(region.left, width - 1)),
        top: Math.max(0, Math.min(region.top, height - 1)),
        width: Math.max(1, Math.min(region.width, width - region.left)),
        height: Math.max(1, Math.min(region.height, height - region.top)),
      })
      .flatten({ background: "#ffffff" })
      .resize({ width: 3600, withoutEnlargement: false })
      .grayscale()
      .median(1)
      .normalize()
      .clahe({ width: 8, height: 8, maxSlope: 5 });

    const soft = await extracted
      .clone()
      .sharpen({ sigma: 1.1, m1: 0.85, m2: 1.1, x1: 2, y2: 8, y3: 14 })
      .toBuffer();
    const normal = await extracted
      .clone()
      .linear(1.12, -(255 * 0.04))
      .threshold(125)
      .toBuffer();
    const hard = await extracted.clone().threshold(155).toBuffer();
    const otsu = await extracted.clone().threshold().toBuffer();
    const edgeBoost = await extracted
      .clone()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      })
      .threshold(120)
      .toBuffer();
    const inverted = await extracted
      .clone()
      .negate()
      .linear(1.25, -(255 * 0.08))
      .threshold(136)
      .toBuffer();

    variants.push({ name: `nin-region-${index + 1}-soft`, image: soft });
    variants.push({ name: `nin-region-${index + 1}-normal`, image: normal });
    variants.push({ name: `nin-region-${index + 1}-hard`, image: hard });
    variants.push({ name: `nin-region-${index + 1}-otsu`, image: otsu });
    variants.push({
      name: `nin-region-${index + 1}-edge-boost`,
      image: edgeBoost,
    });
    variants.push({
      name: `nin-region-${index + 1}-inverted`,
      image: inverted,
    });
  }

  return variants;
};

const ocrScore = (text: string): number => {
  const cleaned = sanitizeOcrText(text);
  const alphaNumCount = (cleaned.match(/[A-Za-z0-9]/g) ?? []).length;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return alphaNumCount + wordCount * 1.5;
};

const scoreNinCandidate = (candidate: string): number => {
  let score = 0;

  if (/national\s+identity\s+management\s+system/i.test(candidate)) {
    score += 12;
  }

  if (/\bN[Il]N\b/i.test(candidate)) {
    score += 20;
  }

  const numericRuns = candidate.match(/(?<!\d)\d{10,12}(?!\d)/g) ?? [];
  score += numericRuns.length * 10;

  return score;
};

const scoreCacCandidate = (candidate: string): number => {
  let score = 0;

  if (/certificate\s+of\s+incorporation/i.test(candidate)) {
    score += 18;
  }

  if (/corporate\s+affairs\s+commission/i.test(candidate)) {
    score += 10;
  }

  if (/\b(?:RC|BN|REG(?:ISTRATION)?\s*NO)/i.test(candidate)) {
    score += 16;
  }

  return score;
};

const extractNinFromWordList = (words: OcrWord[]): string | undefined => {
  for (const [index, currentWord] of words.entries()) {
    const text = currentWord.text ?? "";
    if (!/^(N[Il]N|NIN:)$/i.test(text.replace(/\s+/g, ""))) {
      continue;
    }

    const y0 = currentWord.bbox?.y0 ?? 0;
    const y1 = currentWord.bbox?.y1 ?? y0;
    const rowCenter = (y0 + y1) / 2;
    const x0 = currentWord.bbox?.x0 ?? 0;

    const sameRow = words
      .slice(index)
      .filter((word) => {
        const by0 = word.bbox?.y0 ?? 0;
        const by1 = word.bbox?.y1 ?? by0;
        const center = (by0 + by1) / 2;
        const bx0 = word.bbox?.x0 ?? 0;
        return Math.abs(center - rowCenter) <= 18 && bx0 >= x0;
      })
      .sort((left, right) => (left.bbox?.x0 ?? 0) - (right.bbox?.x0 ?? 0));

    const candidate = normalizeDigitLikeChars(
      sameRow.map((word) => word.text ?? "").join(" "),
    );
    const digits = candidate.replace(/\D/g, "");

    if (digits.length >= 11) {
      return digits.slice(0, 11);
    }
  }

  return undefined;
};

const toCandidateBusinessName = (line: string): string => {
  return line
    .replace(/^\W+|\W+$/g, "")
    .replace(/^\d+\s+/g, "")
    .replace(/^(?:[iIl1]\s+)+/g, "")
    .replace(/(?:\s+[iIl1])+$/g, "")
    .replace(/\s+[A-Za-z]$/g, "")
    .replace(/\bLIVED\b/gi, "LIMITED")
    .replace(/\bLISTED\b/gi, "LIMITED")
    .replace(/\bLMITED\b/gi, "LIMITED")
    .replace(/\bLIM\s*TED\b/gi, "LIMITED")
    .replace(/\bSERYICES\b/gi, "SERVICES")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const extractLikelyBusinessNameFromLines = (
  text: string,
): string | undefined => {
  const lines = text
    .split(/\n+/)
    .map((line) => toCandidateBusinessName(line))
    .filter(Boolean);

  const scored = lines
    .map((line) => {
      let score = 0;

      if (/\b(LIMITED|LTD|PLC)\b/i.test(line)) {
        score += 30;
      }

      const wordCount = line.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 2 && wordCount <= 8) {
        score += 8;
      }

      if (/^[A-Z0-9 '&,.-]+$/i.test(line)) {
        score += 6;
      }

      if (line.length >= 12) {
        score += 4;
      }

      if (
        /\b(day|hand|given|under|registrar|commission|certificate|federal|republic)\b/i.test(
          line,
        )
      ) {
        score -= 15;
      }

      if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(line)) {
        score -= 8;
      }

      return { line, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score < 22) {
    return undefined;
  }

  return best.line;
};

const recognizeBestText = async (image: Buffer): Promise<string> => {
  const variants = await preprocessForOcrVariants(image);
  const worker = await createWorker("eng");
  const psmModes = [PSM.SINGLE_BLOCK, PSM.AUTO, PSM.SPARSE_TEXT];

  try {
    const attempts: OcrAttempt[] = [];

    for (const psm of psmModes) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: psm,
        tessedit_char_blacklist: "`~^",
        user_defined_dpi: "300",
      });

      for (const variant of variants) {
        const result = await worker.recognize(variant.image);
        const text = sanitizeOcrText(result.data.text);
        attempts.push({ text, score: ocrScore(text) });
      }
    }

    const sorted = attempts.sort((left, right) => right.score - left.score);
    const top = sorted.slice(0, 3).map((entry) => entry.text);
    return mergeOcrCandidates(top);
  } finally {
    await worker.terminate();
  }
};

export const extractOcrTextFromImageUrl = async (
  url: string,
): Promise<string> => {
  const image = await downloadImage(url);
  return recognizeBestText(image);
};

export const extractNinFromText = (text: string): string | undefined => {
  const cleaned = normalizeDigitLikeChars(sanitizeOcrText(text));

  const labelMatch = cleaned.match(
    /(?:^|\b)N[Il]N\s*[:\-=.]?\s*([A-Z0-9\s]{9,18})/i,
  );

  if (labelMatch?.[1]) {
    const digits = normalizeDigitLikeChars(labelMatch[1]).replace(/\D/g, "");
    if (digits.length >= 11) {
      return digits.slice(0, 11);
    }
  }

  const matches = cleaned.match(/(?<!\d)\d{10,13}(?!\d)/g);

  if (!matches?.length) {
    return undefined;
  }

  const exact = matches.find((value) => value.length === 11);
  if (exact) {
    return exact;
  }

  const sorted = [...matches].sort(
    (left, right) => Math.abs(left.length - 11) - Math.abs(right.length - 11),
  );

  const best = sorted[0];
  if (!best) {
    return undefined;
  }

  if (best.length > 11) {
    return best.slice(0, 11);
  }

  if (best.length === 10) {
    return `0${best}`;
  }

  return undefined;
};

export const extractNinFromImageUrl = async (
  url: string,
): Promise<{ nin?: string; rawText: string }> => {
  const image = await downloadImage(url);
  const variants = await preprocessForOcrVariants(image);
  const ninFieldVariants = await preprocessNinFieldVariants(image);

  await saveDebugVariants({
    scope: "nin",
    sourceUrl: url,
    original: image,
    variants: [...variants, ...ninFieldVariants],
  });
  const worker = await createWorker("eng");

  let rawText = "";
  let strongestNinCandidate: string | undefined;

  try {
    const attempts: OcrAttempt[] = [];

    for (const variant of variants) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_blacklist: "`~^",
        user_defined_dpi: "300",
      });

      const result = await worker.recognize(variant.image);
      const text = sanitizeOcrText(result.data.text);
      const ninFromText = extractNinFromText(text);
      if (ninFromText && !strongestNinCandidate) {
        strongestNinCandidate = ninFromText;
      }
      attempts.push({
        text,
        score: ocrScore(text) + scoreNinCandidate(text),
      });

      const ninFromWords = extractNinFromWordList(
        (result.data as unknown as { words?: OcrWord[] }).words ?? [],
      );
      if (ninFromWords) {
        if (!strongestNinCandidate) {
          strongestNinCandidate = ninFromWords;
        }
        attempts.push({ text: ninFromWords, score: 1000 });
      }

      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_blacklist: "`~^",
        user_defined_dpi: "300",
      });

      const sparseResult = await worker.recognize(variant.image);
      const sparseText = sanitizeOcrText(sparseResult.data.text);
      const ninFromSparseText = extractNinFromText(sparseText);
      if (ninFromSparseText && !strongestNinCandidate) {
        strongestNinCandidate = ninFromSparseText;
      }
      attempts.push({
        text: sparseText,
        score: ocrScore(sparseText) + scoreNinCandidate(sparseText),
      });

      const ninFromSparseWords = extractNinFromWordList(
        (sparseResult.data as unknown as { words?: OcrWord[] }).words ?? [],
      );
      if (ninFromSparseWords) {
        if (!strongestNinCandidate) {
          strongestNinCandidate = ninFromSparseWords;
        }
        attempts.push({ text: ninFromSparseWords, score: 1000 });
      }
    }

    for (const variant of ninFieldVariants) {
      for (const psm of [
        PSM.SINGLE_LINE,
        PSM.SINGLE_WORD,
        PSM.SINGLE_BLOCK,
        PSM.SPARSE_TEXT,
      ]) {
        await worker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: psm,
          tessedit_char_whitelist: "0123456789OIlSZGTA",
          user_defined_dpi: "300",
        });

        const result = await worker.recognize(variant.image);
        const text = sanitizeOcrText(result.data.text);
        const ninFromText = extractNinFromText(text);
        if (ninFromText && !strongestNinCandidate) {
          strongestNinCandidate = ninFromText;
        }
        attempts.push({
          text,
          score: ocrScore(text) + scoreNinCandidate(text) + 35,
        });

        const ninFromWords = extractNinFromWordList(
          (result.data as unknown as { words?: OcrWord[] }).words ?? [],
        );
        if (ninFromWords) {
          if (!strongestNinCandidate) {
            strongestNinCandidate = ninFromWords;
          }
          attempts.push({ text: ninFromWords, score: 1000 });
        }
      }
    }

    const sorted = attempts.sort((left, right) => right.score - left.score);
    rawText = mergeOcrCandidates(sorted.slice(0, 4).map((entry) => entry.text));
  } finally {
    await worker.terminate();
  }

  const nin = strongestNinCandidate ?? extractNinFromText(rawText);

  const result: { nin?: string; rawText: string } = {
    rawText,
  };

  if (nin) {
    result.nin = nin;
  }

  return result;
};

export const extractCacDataFromText = (text: string): CacOcrResult => {
  const sanitized = sanitizeOcrText(text);
  const normalized = sanitized.replace(/\s+/g, " ");

  const certText = normalized.replace(/\bLIVED\b/gi, "LIMITED");
  const certLineText = sanitized
    .replace(/\bLIVED\b/gi, "LIMITED")
    .replace(/\bLISTED\b/gi, "LIMITED")
    .replace(/\bLMITED\b/gi, "LIMITED");

  const rcMatches = Array.from(
    certText.matchAll(
      /\b(?:R\s*[CG]|RC|BN|REG(?:ISTRATION)?\s*NO\.?|RC\s*NO\.?)\s*[:#\-]?\s*(\d{5,10})\b/gi,
    ),
  )
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const pickBestRcCandidate = (candidates: string[]): string | undefined => {
    if (!candidates.length) {
      return undefined;
    }

    const counts = new Map<string, number>();
    for (const value of candidates) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => {
        const byCount = right[1] - left[1];
        if (byCount !== 0) {
          return byCount;
        }

        const leftDistance = Math.abs(left[0].length - 7);
        const rightDistance = Math.abs(right[0].length - 7);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return right[0].length - left[0].length;
      })
      .map(([value]) => value)[0];
  };

  const nameMatch = certText.match(
    /(?:company\s*name|business\s*name|registered\s*name)\s*[:\-]?\s*([a-z0-9 '&,.\-]{3,80})/i,
  );

  const certifyThatMatch = certText.match(
    /(?:certif\w*|exetif\w*)\s+that\s+([a-z0-9 '&,.\-]{5,120}?)(?:\s+is\s+this\s+day|\s+under\s+the|\s+given\s+under|\.)/i,
  );

  const result: CacOcrResult = {
    rawText: text,
  };

  const likelyBusinessName = extractLikelyBusinessNameFromLines(certLineText);

  const bestRcCandidate = pickBestRcCandidate(rcMatches);
  if (bestRcCandidate) {
    result.rcNumber = bestRcCandidate;
  }

  if (likelyBusinessName && /\b(LIMITED|LTD|PLC)\b/i.test(likelyBusinessName)) {
    result.businessName = likelyBusinessName;
  } else if (nameMatch?.[1]?.trim()) {
    result.businessName = nameMatch[1].trim();
  } else if (certifyThatMatch?.[1]?.trim()) {
    result.businessName = certifyThatMatch[1].trim();
  } else {
    const fallbackBusinessName =
      extractLikelyBusinessNameFromLines(certLineText);
    if (fallbackBusinessName) {
      result.businessName = fallbackBusinessName;
    }
  }

  if (!result.rcNumber) {
    const numericCandidates = certText.match(/(?<!\d)\d{6,8}(?!\d)/g) ?? [];
    const filtered = numericCandidates.filter(
      (value) => value !== "1990" && value !== "2018" && value !== "2025",
    );

    if (filtered[0]) {
      result.rcNumber = filtered[0];
    }
  }

  return result;
};

export const extractCacDataFromImageUrl = async (
  url: string,
): Promise<CacOcrResult> => {
  const image = await downloadImage(url);
  const variants = await preprocessForOcrVariants(image);
  await saveDebugVariants({
    scope: "cac",
    sourceUrl: url,
    original: image,
    variants,
  });
  const worker = await createWorker("eng");

  try {
    const attempts: OcrAttempt[] = [];

    for (const variant of variants) {
      for (const psm of [PSM.SINGLE_BLOCK, PSM.AUTO, PSM.SPARSE_TEXT]) {
        await worker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: psm,
          tessedit_char_blacklist: "`~^",
          user_defined_dpi: "300",
        });

        const result = await worker.recognize(variant.image);
        const text = sanitizeOcrText(result.data.text);
        attempts.push({
          text,
          score: ocrScore(text) + scoreCacCandidate(text),
        });
      }
    }

    const sorted = attempts.sort((left, right) => right.score - left.score);
    const rawText = mergeOcrCandidates(
      sorted.slice(0, 4).map((entry) => entry.text),
    );

    return extractCacDataFromText(rawText);
  } finally {
    await worker.terminate();
  }
};
