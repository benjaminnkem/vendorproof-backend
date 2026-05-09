import fs from "node:fs/promises";
import path from "path";
import sharp from "sharp";
import * as canvas from "canvas";
import "@tensorflow/tfjs";
import * as faceapiModule from "face-api.js";
import { env } from "../config/env";

let modelsLoaded = false;

type FaceDescriptor = Float32Array;

type FaceDetectionResult = {
  descriptor: FaceDescriptor;
  score: number;
};

type FaceVariant = {
  label: string;
  image: Buffer;
};

type FaceRegionCandidate = {
  label: string;
  image: Buffer;
  bonus: number;
};

type DetectionWithDescriptor = {
  descriptor: FaceDescriptor;
  detection?: {
    score?: number;
    box?: {
      width?: number;
      height?: number;
    };
  };
};

const FACE_DEBUG_DIR = process.env["FACE_DEBUG_DIR"]
  ? path.resolve(process.cwd(), process.env["FACE_DEBUG_DIR"])
  : path.resolve(process.cwd(), "logs/face-debug");

const shouldSaveFaceDebug = (): boolean => {
  return env.NODE_ENV.toLowerCase() === "local";
};

const toSafeLabel = (value: string): string => {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-{2,}/g, "-");
};

const saveFaceDebugVariants = async (params: {
  sourceUrl: string;
  original: Buffer;
  variants: Array<{ name: string; image: Buffer }>;
}) => {
  if (!shouldSaveFaceDebug()) {
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
  const outDir = path.join(FACE_DEBUG_DIR, `${sourceName}-${runLabel}`);
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

  console.log(`[FACE_DEBUG] Saved variants to ${outDir}`);
};

const asArray = (descriptor: FaceDescriptor): number[] => {
  return Array.from(descriptor);
};

const cosineSimilarity = (
  left: FaceDescriptor,
  right: FaceDescriptor,
): number => {
  const a = asArray(left);
  const b = asArray(right);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const leftValue = a[index] ?? 0;
    const rightValue = b[index] ?? 0;
    dot += leftValue * rightValue;
    normA += leftValue * leftValue;
    normB += rightValue * rightValue;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
};

const toDetectionCanvas = async (
  imageBuffer: Buffer,
): Promise<canvas.Canvas> => {
  const loaded = await canvas.loadImage(imageBuffer);
  const drawingCanvas = canvas.createCanvas(loaded.width, loaded.height);
  const context = drawingCanvas.getContext("2d");
  context.drawImage(loaded, 0, 0, loaded.width, loaded.height);
  return drawingCanvas;
};

const buildFaceRegionCandidates = async (
  source: Buffer,
): Promise<FaceRegionCandidate[]> => {
  const metadata = await sharp(source).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    return [
      {
        label: "original",
        image: source,
        bonus: 0,
      },
    ];
  }

  const isLikelyDocument = width / height > 1.2;

  const regions: Array<{
    label: string;
    left: number;
    top: number;
    width: number;
    height: number;
    bonus: number;
  }> = isLikelyDocument
    ? [
        {
          label: "doc-right-portrait-a",
          left: Math.floor(width * 0.58),
          top: Math.floor(height * 0.08),
          width: Math.ceil(width * 0.4),
          height: Math.ceil(height * 0.58),
          bonus: 0.2,
        },
        {
          label: "doc-right-portrait-b",
          left: Math.floor(width * 0.62),
          top: Math.floor(height * 0.12),
          width: Math.ceil(width * 0.33),
          height: Math.ceil(height * 0.48),
          bonus: 0.18,
        },
        {
          label: "doc-right-portrait-c",
          left: Math.floor(width * 0.68),
          top: Math.floor(height * 0.12),
          width: Math.ceil(width * 0.28),
          height: Math.ceil(height * 0.46),
          bonus: 0.15,
        },
        {
          label: "right-half",
          left: Math.floor(width * 0.5),
          top: 0,
          width: Math.ceil(width * 0.5),
          height: Math.ceil(height * 0.75),
          bonus: 0.08,
        },
      ]
    : [
        {
          label: "right-half",
          left: Math.floor(width * 0.5),
          top: 0,
          width: Math.ceil(width * 0.5),
          height: Math.ceil(height * 0.75),
          bonus: 0.08,
        },
        {
          label: "left-half",
          left: 0,
          top: 0,
          width: Math.ceil(width * 0.5),
          height: Math.ceil(height * 0.75),
          bonus: 0,
        },
        {
          label: "center-window",
          left: Math.floor(width * 0.15),
          top: Math.floor(height * 0.05),
          width: Math.ceil(width * 0.7),
          height: Math.ceil(height * 0.85),
          bonus: 0.03,
        },
      ];

  if (isLikelyDocument) {
    regions.push({
      label: "center-window",
      left: Math.floor(width * 0.15),
      top: Math.floor(height * 0.05),
      width: Math.ceil(width * 0.7),
      height: Math.ceil(height * 0.85),
      bonus: 0.03,
    });
  }

  const candidates: FaceRegionCandidate[] = [
    {
      label: "original",
      image: source,
      bonus: 0,
    },
  ];

  for (const region of regions) {
    const crop = await sharp(source)
      .extract({
        left: Math.max(0, Math.min(region.left, width - 1)),
        top: Math.max(0, Math.min(region.top, height - 1)),
        width: Math.max(1, Math.min(region.width, width - region.left)),
        height: Math.max(1, Math.min(region.height, height - region.top)),
      })
      .flatten({ background: "#ffffff" })
      .resize({ width: 1700, withoutEnlargement: false })
      .toBuffer();

    candidates.push({
      label: region.label,
      image: crop,
      bonus: region.bonus,
    });
  }

  return candidates;
};

