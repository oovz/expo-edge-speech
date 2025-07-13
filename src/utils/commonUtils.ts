/**
 * Common utility functions shared across the application.
 * Consolidated from duplicated implementations to maintain DRY principle.
 */

import * as Crypto from "expo-crypto";
import { SpeechOptions, SpeechError } from "../types";
import { MAX_TEXT_LENGTH, PARAMETER_RANGES, DEFAULT_VOICE } from "../constants";

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Generate unique connection ID using UUID v4 without dashes (32 character string)
 * Consolidated from duplicated implementations in connectionManager.ts, networkService.ts, and state.ts
 */
export function generateConnectionId(): string {
  return Crypto.randomUUID().replace(/-/g, "").toLowerCase();
}

/**
 * Generate RFC 3339 timestamp with microseconds
 * Used for message timestamps in Edge TTS protocol
 */
export function generateTimestamp(): string {
  const now = new Date();
  const isoString = now.toISOString();
  // Add microseconds (always 000 since JavaScript doesn't have microsecond precision)
  return isoString.replace("Z", "000Z");
}

/**
 * Clamp a numeric value between min and max bounds
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a unique session ID
 * @returns A unique session identifier
 */
export function generateSessionId(): string {
  return Crypto.randomUUID();
}

/**
 * Validate text input for speech synthesis
 * @param text - The text to validate
 * @returns Validation result
 */
export function validateText(text: string): ValidationResult {
  const errors: string[] = [];

  if (!text || typeof text !== "string") {
    errors.push("Text must be a non-empty string");
  } else if (text.length > MAX_TEXT_LENGTH) {
    errors.push(
      `Text length (${text.length}) exceeds maximum allowed length (${MAX_TEXT_LENGTH})`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate and normalize speech parameters
 * Consolidates validation logic from Speech.ts and ssmlUtils.ts
 * @param options - Speech options to validate
 * @param clampValues - Whether to clamp values to valid ranges (default: true)
 * @returns Validation result and normalized options
 */
export function validateSpeechParameters(
  options: SpeechOptions,
  clampValues: boolean = true,
): { result: ValidationResult; normalizedOptions: SpeechOptions } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedOptions = { ...options };

  // Apply default values
  if (normalizedOptions.voice === undefined) {
    normalizedOptions.voice = DEFAULT_VOICE;
  }
  if (normalizedOptions.rate === undefined) {
    normalizedOptions.rate = PARAMETER_RANGES.rate.default;
  }
  if (normalizedOptions.pitch === undefined) {
    normalizedOptions.pitch = PARAMETER_RANGES.pitch.default;
  }
  if (normalizedOptions.volume === undefined) {
    normalizedOptions.volume = PARAMETER_RANGES.volume.default;
  }

  // Validate voice parameter (optional, but if provided, must be a non-empty string)
  if (
    options.voice !== undefined &&
    (typeof options.voice !== "string" || options.voice.trim() === "")
  ) {
    errors.push("Voice option, if provided, must be a non-empty string.");
  }

  // Validate and clamp rate parameter
  if (options.rate !== undefined) {
    if (typeof options.rate !== "number" || isNaN(options.rate)) {
      errors.push("Rate must be a valid number");
    } else if (
      options.rate < PARAMETER_RANGES.rate.min || // Use imported PARAMETER_RANGES
      options.rate > PARAMETER_RANGES.rate.max
    ) {
      if (clampValues) {
        normalizedOptions.rate = clampValue(
          options.rate,
          PARAMETER_RANGES.rate.min,
          PARAMETER_RANGES.rate.max,
        );
        warnings.push(
          `Rate ${options.rate} clamped to ${normalizedOptions.rate}`,
        );
      } else {
        errors.push(
          `Rate ${options.rate} is outside valid range ${PARAMETER_RANGES.rate.min}-${PARAMETER_RANGES.rate.max}`,
        );
      }
    }
  }

  // Validate and clamp pitch parameter
  if (options.pitch !== undefined) {
    if (typeof options.pitch !== "number" || isNaN(options.pitch)) {
      errors.push("Pitch must be a valid number");
    } else if (
      options.pitch < PARAMETER_RANGES.pitch.min || // Use imported PARAMETER_RANGES
      options.pitch > PARAMETER_RANGES.pitch.max
    ) {
      if (clampValues) {
        normalizedOptions.pitch = clampValue(
          options.pitch,
          PARAMETER_RANGES.pitch.min,
          PARAMETER_RANGES.pitch.max,
        );
        warnings.push(
          `Pitch ${options.pitch} clamped to ${normalizedOptions.pitch}`,
        );
      } else {
        errors.push(
          `Pitch ${options.pitch} is outside valid range ${PARAMETER_RANGES.pitch.min}-${PARAMETER_RANGES.pitch.max}`,
        );
      }
    }
  }

  // Validate and clamp volume parameter
  if (options.volume !== undefined) {
    if (typeof options.volume !== "number" || isNaN(options.volume)) {
      errors.push("Volume must be a valid number");
    } else if (
      options.volume < PARAMETER_RANGES.volume.min || // Use imported PARAMETER_RANGES
      options.volume > PARAMETER_RANGES.volume.max
    ) {
      if (clampValues) {
        normalizedOptions.volume = clampValue(
          options.volume,
          PARAMETER_RANGES.volume.min,
          PARAMETER_RANGES.volume.max,
        );
        warnings.push(
          `Volume ${options.volume} clamped to ${normalizedOptions.volume}`,
        );
      } else {
        errors.push(
          `Volume ${options.volume} is outside valid range ${PARAMETER_RANGES.volume.min}-${PARAMETER_RANGES.volume.max}`,
        );
      }
    }
  }

  // Validate language parameter
  if (options.language !== undefined && typeof options.language !== "string") {
    errors.push("Language must be a string");
  }

  return {
    result: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
    normalizedOptions,
  };
}

/**
 * Create a standardized SpeechError
 * @param name - Error name
 * @param message - Error message
 * @param code - Error code (optional)
 * @returns SpeechError object
 */
export function createSpeechError(
  name: string,
  message: string,
  code?: string | number,
): SpeechError {
  return {
    name,
    message,
    code,
  };
}
