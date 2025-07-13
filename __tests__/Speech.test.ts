/**
 * Test Criteria:
 * - All public API functions work using internal component integration
 * - Parameter validation enforces all ranges using complete constants
 * - Error handling provides meaningful messages using service error integration
 * - API is fully compatible with expo-speech interface using complete types
 * - All services integrate properly through the public API layer
 */

import {
  speak,
  getAvailableVoicesAsync,
  stop,
  pause,
  resume,
  isSpeakingAsync,
  configure,
} from "../src/Speech";
import { SpeechAPI } from "../src/Speech";
import { SpeechOptions, EdgeSpeechVoice, SpeechAPIConfig } from "../src/types";
import {
  MAX_TEXT_LENGTH,
  PARAMETER_RANGES,
  DEFAULT_VOICE,
} from "../src/constants";

// Mock the services to avoid network calls and expo-av dependencies
// Mock Synthesizer
const mockSynthesizerSpeak = jest.fn().mockResolvedValue(undefined);
const mockSynthesizerStop = jest.fn();
const mockSynthesizerPause = jest.fn();
const mockSynthesizerResume = jest.fn();
const mockSynthesizerIsSpeaking = jest.fn().mockResolvedValue(false);

jest.mock("../src/core/synthesizer", () => ({
  Synthesizer: jest.fn().mockImplementation(() => ({
    speak: mockSynthesizerSpeak,
    stop: mockSynthesizerStop,
    pause: mockSynthesizerPause,
    resume: mockSynthesizerResume,
    isSpeakingAsync: mockSynthesizerIsSpeaking,
  })),
}));

// Mock VoiceService
const mockGetAvailableVoices = jest.fn().mockResolvedValue([
  {
    identifier: "en-US-AriaNeural",
    name: "Aria",
    language: "en-US",
    gender: "Female",
  },
  {
    identifier: "en-GB-SoniaNeural",
    name: "Sonia",
    language: "en-GB",
    gender: "Female",
  },
] as EdgeSpeechVoice[]);

// Mock VoiceService
const mockVoiceServiceInstance = {
  getAvailableVoices: mockGetAvailableVoices,
};

jest.mock("../src/services/voiceService", () => ({
  VoiceService: jest.fn().mockImplementation(() => mockVoiceServiceInstance),
}));

// Also mock the VoiceService.getInstance static method
const { VoiceService } = require("../src/services/voiceService");
VoiceService.getInstance = jest.fn().mockReturnValue(mockVoiceServiceInstance);