const buildFaceVariants = async (source: Buffer): Promise<FaceVariant[]> => {
  const base = sharp(source)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1500, withoutEnlargement: false })
    .sharpen({ sigma: 1.1, m1: 0.8, m2: 1.1, x1: 2, y2: 10, y3: 20 });

  const natural = await base.clone().toBuffer();
  const normalized = await base.clone().normalize().toBuffer();
  const gray = await base.clone().grayscale().normalize().toBuffer();
  const grayClahe = await base
    .clone()
    .grayscale()
    .clahe({ width: 8, height: 8, maxSlope: 3 })
    .normalize()
    .toBuffer();
  const highContrast = await base
    .clone()
    .grayscale()
    .normalize()
    .linear(1.18, -(255 * 0.08))
    .toBuffer();
  const denoiseSharp = await base.clone().median(1).normalize().toBuffer();

  return [
    { label: "natural", image: natural },
    { label: "normalized", image: normalized },
    { label: "gray", image: gray },
    { label: "high-contrast", image: highContrast },
    { label: "denoise-sharp", image: denoiseSharp },
    { label: "gray-clahe", image: grayClahe },
  ];
};

const estimateImageQuality = async (
  image: Buffer,
): Promise<{ sharpness: number; dynamicRange: number }> => {
  const stats = await sharp(image).grayscale().stats();
  const entropy = stats.entropy;
  const channel = stats.channels[0] ?? { min: 0, max: 255 };
  const dynamicRange = (channel?.max - channel?.min) / 255;
  return {
    sharpness: Math.min(1, entropy / 7),
    dynamicRange,
  };
};

const resolveModelPath = (): string => {
  const value = process.env["FACE_MODEL_DIR"];

  if (value && value.trim()) {
    return path.resolve(process.cwd(), value);
  }

  return path.resolve(process.cwd(), "src/models");
};

const ensureModelsLoaded = async () => {
  if (modelsLoaded) {
    return;
  }

  const faceapi = faceapiModule as unknown as {
    env: { monkeyPatch: (input: Record<string, unknown>) => void };
    nets: {
      ssdMobilenetv1: { loadFromDisk: (modelPath: string) => Promise<void> };
      faceLandmark68Net: { loadFromDisk: (modelPath: string) => Promise<void> };
      faceRecognitionNet: {
        loadFromDisk: (modelPath: string) => Promise<void>;
      };
    };
  };

  faceapi.env.monkeyPatch({
    Canvas: canvas.Canvas,
    Image: canvas.Image,
    ImageData: canvas.ImageData,
  });

  const modelPath = resolveModelPath();

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
  ]);

  modelsLoaded = true;
};

