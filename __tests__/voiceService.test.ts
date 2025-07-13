import { VoiceService } from "../src/services/voiceService";
import { EdgeSpeechVoice } from "../src/types";
import sampleVoiceListFixtures from "./__fixtures__/sample_voice_list.json";

// Use sample voice data from fixtures file
const realSampleVoices = sampleVoiceListFixtures;

const mockFetch = jest.fn();

// Expected transformed voices (expo-speech format) - based on fixtures
// Uses FriendlyName from fixture data rather than Name field
const expectedTransformedVoices: EdgeSpeechVoice[] = [
  {
    identifier: "af-ZA-AdriNeural",
    name: "Microsoft Adri Online (Natural) - Afrikaans (South Africa)",
    language: "af-ZA",
    gender: "Female",
    contentCategories: ["General"],
    voicePersonalities: ["Friendly", "Positive"],
  },
  {
    identifier: "en-US-AndrewNeural",
    name: "Microsoft Andrew Online (Natural) - English (United States)",
    language: "en-US",
    gender: "Male",
    contentCategories: ["Conversation", "Copilot"],
    voicePersonalities: ["Warm", "Confident", "Authentic", "Honest"],
  },
  {
    identifier: "en-US-AndrewMultilingualNeural",
    name: "Microsoft AndrewMultilingual Online (Natural) - English (United States)",
    language: "en-US",
    gender: "Male",
    contentCategories: ["Conversation", "Copilot"],
    voicePersonalities: ["Warm", "Confident", "Authentic", "Honest"],
  },
];

