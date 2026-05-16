# VendorProof AI Intelligence Layer Presentation

## 1) Intelligence Stack Overview

VendorProof uses a multi-layer intelligence system for KYC and trust scoring:

1. Document Intelligence Layer

- OCR extraction for NIN and CAC documents
- Field-focused preprocessing and extraction heuristics

2. Biometric Intelligence Layer

- Face descriptor extraction and selfie-to-ID similarity scoring
- Multi-region and multi-variant image search

3. Verification Intelligence Layer

- Identity and business verification via external validation service
- Confidence-based acceptance thresholds

4. Trust Intelligence Layer

- Weighted trust score aggregation from KYC outcomes
- Tier progression and historical trust trajectory

## 2) Model Card Style Summary

### OCR + Layout-Aware Heuristics (Tesseract.js + Sharp)

What it does?

- Extracts NIN, RC number, and business name from uploaded ID/CAC images.
- Uses aggressive preprocessing and multiple OCR passes to recover text from noisy scans.
- Applies field-specific post-processing to pull clean numeric identifiers and entity names.

Why this model?

- The pipeline is optimized for low-quality camera captures and scanned documents.
- Multi-variant preprocessing (normalization, CLAHE, thresholding, grayscale, edge boosts) increases recall on difficult images.
- Rule-based post-processing improves precision for business-critical fields such as NIN and RC/BN values.

Provider

- OCR engine: Tesseract.js (Open Source)
- Image preprocessing: Sharp (Open Source)

Code references

- src/utils/ocr.ts

---

### Face Descriptor Matching (face-api.js with TensorFlow.js)

What it does?

- Matches selfie to ID document face and returns confidence.
- Uses region-aware cropping for document photos and multiple enhancement variants per region.
- Selects the strongest detection candidate with a quality-aware combined score.

Why this model?

- Works directly in the current Node.js backend without custom GPU serving infrastructure.
- Multi-region search and variant generation improve detection reliability for portrait photos embedded in IDs.
- Cosine similarity over descriptors gives a stable, interpretable confidence signal for downstream KYC decisions.

Provider

- Face framework: face-api.js (Open Source)
- Inference runtime: TensorFlow.js (Open Source)
- Detection/landmark/recognition nets loaded from local model files in src/models

Code references

- src/utils/face.ts

---

### Verification Decisioning (Confidence + Threshold Logic)

What it does?

- Combines OCR extraction output and biometric confidence into approve/reject decisions.
- Applies acceptance threshold checks and stores reasons/metadata for explainability.
- Persists verification outcomes per verification type: SELFIE, NIN, CAC, TIN.

Why this model?

- Deterministic thresholding gives transparent and auditable KYC outcomes.
- Per-check metadata supports explainability and user-facing dispute handling.
- Integrates well with asynchronous queue processing for scale.

Provider

- Internal decision logic (VendorProof)
- External validation service adapter: Interswitch integration layer

Code references

- src/services/kyc.service.ts
- src/infra/interswitch/http-service.ts
- src/queues/kyc/kyc.worker.ts

---

### Trust Score Model (Weighted Risk Aggregator)

What it does?

- Converts KYC verification outcomes into a unified business trust score.
- Applies weighted aggregation across selfie, NIN, CAC, and TIN checks.
- Updates business tier and writes trust score history for longitudinal analytics.

Why this model?

- Interpretable, configurable, and easy to govern for regulated workflows.
- Supports partial evidence by recalculating with available signals.
- Fast enough for real-time updates after each KYC event.

Provider

- Internal scoring model (VendorProof)

Code references

- src/utils/kyc-scoring.ts
- src/services/kyc.service.ts
- src/services/analytics.service.ts

## 3) Current Operational Notes

1. Debug artifact observability is enabled in local mode:

- OCR variants save to logs/ocr-debug
- Face variants save to logs/face-debug

2. Real verification functions are implemented but currently bypassed in the job processor:

- In processBusinessKycVerificationJob, placeholder approved scores are used right now.
- verifySelfie, verifyNin, verifyCac, and verifyTin functions exist and are ready for activation.

3. Queue architecture:

- KYC runs asynchronously via BullMQ worker with Redis connection.

## 4) End-to-End Intelligence Flow

1. User uploads selfie, ID document, CAC document, and/or TIN.
2. Queue worker consumes KYC job payload.
3. Document layer extracts NIN/CAC fields via OCR variants.
4. Biometric layer computes selfie-ID face confidence.
5. Verification layer determines per-check outcome with confidence thresholds.
6. Trust layer aggregates scores using weighted model.
7. Tier and trust history are updated and exposed in analytics.

## 5) Explainability Outputs

System-level explainability currently includes:

1. Per-verification score
2. Approval/rejection reason
3. Metadata payloads (for example extracted NIN, field match signals, threshold info)
4. Trust score history over time

This provides a clear audit trail from raw uploaded evidence to final trust score decisions.

## 6) Optional Next-Phase Model Upgrades

If you want a more advanced model stack, the next evolution can be:

1. LayoutLMv3 fine-tuned document model

- Better layout-sensitive extraction versus OCR + rules alone

2. AdaFace or ArcFace-based face model

- Improved robustness for low-quality selfie vs ID comparisons

3. Gradient-boosted trust model (for example XGBoost)

- Non-linear signal fusion and feature importance at scale

These upgrades can be layered on top of the current architecture without replacing the queue, storage, or analytics foundation.
