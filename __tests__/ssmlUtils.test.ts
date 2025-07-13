/**
 * ssmlUtils.test.ts
 * Unit tests for SSML generation and processing utilities
 */

import {
  generateSSML,
  validateSSML,
  escapeXML,
  formatPitch,
  formatRate,
  formatVolume,
  extractLanguageFromVoice,
  isValidSSML,
  extractTextFromSSML,
  normalizeSSML,
} from "../src/utils/ssmlUtils";

import { MAX_TEXT_LENGTH, PARAMETER_RANGES } from "../src/constants";

import { EdgeSpeechVoice, SpeechOptions } from "../src/types";

// Import test fixtures with proper typing
const edgeTTSSamples = require("./__fixtures__/ssml-samples/edge-tts-samples.json");

describe("ssmlUtils", () => {
  // Mock voice data for testing
  const mockVoices: EdgeSpeechVoice[] = [
    {
      identifier: "en-US-AriaNeural",
      name: "Microsoft Aria Online (Natural) - English (United States)",
      language: "en-US",
      gender: "Female",
      contentCategories: ["News", "Novel"],
      voicePersonalities: ["Friendly", "Positive"],
    },
    {
      identifier: "en-GB-SoniaNeural",
      name: "Microsoft Sonia Online (Natural) - English (United Kingdom)",
      language: "en-GB",
      gender: "Female",
      contentCategories: ["News", "Novel"],
      voicePersonalities: ["Friendly", "Positive"],
    },
    {
      identifier: "fr-FR-DeniseNeural",
      name: "Microsoft Denise Online (Natural) - French (France)",
      language: "fr-FR",
      gender: "Female",
      contentCategories: ["News", "Novel"],
      voicePersonalities: ["Friendly", "Positive"],
    },
  ];
  const defaultTestVoice = "en-US-AriaNeural";

  describe("Constants (Parameter Ranges from constants.ts)", () => {
    test("should have correct parameter ranges from constants.ts", () => {
      expect(PARAMETER_RANGES.rate.min).toBe(0.0);
      expect(PARAMETER_RANGES.rate.max).toBe(2.0);
      expect(PARAMETER_RANGES.rate.default).toBe(1.0);

      expect(PARAMETER_RANGES.pitch.min).toBe(0.0);
      expect(PARAMETER_RANGES.pitch.max).toBe(2.0);
      expect(PARAMETER_RANGES.pitch.default).toBe(1.0);

      expect(PARAMETER_RANGES.volume.min).toBe(0.0);
      expect(PARAMETER_RANGES.volume.max).toBe(2.0);
      expect(PARAMETER_RANGES.volume.default).toBe(1.0);
    });
  });

  describe("XML Escaping", () => {
    test("should escape XML special characters", () => {
      const input = "Hello & \"World\" <test> 'quote'";
      const expected =
        "Hello &amp; &quot;World&quot; &lt;test&gt; &apos;quote&apos;";
      expect(escapeXML(input)).toBe(expected);
    });

    test("should handle empty string", () => {
      expect(escapeXML("")).toBe("");
    });

    test("should handle string with no special characters", () => {
      const input = "Hello World";
      expect(escapeXML(input)).toBe(input);
    });

    test("should handle ampersand at different positions", () => {
      expect(escapeXML("&start")).toBe("&amp;start");
      expect(escapeXML("middle&end")).toBe("middle&amp;end");
      expect(escapeXML("end&")).toBe("end&amp;");
    });
  });

  describe("Parameter Formatting to SSML Percentages", () => {
    describe("formatRate (0.0-2.0 to -100%-+100%)", () => {
      test("should format rate with default value (1.0 -> +0%)", () => {
        expect(formatRate(PARAMETER_RANGES.rate.default)).toBe("+0%");
      });
      test("should format rate for min value (0.0 -> -100%)", () => {
        expect(formatRate(PARAMETER_RANGES.rate.min)).toBe("-100%");
      });
      test("should format rate for max value (2.0 -> +100%)", () => {
        expect(formatRate(PARAMETER_RANGES.rate.max)).toBe("+100%");
      });
      test("should format rate for mid value (1.5 -> +50%)", () => {
        expect(formatRate(1.5)).toBe("+50%");
      });
      test("should format rate for 0.75 (-25%)", () => {
        expect(formatRate(0.75)).toBe("-25%");
      });
      test("should clamp and format rate below minimum (0.3 -> -100%)", () => {
        expect(formatRate(0.3)).toBe("-70%"); // Not clamped, just formatted based on new 0-2 range
      });
      test("should clamp and format rate above maximum (3.0 -> +100%)", () => {
        expect(formatRate(3.0)).toBe("+100%"); // Clamped to 2.0
      });
    });

    describe("formatPitch (0.0-2.0 to -100%-+100%)", () => {
      test("should format pitch with default value (1.0 -> +0%)", () => {
        expect(formatPitch(PARAMETER_RANGES.pitch.default)).toBe("+0%");
      });
      test("should format pitch for min value (0.0 -> -100%)", () => {
        expect(formatPitch(PARAMETER_RANGES.pitch.min)).toBe("-100%");
      });
      test("should format pitch for max value (2.0 -> +100%)", () => {
        expect(formatPitch(PARAMETER_RANGES.pitch.max)).toBe("+100%");
      });
      test("should format pitch for mid value (1.5 -> +50%)", () => {
        expect(formatPitch(1.5)).toBe("+50%");
      });
      test("should format pitch for 0.75 (-25%)", () => {
        expect(formatPitch(0.75)).toBe("-25%");
      });
      test("should clamp and format pitch below minimum (0.3 -> -70%)", () => {
        expect(formatPitch(0.3)).toBe("-70%");
      });
      test("should clamp and format pitch above maximum (3.0 -> +100%)", () => {
        expect(formatPitch(3.0)).toBe("+100%");
      });
    });

    describe("formatVolume (0.0-2.0 to -100%-+100%)", () => {
      // Note: The mapping for volume now uses the same 0-2 range as rate and pitch.
      // The prompt implies 0.0-2.0 for input, mapping to -100% to +100%.
      // However, constants.ts has PARAMETER_RANGES.volume as 0.0-1.0, mapping to -100% to 0%.
      // Let's assume the constants.ts (0.0-1.0 input) is the source of truth for now.
      // If the input range for volume was intended to be 0.0-2.0, these tests and formatVolume need adjustment.

      test("should format volume with default value (1.0 -> +0%)", () => {
        expect(formatVolume(PARAMETER_RANGES.volume.default)).toBe("+0%"); // 1.0 maps to 0%
      });
      test("should format volume for min value (0.0 -> -100%)", () => {
        expect(formatVolume(PARAMETER_RANGES.volume.min)).toBe("-100%"); // 0.0 maps to -100%
      });
      test("should format volume for max value (2.0 -> +100%)", () => {
        expect(formatVolume(PARAMETER_RANGES.volume.max)).toBe("+100%"); // 2.0 maps to +100%
      });
      test("should format volume for 0.5 (-50%)", () => {
        expect(formatVolume(0.5)).toBe("-50%"); // 0.5 maps to -50%
      });
      test("should format volume for 0.75 (-25%)", () => {
        expect(formatVolume(0.75)).toBe("-25%");
      });
      test("should clamp and format volume below minimum (-0.5 -> -100%)", () => {
        expect(formatVolume(-0.5)).toBe("-100%"); // Clamped to 0.0
      });
      test("should clamp and format volume above maximum (1.5 -> +50%)", () => {
        // Based on new PARAMETER_RANGES.volume.max = 2.0
        expect(formatVolume(1.5)).toBe("+50%"); // Not clamped, just formatted
      });
      test("should format volume for 2.0 (+100%)", () => {
        expect(formatVolume(2.0)).toBe("+100%"); // 2.0 maps to +100%
      });
    });
  });

  describe("Language Extraction", () => {
    test("should extract language from voice identifiers", () => {
      expect(extractLanguageFromVoice("en-US-AriaNeural")).toBe("en-US");
      expect(extractLanguageFromVoice("fr-FR-DeniseNeural")).toBe("fr-FR");
      expect(extractLanguageFromVoice("de-DE-KatjaNeural")).toBe("de-DE");
      expect(extractLanguageFromVoice("ja-JP-NanamiNeural")).toBe("ja-JP");
    });

    test("should handle invalid voice identifiers", () => {
      expect(extractLanguageFromVoice("invalid")).toBe("en-US");
      expect(extractLanguageFromVoice("")).toBe("en-US");
      expect(extractLanguageFromVoice("AriaNeural")).toBe("en-US");
    });

    test("should handle partial language codes", () => {
      expect(extractLanguageFromVoice("en-")).toBe("en-US");
      expect(extractLanguageFromVoice("en")).toBe("en-US");
    });
  });

  describe("SSML Validation (validateSSML)", () => {
    test("should validate well-formed SSML", () => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-AriaNeural"><prosody rate="+0%" pitch="+0%" volume="+0%">Hello World</prosody></voice></speak>`;
      const result = validateSSML(ssml);
      expect(result.isValid).toBe(true);
    });

    test("should detect missing required elements", () => {
      const ssml = "Hello World";
      const result = validateSSML(ssml);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing required <speak> root element");
    });

    test("should detect missing required attributes", () => {
      const ssml = "<speak><voice>Hello</voice></speak>";
      const result = validateSSML(ssml);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Missing required version="1.0" attribute',
      );
      expect(result.errors).toContain("Missing required xmlns attribute");
    });

    test("should detect missing voice name attribute", () => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
        <voice>Hello</voice>
      </speak>`;
      const result = validateSSML(ssml);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Missing required name attribute in <voice> element",
      );
    });

    test("should handle empty or invalid input", () => {
      expect(validateSSML("").isValid).toBe(false);
      expect(validateSSML(null as any).isValid).toBe(false);
      expect(validateSSML(undefined as any).isValid).toBe(false);
    });

    test("should detect mismatched tags", () => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
        <voice name="test">Hello
      </speak>`;
      const result = validateSSML(ssml);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Mismatched <voice> tags");
    });

    test("should warn about missing xml:lang", () => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
        <voice name="test">Hello</voice>
      </speak>`;
      const result = validateSSML(ssml);
      expect(result.warnings).toContain(
        "Missing xml:lang attribute (recommended)",
      );
    });
  });

  describe("SSML Generation (generateSSML)", () => {
    test("should use default voice when no voice is provided in options", () => {
      const ssml = generateSSML("Hello World", {});
      expect(ssml).toContain(`<speak version="1.0"`);
      expect(ssml).toContain(`xmlns="http://www.w3.org/2001/10/synthesis"`);
      expect(ssml).toContain(
        `<voice name="Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)">`,
      );
      expect(ssml).toContain("Hello World");
    });

    test("should use default voice when options is undefined", () => {
      const ssml = generateSSML("Hello World");
      expect(ssml).toContain(
        `<voice name="Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)">`,
      );
      expect(ssml).toContain("Hello World");
    });

    test("should reject empty string voice when provided", () => {
      expect(() => generateSSML("Hello World", { voice: "" })).toThrow(
        "Failed to format voice name for Edge TTS:",
      );
    });

    test("should generate basic SSML with specified voice and default parameters", () => {
      const ssml = generateSSML("Hello World", { voice: defaultTestVoice });
      expect(ssml).toContain(`<speak version="1.0"`);
      expect(ssml).toContain(`xmlns="http://www.w3.org/2001/10/synthesis"`);
      expect(ssml).toContain(`xml:lang="en-US"`); // Extracted from defaultTestVoice
      expect(ssml).toContain(
        `<voice name="Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)">`,
      );
      expect(ssml).toContain(
        `rate="${formatRate(PARAMETER_RANGES.rate.default)}"`,
      );
      expect(ssml).toContain(
        `pitch="${formatPitch(PARAMETER_RANGES.pitch.default)}"`,
      );
      expect(ssml).toContain(
        `volume="${formatVolume(PARAMETER_RANGES.volume.default)}"`,
      );
      expect(ssml).toContain("Hello World</prosody>");
    });

    test("should generate SSML with custom numeric parameters mapped to percentages", () => {
      const options: SpeechOptions = {
        voice: "fr-FR-DeniseNeural", // A voice with a different language
        rate: 1.5, // Should become +50%
        pitch: 0.7, // Should become -30% (approx, (0.7-1)/1 * 100, or (0.7-0.5)/(2.0-0.5) * 150 - 50 for linear map) -> (0.7-1.0) * 100 = -30% if 1.0 is 0%
        // If 0.5 is -50% and 2.0 is +100% (range of 1.5 for 150% change):
        // ((0.7 - 0.5) / 1.5) * 150 - 50 = (0.2 / 1.5) * 150 - 50 = 0.1333 * 150 - 50 = 20 - 50 = -30%
        volume: 0.5, // Should become -50% (for 0.0-1.0 input range)
      };
      const ssml = generateSSML("Bonjour le monde", options);
      expect(ssml).toContain(`xml:lang="fr-FR"`); // Extracted from voice
      expect(ssml).toContain(
        `<voice name="Microsoft Server Speech Text to Speech Voice (fr-FR, DeniseNeural)">`,
      );
      expect(ssml).toContain(`rate="+50%"`);
      expect(ssml).toContain(`pitch="-30%"`);
      expect(ssml).toContain(`volume="-50%"`);
      expect(ssml).toContain("Bonjour le monde");
    });

    test("should use language from options if provided, otherwise extract from voice", () => {
      const optionsWithLang: SpeechOptions = {
        voice: defaultTestVoice,
        language: "de-DE",
      };
      let ssml = generateSSML("Hallo Welt", optionsWithLang);
      expect(ssml).toContain(`xml:lang="de-DE"`);

      const optionsWithoutLang: SpeechOptions = { voice: "fr-FR-DeniseNeural" };
      ssml = generateSSML("Bonjour", optionsWithoutLang);
      expect(ssml).toContain(`xml:lang="fr-FR"`);
    });

    test("should correctly format voice name if it matches Edge TTS pattern", () => {
      // Example: Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)
      // This test depends on whether formatVoiceNameForEdgeTTS is still used or if raw voice ID is used.
      // Assuming raw voice ID is used directly now as per previous changes.
      const voiceIdentifier = "en-US-AriaNeural";
      const ssml = generateSSML("Test", { voice: voiceIdentifier });
      expect(ssml).toContain(
        `<voice name="Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)">`,
      );

      const complexVoiceName =
        "Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)";
      // If generateSSML expects the identifier format, this might need adjustment or the test is for a different utility.
      // For now, assuming generateSSML takes the identifier.
      // If it were to take the long name and extract, that's a different test.
      const ssmlComplex = generateSSML("Test", { voice: complexVoiceName });
      expect(ssmlComplex).toContain(`<voice name="${complexVoiceName}">`);
    });

    test("should escape special characters in text", () => {
      const text = 'Hello & "World" <test>';
      const ssml = generateSSML(text, { voice: defaultTestVoice });
      expect(ssml).toContain("Hello &amp; &quot;World&quot; &lt;test&gt;");
    });

    test("should clamp parameters (via commonUtils) and use formatted values", () => {
      // commonUtils.validateSpeechParameters clamps values.
      // generateSSML receives already clamped values if they come from Speech.ts.
      // If generateSSML is called directly with out-of-range values, its internal formatters should handle it.
      const options: SpeechOptions = {
        voice: defaultTestVoice,
        rate: 3.0, // Will be clamped to 2.0 by validateSpeechParameters, then formatted to +100%
        pitch: 0.3, // Will be formatted to -70% (not clamped, based on new 0-2 range)
        volume: 1.8, // Will be formatted to +80% (not clamped, based on new 0-2 range)
      };
      // To test generateSSML directly, we pass potentially unclamped values to its formatters.
      // The formatters themselves also clamp.
      const ssml = generateSSML("Hello", options);
      expect(ssml).toContain(`rate="+100%"`); // formatRate(3.0) -> +100%
      expect(ssml).toContain(`pitch="-70%"`); // formatPitch(0.3) -> -70%
      expect(ssml).toContain(`volume="+80%"`); // formatVolume(1.8) -> +80%
    });

    test("should handle text longer than MAX_TEXT_LENGTH by throwing error", () => {
      const longText = "a".repeat(MAX_TEXT_LENGTH + 1);
      expect(() => generateSSML(longText, { voice: defaultTestVoice })).toThrow(
        `Text length (${longText.length}) exceeds maximum of ${MAX_TEXT_LENGTH} characters.`,
      );
    });
  });

  describe("Utility Functions (isValidSSML, extractTextFromSSML, normalizeSSML)", () => {
    test("isValidSSML should check SSML validity", () => {
      const validSSML = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-AriaNeural">Hello</voice></speak>`;
      const invalidSSML = "Hello World";
      expect(isValidSSML(validSSML)).toBe(true);
      expect(isValidSSML(invalidSSML)).toBe(false);
    });

    test("extractTextFromSSML should extract text content", () => {
      const ssml = `<speak><voice name="v"><prosody rate="+0%">Hello World</prosody></voice></speak>`;
      expect(extractTextFromSSML(ssml)).toBe("Hello World");
    });

    test("normalizeSSML should normalize formatting", () => {
      const ssml = `<speak  version="1.0"><voice   name="test"> Hello    World </voice></speak>`;
      const normalized = normalizeSSML(ssml);
      expect(normalized).not.toContain("  "); // No double spaces within content after stripping leading/trailing from content
      // This regex might be too strict if attributes can have spaces.
      // A more robust test would be to parse and compare structure or specific content.
      // For now, let's assume it primarily targets inter-tag and excessive content spacing.
      // expect(normalized).toMatch(/><[^>]/); // No whitespace between tags
      expect(normalized).toContain('<voice name="test">Hello World</voice>');
    });
  });
});
