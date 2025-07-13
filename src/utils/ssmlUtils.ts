/**
 * SSML generation and processing utilities for EdgeSpeech
 */
import { SpeechOptions, EdgeSpeechVoice } from "../types";
import { clampValue } from "./commonUtils";
import {
  PARAMETER_RANGES,
  VOICE_NAME_FORMAT,
  SSML_NAMESPACE,
  MAX_TEXT_LENGTH,
  DEFAULT_VOICE,
} from "../constants";

/**
 * SSML validation result interface
 */
export interface SSMLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required SSML namespace and attributes
 */
export const SSML_CONSTANTS = {
  VERSION: "1.0",
  XMLNS: SSML_NAMESPACE,
  XMLNS_MSTTS: "https://www.w3.org/2001/mstts",
  DEFAULT_LANG: "en-US",
} as const;

/**
 * Escape XML special characters for SSML content
 */
export function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Validate voice name against available voices
 */
export function validateVoiceName(
  voiceName: string,
  availableVoices?: EdgeSpeechVoice[],
): { isValid: boolean; suggestion?: string } {
  if (!voiceName || typeof voiceName !== "string") {
    return { isValid: false };
  }

  if (!availableVoices || availableVoices.length === 0) {
    return { isValid: true };
  }

  const exactMatch = availableVoices.find(
    (voice) => voice.identifier === voiceName,
  );
  if (exactMatch) {
    return { isValid: true };
  }

  const suggestion = availableVoices.find((voice) =>
    voice.identifier.toLowerCase().includes(voiceName.toLowerCase()),
  );

  return {
    isValid: false,
    suggestion: suggestion?.identifier,
  };
}

/**
 * Format pitch parameter for Edge TTS
 */
export function formatPitch(pitchInput?: number): string {
  const pitch = pitchInput ?? PARAMETER_RANGES.pitch.default;
  const { min, max } = PARAMETER_RANGES.pitch;
  const clampedPitch = clampValue(pitch, min, max);
  const percentage = Math.round((clampedPitch - 1.0) * 100);
  return `${percentage >= 0 ? "+" : ""}${percentage}%`;
}

/**
 * Format rate parameter for Edge TTS
 */
export function formatRate(rateInput?: number): string {
  const rate = rateInput ?? PARAMETER_RANGES.rate.default;
  const { min, max } = PARAMETER_RANGES.rate;
  const clampedRate = clampValue(rate, min, max);
  const percentage = Math.round((clampedRate - 1.0) * 100);
  return `${percentage >= 0 ? "+" : ""}${percentage}%`;
}

/**
 * Format volume parameter for Edge TTS
 */
export function formatVolume(volumeInput?: number): string {
  const volume = volumeInput ?? PARAMETER_RANGES.volume.default;
  const { min, max } = PARAMETER_RANGES.volume;
  const clampedVolume = clampValue(volume, min, max);
  const percentage = Math.round((clampedVolume - 1.0) * 100);
  return `${percentage >= 0 ? "+" : ""}${percentage}%`;
}

/**
 * Extract language from voice identifier
 * Supports various BCP 47 language tag formats:
 * - Standard: en-US, fr-FR, zh-CN
 * - Script-specific: iu-Latn-CA, iu-Cans-CA
 * - Regional variants: zh-CN-liaoning, zh-CN-shaanxi
 * - 3-letter codes: fil-PH
 */
export function extractLanguageFromVoice(voiceIdentifier: string): string {
  if (!voiceIdentifier || typeof voiceIdentifier !== "string") {
    return SSML_CONSTANTS.DEFAULT_LANG;
  }
  // Match flexible language-region patterns
  // Supports: xx-YY, xxx-YY, xx-Yyyy, xx-YY-variant
  const match = voiceIdentifier.match(
    /^([a-z]{2,3}-[A-Za-z]{2,}(?:-[A-Za-z]+)?)-/,
  );
  return match ? match[1] : SSML_CONSTANTS.DEFAULT_LANG;
}

/**
 * Convert voice identifier to Microsoft Edge TTS format
 * Supports various BCP 47 language tag formats including:
 * - Standard: en-US-AriaNeural, fr-FR-DeniseNeural
 * - Script-specific: iu-Latn-CA-SiqiniqNeural, iu-Cans-CA-TaqqiqNeural
 * - Regional variants: zh-CN-liaoning-XiaobeiNeural
 * - 3-letter codes: fil-PH-AngeloNeural
 */
export function formatVoiceNameForEdgeTTS(voiceIdentifier: string): string {
  if (!voiceIdentifier || voiceIdentifier.trim() === "") {
    throw new Error(
      "Failed to format voice name for Edge TTS: Voice identifier cannot be empty",
    );
  }
  if (voiceIdentifier.startsWith(VOICE_NAME_FORMAT.PREFIX)) {
    return voiceIdentifier;
  }
  // Match flexible language-region-voice patterns
  // Supports: xx-YY-Voice, xxx-YY-Voice, xx-Yyyy-Voice, xx-YY-variant-Voice
  const match = voiceIdentifier.match(
    /^([a-z]{2,3}-[A-Za-z]{2,}(?:-[A-Za-z]+)?)-(.+)$/,
  );
  if (!match) {
    console.warn(
      `Invalid voice identifier format for Edge TTS: ${voiceIdentifier}`,
    );
    return "";
  }
  const [, langRegion, voiceNamePart] = match;
  return `${VOICE_NAME_FORMAT.PREFIX} (${langRegion}, ${voiceNamePart})`;
}