describe("VoiceService", () => {
  let voiceService: VoiceService;
  let abortController: AbortController;

  beforeAll(() => {
    // Mock global fetch for testing
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Create abort controller for proper cleanup
    abortController = new AbortController();
    // Reset singleton instance to ensure clean state
    (VoiceService as any).instance = null;
    voiceService = VoiceService.getInstance();
    // Clear internal cache for each test
    (voiceService as any).voiceCache = null;
  });

  afterEach(() => {
    // Ensure all async operations are cancelled
    if (abortController) {
      abortController.abort();
    }
  });

  afterAll(() => {
    // Cleanup StorageService singleton to prevent open handles
    const { getStorageService } = require("../src/services/storageService");
    const storageService = getStorageService();
    storageService.destroy();

    jest.restoreAllMocks();
  });

  describe("Voice fetching and caching", () => {
    it("should fetch and transform voices from Edge TTS API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      const voices = await voiceService.getAvailableVoices();

      expect(voices).toEqual(expectedTransformedVoices);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4",
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41",
            Accept: "application/json",
          },
          signal: expect.any(AbortSignal),
        },
      );
    });

    it("should cache voices and avoid redundant API calls", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      // First call should fetch from API
      const voices1 = await voiceService.getAvailableVoices();

      // Second call should use cache
      const voices2 = await voiceService.getAvailableVoices();

      expect(voices1).toEqual(voices2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should refresh cache when force refresh is requested", async () => {
      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();

      // Force refresh call using refreshVoiceCache method
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.refreshVoiceCache();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(voiceService.getAvailableVoices()).rejects.toThrow(
        "Failed to fetch voices: Network error",
      );
    });

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response);

      await expect(voiceService.getAvailableVoices()).rejects.toThrow(
        "Failed to fetch voices: Failed to parse voice data: Invalid JSON",
      );
    });

    it("should handle non-ok response status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(voiceService.getAvailableVoices()).rejects.toThrow(
        "HTTP error! status: 404",
      );
    });
  });

  describe("Voice transformation", () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();
    });

    it("should transform Edge TTS voice format to expo-speech format", async () => {
      const voices = await voiceService.getAvailableVoices();

      expect(voices).toHaveLength(3);
      expect(voices[1]).toEqual({
        identifier: "en-US-AndrewNeural",
        name: "Microsoft Andrew Online (Natural) - English (United States)",
        language: "en-US",
        gender: "Male",
        contentCategories: ["Conversation", "Copilot"],
        voicePersonalities: ["Warm", "Confident", "Authentic", "Honest"],
      });
    });

    it("should include all required properties in transformed voices", async () => {
      const voices = await voiceService.getAvailableVoices();

      voices.forEach((voice) => {
        expect(voice).toHaveProperty("identifier");
        expect(voice).toHaveProperty("name");
        expect(voice).toHaveProperty("language");
        expect(voice).toHaveProperty("gender");
        expect(voice).toHaveProperty("contentCategories");
        expect(voice).toHaveProperty("voicePersonalities");
      });
    });
  });

  describe("Voice filtering and search", () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          ...realSampleVoices,
          {
            Name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)",
            ShortName: "zh-CN-XiaoxiaoNeural",
            Gender: "Female",
            Locale: "zh-CN",
            Status: "GA",
          },
        ],
      } as Response);

      await voiceService.getAvailableVoices();
    });

    it("should filter voices by language", async () => {
      const enUSVoices = await voiceService.getVoicesByLanguage("en-US");

      expect(enUSVoices).toHaveLength(2);
      expect(enUSVoices.every((voice) => voice.language === "en-US")).toBe(
        true,
      );
    });

    it("should return empty array for non-existent language", async () => {
      const voices = await voiceService.getVoicesByLanguage("fr-FR");

      expect(voices).toEqual([]);
    });

    it("should search voices by name using filter", async () => {
      const allVoices = await voiceService.getAvailableVoices();
      const searchResults = allVoices.filter((voice) =>
        voice.name.toLowerCase().includes("andrew"),
      );

      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].identifier).toBe("en-US-AndrewNeural");
    });

    it("should search voices case-insensitively using filter", async () => {
      const allVoices = await voiceService.getAvailableVoices();
      const searchResults = allVoices.filter(
        (voice) =>
          voice.name.toLowerCase().includes("multilingual") ||
          voice.identifier.toLowerCase().includes("multilingual"),
      );

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].identifier).toBe(
        "en-US-AndrewMultilingualNeural",
      );
    });

    it("should search voices by identifier using filter", async () => {
      const allVoices = await voiceService.getAvailableVoices();
      const searchResults = allVoices.filter((voice) =>
        voice.identifier.toLowerCase().includes("en-us-andrew"),
      );

      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].identifier).toBe("en-US-AndrewNeural");
    });

    it("should return empty array for no search matches", async () => {
      const allVoices = await voiceService.getAvailableVoices();
      const searchResults = allVoices.filter(
        (voice) =>
          voice.name.toLowerCase().includes("nonexistent") ||
          voice.identifier.toLowerCase().includes("nonexistent"),
      );

      expect(searchResults).toEqual([]);
    });
  });

  describe("Voice validation", () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();
    });

    it("should validate existing voice selection", async () => {
      const result =
        await voiceService.validateVoiceSelection("en-US-AndrewNeural");

      expect(result.isValid).toBe(true);
      expect(result.voice).toEqual(expectedTransformedVoices[1]);
      expect(result.suggestions || []).toEqual([]);
    });

    it("should reject invalid voice selection and provide suggestions", async () => {
      const result =
        await voiceService.validateVoiceSelection("en-US-InvalidVoice");

      expect(result.isValid).toBe(false);
      expect(result.voice).toBeUndefined();
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
      expect(
        result.suggestions!.every((voice) => voice.language === "en-US"),
      ).toBe(true);
    });

    it("should provide suggestions based on language when available", async () => {
      const result =
        await voiceService.validateVoiceSelection("en-US-NonExistent");

      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
      expect(
        result.suggestions!.every((voice) => voice.language === "en-US"),
      ).toBe(true);
    });
  });

  describe("Voice utilities", () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();
    });

    it("should find voice by identifier", async () => {
      const voice =
        await voiceService.findVoiceByIdentifier("en-US-AndrewNeural");

      expect(voice).toEqual(expectedTransformedVoices[1]);
    });

    it("should return null for non-existent voice identifier", async () => {
      const voice =
        await voiceService.findVoiceByIdentifier("nonexistent-voice");

      expect(voice).toBe(null);
    });

    it("should get default voice for language", async () => {
      const defaultVoice =
        await voiceService.getDefaultVoiceForLanguage("en-US");

      expect(defaultVoice).toEqual(expectedTransformedVoices[1]);
    });

    it("should return null when no voice available for language", async () => {
      const defaultVoice =
        await voiceService.getDefaultVoiceForLanguage("zh-CN");

      expect(defaultVoice).toBe(null);
    });

    it("should get supported languages from available voices", async () => {
      const voices = await voiceService.getAvailableVoices();
      const languages = Array.from(
        new Set(voices.map((voice) => voice.language)),
      );

      expect(languages).toContain("en-US");
      expect(languages).toContain("af-ZA");
    });
  });

  describe("Cache management and fallback", () => {
    it("should use expired cache as fallback when network fails", async () => {
      // First successful call to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();

      // Simulate cache expiry by manipulating internal state
      const oneHourAgo = Date.now() - 3600000;
      (voiceService as any).voiceCache.expiresAt = new Date(oneHourAgo);

      // Network failure
      mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

      // Should return cached data despite expiry
      const voices = await voiceService.getAvailableVoices();

      expect(voices).toEqual(expectedTransformedVoices);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should refresh cache using refreshVoiceCache method", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();
      await voiceService.refreshVoiceCache();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Service statistics and debugging", () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => realSampleVoices,
      } as Response);

      await voiceService.getAvailableVoices();
    });

    it("should provide service statistics", () => {
      const stats = voiceService.getStats();

      expect(stats).toHaveProperty("cacheValid");
      expect(stats).toHaveProperty("cacheExpiration");
      expect(stats).toHaveProperty("cachedVoiceCount");
      expect(stats).toHaveProperty("cacheTimestamp");

      expect(stats.cachedVoiceCount).toBe(3);
      expect(stats.cacheValid).toBe(true);
    });

    it("should track cache validity", async () => {
      // This should use valid cache
      await voiceService.getAvailableVoices();

      const stats = voiceService.getStats();
      expect(stats.cacheValid).toBe(true);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle empty voice list response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const voices = await voiceService.getAvailableVoices();

      expect(voices).toEqual([]);
    });

    it("should handle malformed voice data gracefully", async () => {
      const malformedData = [
        {
          // Missing required fields
          Name: "Invalid Voice",
        },
        {
          identifier: "en-US-AndrewNeural",
          Name: "Valid Voice",
          ShortName: "en-US-AndrewNeural",
          Locale: "en-US",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => malformedData,
      } as Response);

      const voices = await voiceService.getAvailableVoices();

      // Should only include the valid voice
      expect(voices).toHaveLength(1);
      expect(voices[0].identifier).toBe("en-US-AndrewNeural");
    });

    it("should handle fetch timeout", async () => {
      // Mock a fetch that will timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Network timeout")), 50);
          }),
      );

      await expect(voiceService.getAvailableVoices()).rejects.toThrow();
    }, 15000); // Increase timeout for this test
  });
});