// Mock other services as needed, ensuring they don't interfere with API tests
jest.mock("../src/services/audioService", () => ({
  AudioService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../src/services/networkService", () => ({
  NetworkService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../src/services/storageService", () => ({
  StorageService: {
    getInstance: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("../src/core/state", () => ({
  StateManager: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../src/core/connectionManager", () => ({
  ConnectionManager: jest.fn().mockImplementation(() => ({
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock expo-av Audio
jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          getStatusAsync: jest
            .fn()
            .mockResolvedValue({ isLoaded: true, isPlaying: false }),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
        status: {
          /* mock AVPlaybackStatus */
        },
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: jest.fn(),
  },
}));

describe("Main Speech API Implementation", () => {
  const validMinimalOptions: SpeechOptions = { voice: "en-US-AriaNeural" };

  // Helper function to test speak calls and wait for async completion
  const testSpeakCall = async (text: string, options?: SpeechOptions) => {
    expect(() => speak(text, options)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    SpeechAPI.resetForTesting();
    configure({} as SpeechAPIConfig);
  });

  describe("API Compatibility", () => {
    test("should export all required expo-speech functions", () => {
      expect(typeof speak).toBe("function");
      expect(typeof getAvailableVoicesAsync).toBe("function");
      expect(typeof stop).toBe("function");
      expect(typeof pause).toBe("function");
      expect(typeof resume).toBe("function");
      expect(typeof isSpeakingAsync).toBe("function");
      expect(typeof MAX_TEXT_LENGTH).toBe("number");
    });

    test("should have correct maxSpeechInputLength value", () => {
      const Speech = require("../src/Speech");
      expect(Speech.maxSpeechInputLength).toBe(MAX_TEXT_LENGTH);
    });

    test("should return promises for async functions", () => {
      expect(getAvailableVoicesAsync()).toBeInstanceOf(Promise);
      expect(stop()).toBeInstanceOf(Promise);
      expect(pause()).toBeInstanceOf(Promise);
      expect(resume()).toBeInstanceOf(Promise);
      expect(isSpeakingAsync()).toBeInstanceOf(Promise);
    });
  });

  describe("Parameter Validation", () => {
    describe("Text Validation", () => {
      test("should reject empty text", () => {
        expect(() => speak("", validMinimalOptions)).toThrow(
          "Text to speak cannot be empty.",
        );
      });

      test("should reject non-string text", () => {
        // @ts-ignore
        expect(() => speak(123, validMinimalOptions)).toThrow(
          "Text to speak must be a string.",
        );
      });

      test("should reject text longer than MAX_TEXT_LENGTH", () => {
        const longText = "a".repeat(MAX_TEXT_LENGTH + 1);
        expect(() => speak(longText, validMinimalOptions)).toThrow(
          `Text length (${longText.length}) exceeds maximum allowed length (${MAX_TEXT_LENGTH})`,
        );
      });

      test("should accept valid text within length limits", async () => {
        const validText = "Hello, world!";
        await testSpeakCall(validText, validMinimalOptions);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          validText,
          expect.objectContaining(validMinimalOptions),
        );
      });
    });

    describe("Voice Parameter Validation (Optional)", () => {
      test("should work with no options provided (uses default voice)", async () => {
        await testSpeakCall("test");
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({ voice: DEFAULT_VOICE }),
        );
      });

      test("should work with empty options (uses default voice)", async () => {
        await testSpeakCall("test", {});
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({ voice: DEFAULT_VOICE }),
        );
      });

      test("should reject non-string voice option when provided", () => {
        // @ts-ignore
        expect(() => speak("test", { voice: 123 })).toThrow(
          "Invalid speech parameters: Voice option, if provided, must be a non-empty string.",
        );
      });

      test("should reject empty string voice option when provided", () => {
        expect(() => speak("test", { voice: "" })).toThrow(
          "Invalid speech parameters: Voice option, if provided, must be a non-empty string.",
        );
      });

      test("should accept valid voice option when provided", async () => {
        await testSpeakCall("test", validMinimalOptions);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining(validMinimalOptions),
        );
      });
    });

    describe("Rate Parameter Validation", () => {
      test("should use default rate if not provided", async () => {
        await testSpeakCall("test", validMinimalOptions);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            rate: PARAMETER_RANGES.rate.default,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp rate below minimum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          rate: PARAMETER_RANGES.rate.min - 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            rate: PARAMETER_RANGES.rate.min,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp rate above maximum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          rate: PARAMETER_RANGES.rate.max + 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            rate: PARAMETER_RANGES.rate.max,
            ...validMinimalOptions,
          }),
        );
      });

      test("should accept valid rate values", async () => {
        await testSpeakCall("test", { ...validMinimalOptions, rate: 1.0 });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({ rate: 1.0, ...validMinimalOptions }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          rate: PARAMETER_RANGES.rate.min,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            rate: PARAMETER_RANGES.rate.min,
            ...validMinimalOptions,
          }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          rate: PARAMETER_RANGES.rate.max,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            rate: PARAMETER_RANGES.rate.max,
            ...validMinimalOptions,
          }),
        );
      });
    });

    describe("Pitch Parameter Validation", () => {
      test("should use default pitch if not provided", async () => {
        await testSpeakCall("test", validMinimalOptions);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            pitch: PARAMETER_RANGES.pitch.default,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp pitch below minimum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          pitch: PARAMETER_RANGES.pitch.min - 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            pitch: PARAMETER_RANGES.pitch.min,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp pitch above maximum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          pitch: PARAMETER_RANGES.pitch.max + 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            pitch: PARAMETER_RANGES.pitch.max,
            ...validMinimalOptions,
          }),
        );
      });

      test("should accept valid pitch values", async () => {
        await testSpeakCall("test", { ...validMinimalOptions, pitch: 1.0 });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({ pitch: 1.0, ...validMinimalOptions }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          pitch: PARAMETER_RANGES.pitch.min,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            pitch: PARAMETER_RANGES.pitch.min,
            ...validMinimalOptions,
          }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          pitch: PARAMETER_RANGES.pitch.max,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            pitch: PARAMETER_RANGES.pitch.max,
            ...validMinimalOptions,
          }),
        );
      });
    });

    describe("Volume Parameter Validation", () => {
      test("should use default volume if not provided", async () => {
        await testSpeakCall("test", validMinimalOptions);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            volume: PARAMETER_RANGES.volume.default,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp volume below minimum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          volume: PARAMETER_RANGES.volume.min - 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            volume: PARAMETER_RANGES.volume.min,
            ...validMinimalOptions,
          }),
        );
      });

      test("should clamp volume above maximum", async () => {
        await testSpeakCall("test", {
          ...validMinimalOptions,
          volume: PARAMETER_RANGES.volume.max + 0.1,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            volume: PARAMETER_RANGES.volume.max,
            ...validMinimalOptions,
          }),
        );
      });

      test("should accept valid volume values", async () => {
        await testSpeakCall("test", { ...validMinimalOptions, volume: 0.5 });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({ volume: 0.5, ...validMinimalOptions }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          volume: PARAMETER_RANGES.volume.min,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            volume: PARAMETER_RANGES.volume.min,
            ...validMinimalOptions,
          }),
        );

        await testSpeakCall("test", {
          ...validMinimalOptions,
          volume: PARAMETER_RANGES.volume.max,
        });
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining({
            volume: PARAMETER_RANGES.volume.max,
            ...validMinimalOptions,
          }),
        );
      });
    });

    describe("Optional Parameter Validation (language)", () => {
      test("should reject non-string language", () => {
        // @ts-ignore
        expect(() =>
          speak("test", { ...validMinimalOptions, language: 123 as any }),
        ).toThrow("Invalid speech parameters: Language must be a string");
      });

      test("should accept valid optional parameters", async () => {
        const optionsWithLang: SpeechOptions = {
          ...validMinimalOptions,
          language: "en-US",
        };
        await testSpeakCall("test", optionsWithLang);
        expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
          "test",
          expect.objectContaining(optionsWithLang),
        );
      });
    });
  });

  describe("Error Handling", () => {
    test("should call onError callback when synthesizer fails", async () => {
      const expectedError = new Error("Synthesizer speak failed");
      mockSynthesizerSpeak.mockRejectedValueOnce(expectedError);
      const mockOnError = jest.fn();

      speak("test", { ...validMinimalOptions, onError: mockOnError });

      // Wait for the async rejection to be handled
      await new Promise(process.nextTick);

      expect(mockSynthesizerSpeak).toHaveBeenCalled();
      // The error passed to the callback is the one created in SpeechAPI.speak
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
      const actualError = mockOnError.mock.calls[0][0];
      // The message is preserved
      expect(actualError.message).toBe(expectedError.message);
    });

    test("should log error when synthesizer fails and no onError is provided", async () => {
      const expectedError = new Error("Synthesizer speak failed");
      mockSynthesizerSpeak.mockRejectedValueOnce(expectedError);
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      speak("test", validMinimalOptions);

      // Wait for the async rejection to be handled
      await new Promise(process.nextTick);

      expect(mockSynthesizerSpeak).toHaveBeenCalled();
      // Check that the error was logged by the .catch() in the public speak function
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Unhandled promise rejection in speak:",
        expectedError.message,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Callback Support", () => {
    test("should support simple function callbacks and pass them to synthesizer", async () => {
      const mockOnStart = jest.fn();
      const mockOnDone = jest.fn();

      const options: SpeechOptions = {
        ...validMinimalOptions,
        onStart: mockOnStart,
        onDone: mockOnDone,
      };

      await testSpeakCall("test", options);
      expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
        "test",
        expect.objectContaining(options),
      );
    });

    test("should support SpeechEventCallback types and pass them to synthesizer", async () => {
      const mockCallback = jest.fn();

      const options: SpeechOptions = {
        ...validMinimalOptions,
        onBoundary: mockCallback,
        onMark: mockCallback,
        onPause: mockCallback,
        onResume: mockCallback,
      };

      await testSpeakCall("test", options);
      expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
        "test",
        expect.objectContaining(options),
      );
    });
  });

  describe("Service Integration (API level calls to mocked services)", () => {
    test("getAvailableVoicesAsync should call VoiceService and return its result", async () => {
      const voices = await getAvailableVoicesAsync();
      expect(mockGetAvailableVoices).toHaveBeenCalled();
      expect(voices).toEqual([
        {
          identifier: "en-US-AriaNeural",
          name: "Aria",
          language: "en-US",
          gender: "Female",
        },
        {
          identifier: "en-GB-SoniaNeural",
          name: "Sonia",
          language: "en-GB",
          gender: "Female",
        },
      ]);
    });

    test("stop should call Synthesizer.stop", async () => {
      await stop();
      expect(mockSynthesizerStop).toHaveBeenCalled();
    });

    test("pause should call Synthesizer.pause", async () => {
      await pause();
      expect(mockSynthesizerPause).toHaveBeenCalled();
    });

    test("resume should call Synthesizer.resume", async () => {
      await resume();
      expect(mockSynthesizerResume).toHaveBeenCalled();
    });

    test("isSpeakingAsync should call Synthesizer.isSpeakingAsync", async () => {
      mockSynthesizerIsSpeaking.mockResolvedValueOnce(true);
      const result = await isSpeakingAsync();
      expect(mockSynthesizerIsSpeaking).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("Type Compatibility", () => {
    test("should accept all expo-speech SpeechOptions properties", async () => {
      const fullOptions: SpeechOptions = {
        language: "en-US",
        voice: "en-US-AriaNeural",
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        onStart: () => {},
        onDone: () => {},
        onError: (error: Error) => {},
        onStopped: () => {},
        onBoundary: (boundary) => {},
        onMark: null,
        onPause: null,
        onResume: null,
      };

      await testSpeakCall("test", fullOptions);
      expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
        "test",
        expect.objectContaining(fullOptions),
      );
    });

    test("should work with minimal options (voice only)", async () => {
      await testSpeakCall("test", { voice: "en-US-TestVoice" });
      expect(mockSynthesizerSpeak).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({ voice: "en-US-TestVoice" }),
      );
    });
  });
});