/**
 * Validate SSML markup structure
 */
export function validateSSML(ssml: string): SSMLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ssml || typeof ssml !== "string") {
    errors.push("SSML content is empty or invalid");
    return { isValid: false, errors, warnings };
  }
  if (!ssml.includes("<speak")) {
    errors.push("Missing required <speak> root element");
  }
  if (!ssml.includes('version="1.0"')) {
    errors.push('Missing required version="1.0" attribute');
  }
  if (!ssml.includes(`xmlns="${SSML_CONSTANTS.XMLNS}"`)) {
    errors.push("Missing required xmlns attribute");
  }
  if (!ssml.includes("xml:lang=")) {
    warnings.push("Missing xml:lang attribute (recommended)");
  }
  if (!ssml.includes("<voice")) {
    errors.push("Missing required <voice> element");
  }
  if (ssml.includes("<voice") && !ssml.includes('name="')) {
    errors.push("Missing required name attribute in <voice> element");
  }
  if (ssml.includes('name=""')) {
    errors.push("Voice name attribute cannot be empty in <voice> element");
  }

  try {
    const speakCount = (ssml.match(/<speak/g) || []).length;
    const speakCloseCount = (ssml.match(/<\/speak>/g) || []).length;
    if (speakCount !== speakCloseCount) {
      errors.push("Mismatched <speak> tags");
    }
    const voiceCount = (ssml.match(/<voice/g) || []).length;
    const voiceCloseCount = (ssml.match(/<\/voice>/g) || []).length;
    if (voiceCount !== voiceCloseCount) {
      errors.push("Mismatched <voice> tags");
    }
    const prosodyCount = (ssml.match(/<prosody/g) || []).length;
    const prosodyCloseCount = (ssml.match(/<\/prosody>/g) || []).length;
    if (prosodyCount !== prosodyCloseCount) {
      errors.push("Mismatched <prosody> tags");
    }
    const tagStack: string[] = [];
    const tagRegex = /<\/?(\w+)[^>]*>/g;
    let match;
    while ((match = tagRegex.exec(ssml)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];
      if (fullTag.startsWith("</")) {
        if (tagStack.length === 0) {
          errors.push(`Unexpected closing tag: </${tagName}>`);
          break;
        }
        const lastOpenTag = tagStack.pop();
        if (lastOpenTag !== tagName) {
          errors.push(
            `Mismatched tags: expected </${lastOpenTag}> but found </${tagName}>`,
          );
          break;
        }
      } else if (!fullTag.endsWith("/>")) {
        tagStack.push(tagName);
      }
    }
    if (tagStack.length > 0) {
      errors.push(
        `Unclosed tags: ${tagStack.map((tag) => `<${tag}>`).join(", ")}`,
      );
    }
  } catch {
    errors.push("Invalid XML structure during parsing attempt");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate SSML with enhanced validation and voice handling
 */
export function generateSSMLWithValidation(
  text: string,
  options: SpeechOptions = {} as SpeechOptions,
  availableVoices?: EdgeSpeechVoice[],
): {
  ssml: string;
  validation: SSMLValidationResult;
} {
  const validation: SSMLValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!text || typeof text !== "string") {
    validation.errors.push("Text must be a non-empty string.");
    validation.isValid = false;
  } else if (text.length > MAX_TEXT_LENGTH) {
    validation.errors.push(
      `Text length (${text.length}) exceeds maximum of ${MAX_TEXT_LENGTH} characters.`,
    );
    validation.isValid = false;
  }

  const voiceToUse = options.voice || DEFAULT_VOICE;

  if (typeof voiceToUse !== "string" || !voiceToUse) {
    validation.errors.push("Voice option must be a string if provided.");
    validation.isValid = false;
  } else {
    const voiceValidation = validateVoiceName(voiceToUse, availableVoices);
    if (!voiceValidation.isValid) {
      if (voiceValidation.suggestion) {
        validation.warnings.push(
          `Voice "${voiceToUse}" not found. Did you mean "${voiceValidation.suggestion}"? Using "${voiceToUse}" as specified.`,
        );
      } else {
        validation.warnings.push(
          `Voice "${voiceToUse}" not found in available voices list (if provided). Using "${voiceToUse}" as specified.`,
        );
      }
    }

    if (!options.voice) {
      validation.warnings.push(
        `No voice specified, using default voice: ${DEFAULT_VOICE}`,
      );
    }
  }

  if (!validation.isValid) {
    return { ssml: "", validation };
  }

  let ssml = "";
  try {
    ssml = generateSSML(text, options);
    const ssmlValidation = validateSSML(ssml);
    validation.errors.push(...ssmlValidation.errors);
    validation.warnings.push(...ssmlValidation.warnings);
    if (ssmlValidation.errors.length > 0) {
      validation.isValid = false;
    }
  } catch (e: any) {
    validation.errors.push(`Error during SSML generation: ${e.message}`);
    validation.isValid = false;
  }

  return { ssml, validation };
}