const detectDescriptorFromUrl = async (
  url: string,
): Promise<FaceDetectionResult | undefined> => {
  await ensureModelsLoaded();

  const source = await downloadImage(url);
  const regionCandidates = await buildFaceRegionCandidates(source);
  const debugVariants: Array<{ name: string; image: Buffer }> =
    regionCandidates.map((candidate, index) => ({
      name: `region-${String(index + 1).padStart(2, "0")}-${candidate.label}`,
      image: candidate.image,
    }));
  const detectionOptionsList = [
    new faceapiModule.SsdMobilenetv1Options({
      minConfidence: 0.12,
      maxResults: 5,
    }),
    new faceapiModule.SsdMobilenetv1Options({
      minConfidence: 0.06,
      maxResults: 8,
    }),
  ];

  let bestResult: FaceDetectionResult | undefined;
  let detectionAttempts = 0;
  const maxDetectionAttempts = 36;
  let shouldExitEarly = false;

  for (const candidate of regionCandidates) {
    if (detectionAttempts >= maxDetectionAttempts) {
      break;
    }

    const variants = await buildFaceVariants(candidate.image);
    for (const variant of variants) {
      debugVariants.push({
        name: `variant-${candidate.label}-${variant.label}`,
        image: variant.image,
      });
    }

    for (const variant of variants) {
      if (detectionAttempts >= maxDetectionAttempts) {
        break;
      }

      const image = await toDetectionCanvas(variant.image);
      const quality = await estimateImageQuality(variant.image);
      const imageArea = Math.max(1, image.width * image.height);

      for (const detectionOptions of detectionOptionsList) {
        if (detectionAttempts >= maxDetectionAttempts) {
          break;
        }

        detectionAttempts += 1;
        const detections = (await faceapiModule
          .detectAllFaces(
            image as unknown as HTMLCanvasElement,
            detectionOptions,
          )
          .withFaceLandmarks()
          .withFaceDescriptors()) as unknown as DetectionWithDescriptor[];

        if (!detections.length) {
          continue;
        }

        for (const detection of detections) {
          if (!detection?.descriptor) {
            continue;
          }

          const detectionScore = detection.detection?.score ?? 0.5;
          const boxWidth = detection.detection?.box?.width ?? 0;
          const boxHeight = detection.detection?.box?.height ?? 0;
          const areaRatio = Math.min(
            1,
            ((boxWidth * boxHeight) / imageArea) * 9,
          );
          const combinedScore =
            detectionScore * 0.6 +
            areaRatio * 0.2 +
            quality.sharpness * 0.1 +
            quality.dynamicRange * 0.05 +
            candidate.bonus * 0.05;

          if (!bestResult || combinedScore > bestResult.score) {
            bestResult = {
              descriptor: detection.descriptor,
              score: combinedScore,
            };

            if (combinedScore >= 0.82) {
              shouldExitEarly = true;
              break;
            }
          }
        }

        if (shouldExitEarly) {
          break;
        }
      }

      if (shouldExitEarly) {
        break;
      }
    }

    if (shouldExitEarly) {
      break;
    }
  }

  await saveFaceDebugVariants({
    sourceUrl: url,
    original: source,
    variants: debugVariants,
  });

  return bestResult;
};

export const verifyFaceMatch = async (params: {
  sourceImageUrl: string;
  targetImageUrl: string;
}): Promise<{ confidence: number; reason?: string }> => {
  const sourceDescriptor = await detectDescriptorFromUrl(params.sourceImageUrl);

  if (!sourceDescriptor) {
    return {
      confidence: 0,
      reason: "Face was not detected in the uploaded ID image",
    };
  }

  const targetDescriptor = await detectDescriptorFromUrl(params.targetImageUrl);

  if (!targetDescriptor) {
    return {
      confidence: 0,
      reason: "Face was not detected in the uploaded selfie image",
    };
  }

  const similarity = cosineSimilarity(
    sourceDescriptor.descriptor,
    targetDescriptor.descriptor,
  );

  // Sharper mapping keeps weak similarities low while preserving very strong matches.
  const normalized = Math.max(0, Math.min(1, (similarity - 0.25) / 0.75));
  const confidence = Math.pow(normalized, 0.75);

  return {
    confidence,
  };
};