/**
 * Generates the required SSML for Microsoft Edge TTS
 * @throws Error if text is invalid, exceeds max length.
 */
export function generateSSML(text: string, options?: SpeechOptions): string {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text length (${text.length}) exceeds maximum of ${MAX_TEXT_LENGTH} characters.`,
    );
  }

  const voiceToUse =
    options?.voice !== undefined ? options.voice : DEFAULT_VOICE;

  if (typeof voiceToUse !== "string") {
    throw new Error("Voice option must be a valid string.");
  }

  const escapedText = escapeXML(text);
  const { rate, pitch, volume } = options || {};

  const formattedVoiceName = formatVoiceNameForEdgeTTS(voiceToUse);
  if (!formattedVoiceName) {
    throw new Error(
      `Failed to format voice name for Edge TTS: "${voiceToUse}". Ensure it's a valid identifier (e.g., en-US-AriaNeural) or already in Microsoft format.`,
    );
  }

  const formattedRate = formatRate(rate);
  const formattedPitch = formatPitch(pitch);
  const formattedVolume = formatVolume(volume);

  // Use language from options if provided, otherwise extract from voice
  const language = options?.language || extractLanguageFromVoice(voiceToUse);

  return `<speak version="${SSML_CONSTANTS.VERSION}" xmlns="${SSML_CONSTANTS.XMLNS}" xmlns:mstts="${SSML_CONSTANTS.XMLNS_MSTTS}" xml:lang="${language}"><voice name="${formattedVoiceName}"><prosody rate="${formattedRate}" pitch="${formattedPitch}" volume="${formattedVolume}">${escapedText}</prosody></voice></speak>`;
}

/**
 * Enhanced SSML generation with additional elements support
 * @throws Error if text is invalid, exceeds max length, or if voice is not provided.
 */
export function generateEnhancedSSML(
  text: string,
  options: SSMLGenerationOptions,
): string {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text length (${text.length}) exceeds maximum of ${MAX_TEXT_LENGTH} characters.`,
    );
  }
  if (!options || typeof options.voice !== "string" || !options.voice) {
    throw new Error("Voice option is required and cannot be empty.");
  }

  const escapedText = escapeXML(text);
  const {
    voice,
    rate,
    pitch,
    volume,
    prefixElements,
    suffixElements,
    useMicrosoftVoiceFormat = true,
  } = options;

  const formattedVoiceName = useMicrosoftVoiceFormat
    ? formatVoiceNameForEdgeTTS(voice)
    : voice;

  if (!formattedVoiceName) {
    throw new Error(
      `Failed to format voice name: "${voice}". Ensure it's a valid identifier or correctly formatted if useMicrosoftVoiceFormat is false.`,
    );
  }

  const formattedRate = formatRate(rate);
  const formattedPitch = formatPitch(pitch);
  const formattedVolume = formatVolume(volume);
  const language = extractLanguageFromVoice(voice);

  const prefixContent = prefixElements?.join("\n      ") || "";
  const suffixContent = suffixElements?.join("\n      ") || "";

  const content = [prefixContent, escapedText, suffixContent]
    .filter(Boolean)
    .join("\n      ");

  return `<speak version="${SSML_CONSTANTS.VERSION}" xmlns="${SSML_CONSTANTS.XMLNS}" xmlns:mstts="${SSML_CONSTANTS.XMLNS_MSTTS}" xml:lang="${language}">
  <voice name="${formattedVoiceName}">
    <prosody rate="${formattedRate}" pitch="${formattedPitch}" volume="${formattedVolume}">
      ${content}
    </prosody>
  </voice>
</speak>`;
}

/**
 * Check if a string appears to be valid SSML
 */
export function isValidSSML(content: string): boolean {
  if (!content) return false;
  const validation = validateSSML(content);
  return validation.isValid;
}

/**
 * Extract text content from SSML markup
 */
export function extractTextFromSSML(ssml: string): string {
  if (!ssml) return "";
  try {
    return ssml
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return ssml;
  }
}

/**
 * Normalize SSML formatting for consistent output
 */
export function normalizeSSML(ssml: string): string {
  if (!ssml) return "";
  try {
    return ssml
      .replace(/>\s+</g, "><") // Remove whitespace between tags
      .replace(/>\s+/g, ">") // Remove whitespace after opening tags
      .replace(/\s+</g, "<") // Remove whitespace before closing tags
      .replace(/\s+/g, " ") // Normalize internal whitespace to single spaces
      .trim();
  } catch {
    return ssml;
  }
}

/**
 * Enhanced SSML generation with support for additional elements
 */
export interface SSMLGenerationOptions extends SpeechOptions {
  prefixElements?: string[];
  suffixElements?: string[];
  useMicrosoftVoiceFormat?: boolean;
}
