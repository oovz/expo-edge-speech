import { Synthesizer } from "../src/core/synthesizer";
import { StateManager, ApplicationState } from "../src/core/state";
import { ConnectionManager } from "../src/core/connectionManager";
import { AudioService, AudioPlaybackState } from "../src/services/audioService";
import { VoiceService } from "../src/services/voiceService";
import { NetworkService } from "../src/services/networkService";
import { SpeechOptions, EdgeSpeechVoice } from "../src/types";

// Mock all dependencies
jest.mock("../src/core/state");
jest.mock("../src/core/connectionManager");
jest.mock("../src/services/audioService");
jest.mock("../src/services/voiceService");
jest.mock("../src/services/networkService");

describe("Synthesizer", () => {
  let synthesizer: Synthesizer;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockAudioService: jest.Mocked<AudioService>;
  let mockVoiceService: jest.Mocked<VoiceService>;
  let mockNetworkService: jest.Mocked<NetworkService>;

  const mockVoice: EdgeSpeechVoice = {
    identifier: "en-US-AriaNeural",
    name: "Aria",
    language: "en-US",
    gender: "Female",
    contentCategories: ["General"],
    voicePersonalities: ["Friendly"],
  };

  beforeEach(() => {
    // Create mocked instances using proper mock pattern
    mockStateManager = {
      getApplicationState: jest.fn().mockReturnValue(ApplicationState.Idle),
      createSynthesisSession: jest
        .fn()
        .mockImplementation((text: string, options: SpeechOptions) =>
          Promise.resolve({
            id: "session-123",
            connectionId: "connection-123",
            text,
            options,
            state: ApplicationState.Initializing,
            createdAt: new Date(),
            lastActivity: new Date(),
          }),
        ),
      updateSynthesisSession: jest.fn().mockResolvedValue(undefined),
      removeSynthesisSession: jest.fn().mockResolvedValue(undefined),
      getActiveSessions: jest.fn().mockReturnValue([]),
      getSynthesisSession: jest.fn().mockReturnValue(null),
      addStateChangeListener: jest.fn(),
      removeStateChangeListener: jest.fn(),
    } as unknown as jest.Mocked<StateManager>;

    mockConnectionManager = {
      startSynthesis: jest.fn(),
      stopSynthesis: jest.fn(),
      pauseSynthesis: jest.fn(),
      resumeSynthesis: jest.fn(),
      getConnectionPoolStatus: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<ConnectionManager>;

    mockAudioService = {
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      speak: jest.fn().mockResolvedValue(undefined),
      playStreamedAudio: jest.fn().mockResolvedValue(undefined),
      startProgressivePlayback: jest.fn().mockResolvedValue(undefined),
      finalizeProgressivePlayback: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AudioService>;

    mockVoiceService = {
      getAvailableVoices: jest.fn().mockResolvedValue([mockVoice]),
      findVoiceByIdentifier: jest.fn().mockResolvedValue(mockVoice),
      getVoicesByLanguage: jest.fn().mockResolvedValue([mockVoice]),
      validateVoiceSelection: jest.fn().mockReturnValue(true),
      getDefaultVoiceForLanguage: jest.fn().mockResolvedValue(mockVoice),
    } as unknown as jest.Mocked<VoiceService>;

    mockNetworkService = {
      synthesizeText: jest.fn().mockResolvedValue({
        audioChunks: [new Uint8Array([1, 2, 3])],
        boundaries: [],
        duration: 1000,
        completed: true,
      }),
    } as unknown as jest.Mocked<NetworkService>;

    // Setup default mock implementations
    mockStateManager.getApplicationState = jest
      .fn()
      .mockReturnValue(ApplicationState.Idle);
    let sessionCounter = 0;
    mockStateManager.createSynthesisSession = jest
      .fn()
      .mockImplementation((text, options) =>
        Promise.resolve({
          id: `session-${++sessionCounter}`,
          connectionId: `connection-${sessionCounter}`,
          text: text,
          options: options || {},
          state: ApplicationState.Idle,
          createdAt: new Date(),
          lastActivity: new Date(),
        }),
      );
    mockStateManager.updateSynthesisSession = jest
      .fn()
      .mockResolvedValue(undefined);
    mockStateManager.removeSynthesisSession = jest
      .fn()
      .mockResolvedValue(undefined);
    mockStateManager.getActiveSessions = jest.fn().mockReturnValue([]);
    mockStateManager.getSynthesisSession = jest.fn().mockReturnValue(null);
    mockStateManager.addStateChangeListener = jest.fn();
    mockStateManager.removeStateChangeListener = jest.fn();

    // Mock ConnectionManager methods are already set up above

    // Setup AudioService mocks - use Object.defineProperty for read-only properties
    Object.defineProperty(mockAudioService, "currentState", {
      value: AudioPlaybackState.Idle,
      writable: true,
    });
    Object.defineProperty(mockAudioService, "currentConnectionId", {
      value: null,
      writable: true,
    });
    Object.defineProperty(mockAudioService, "isPlaying", {
      value: false,
      writable: true,
    });
    Object.defineProperty(mockAudioService, "isPaused", {
      value: false,
      writable: true,
    });
    Object.defineProperty(mockAudioService, "isStopped", {
      value: true,
      writable: true,
    });

    mockAudioService.pause = jest.fn().mockResolvedValue(undefined);
    mockAudioService.resume = jest.fn().mockResolvedValue(undefined);
    mockAudioService.stop = jest.fn().mockResolvedValue(undefined);
    mockAudioService.speak = jest.fn().mockResolvedValue(undefined);
    mockAudioService.playStreamedAudio = jest.fn().mockResolvedValue(undefined);
    mockAudioService.startProgressivePlayback = jest
      .fn()
      .mockResolvedValue(undefined);
    mockAudioService.finalizeProgressivePlayback = jest
      .fn()
      .mockResolvedValue(undefined);

    mockVoiceService.getAvailableVoices = jest
      .fn()
      .mockResolvedValue([mockVoice]);
    mockVoiceService.findVoiceByIdentifier = jest
      .fn()
      .mockResolvedValue(mockVoice);
    mockVoiceService.getVoicesByLanguage = jest
      .fn()
      .mockResolvedValue([mockVoice]);
    mockVoiceService.validateVoiceSelection = jest.fn().mockReturnValue(true);
    mockVoiceService.getDefaultVoiceForLanguage = jest
      .fn()
      .mockResolvedValue(mockVoice);

    mockNetworkService.synthesizeText = jest.fn().mockResolvedValue({
      audioChunks: [new Uint8Array([1, 2, 3])],
      boundaries: [],
      duration: 1000,
      completed: true,
    });

    // Create synthesizer instance
    synthesizer = new Synthesizer(
      mockStateManager,
      mockConnectionManager,
      mockAudioService,
      mockVoiceService,
      mockNetworkService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("speak", () => {
    it("should successfully synthesize and play speech", async () => {
      const mockOptions: SpeechOptions = {
        onStart: jest.fn(),
        onDone: jest.fn(),
        onError: jest.fn(),
      };

      await synthesizer.speak("Hello world", mockOptions);

      expect(mockStateManager.createSynthesisSession).toHaveBeenCalled();
      expect(mockVoiceService.getVoicesByLanguage).toHaveBeenCalledWith(
        "en-US",
      );
      expect(mockConnectionManager.startSynthesis).toHaveBeenCalled();
    });

    it("should handle empty text input", async () => {
      const mockOptions: SpeechOptions = {
        onError: jest.fn(),
      };

      await expect(synthesizer.speak("", mockOptions)).rejects.toThrow(
        "Text cannot be empty",
      );
      expect(mockOptions.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "synthesis_error",
          message: "Text cannot be empty",
        }),
      );
    });

    it("should use specified voice when provided", async () => {
      const mockOptions: SpeechOptions = {
        voice: "en-US-AriaNeural",
      };

      await synthesizer.speak("Hello world", mockOptions);

      expect(mockVoiceService.findVoiceByIdentifier).toHaveBeenCalledWith(
        "en-US-AriaNeural",
      );
    });

    it("should use specified language when voice not provided", async () => {
      const mockOptions: SpeechOptions = {
        language: "es-ES",
      };

      await synthesizer.speak("Hola mundo", mockOptions);

      expect(mockVoiceService.getVoicesByLanguage).toHaveBeenCalledWith(
        "es-ES",
      );
    });

    it("should apply rate and pitch parameters in SSML", async () => {
      const mockOptions: SpeechOptions = {
        rate: 1.5,
        pitch: 0.8,
      };

      await synthesizer.speak("Hello world", mockOptions);

      const startSynthesisCall =
        mockConnectionManager.startSynthesis.mock.calls[0][0];
      expect(startSynthesisCall).toMatch(/rate="\+50%"/);
      expect(startSynthesisCall).toMatch(/pitch="-20%"/);
    });

    it("should handle synthesis errors", async () => {
      const mockOptions: SpeechOptions = {
        onError: jest.fn(),
      };

      mockConnectionManager.startSynthesis.mockRejectedValue(
        new Error("Network error"),
      );

      // The synthesizer catches errors and calls onError but doesn't re-throw
      await synthesizer.speak("Hello world", mockOptions);

      expect(mockOptions.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "synthesis_error",
          message: "Network error",
        }),
      );
    });

    it("should process boundary events", async () => {
      const mockOptions: SpeechOptions = {
        onBoundary: jest.fn(),
      };

      // Mock ConnectionManager to simulate boundary processing
      mockConnectionManager.startSynthesis.mockImplementation(
        async (ssml, options) => {
          // Simulate boundary event callback
          if (options.onBoundary) {
            // Simulate the boundary event with correct data
            setTimeout(() => {
              options.onBoundary!({
                charIndex: 0,
                charLength: 11, // "Hello world" is 11 characters
              });
            }, 10);
          }
          return Promise.resolve("session-id");
        },
      );

      await synthesizer.speak("Hello world", mockOptions);

      // Boundary callback should be scheduled
      expect(mockOptions.onBoundary).not.toHaveBeenCalled(); // Not called immediately

      // Wait for scheduled callback
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockOptions.onBoundary).toHaveBeenCalledWith({
        charIndex: 0,
        charLength: 11, // "Hello world" is 11 characters
      });
    });
  });

  describe("getAvailableVoicesAsync", () => {
    it("should return available voices", async () => {
      const voices = await synthesizer.getAvailableVoicesAsync();

      expect(voices).toEqual([mockVoice]);
      expect(mockVoiceService.getAvailableVoices).toHaveBeenCalled();
    });

    it("should handle voice service errors gracefully", async () => {
      mockVoiceService.getAvailableVoices.mockRejectedValue(
        new Error("Voice service error"),
      );

      const voices = await synthesizer.getAvailableVoicesAsync();

      expect(voices).toEqual([]);
    });
  });

  describe("isSpeakingAsync", () => {
    it("should return true when audio is playing", async () => {
      Object.defineProperty(mockAudioService, "currentState", {
        value: AudioPlaybackState.Playing,
        writable: true,
      });
      Object.defineProperty(mockAudioService, "isPlaying", {
        value: true,
        writable: true,
      });

      const isSpeaking = await synthesizer.isSpeakingAsync();

      expect(isSpeaking).toBe(true);
    });

    it("should return true when audio is loading", async () => {
      Object.defineProperty(mockAudioService, "currentState", {
        value: AudioPlaybackState.Loading,
        writable: true,
      });

      const isSpeaking = await synthesizer.isSpeakingAsync();

      expect(isSpeaking).toBe(true);
    });

    it("should return false when audio is idle", async () => {
      Object.defineProperty(mockAudioService, "currentState", {
        value: AudioPlaybackState.Idle,
        writable: true,
      });
      Object.defineProperty(mockAudioService, "isPlaying", {
        value: false,
        writable: true,
      });

      const isSpeaking = await synthesizer.isSpeakingAsync();

      expect(isSpeaking).toBe(false);
    });
  });

  describe("stop", () => {
    it("should stop current session through ConnectionManager", async () => {
      // Start a speech session
      await synthesizer.speak("Hello world");

      await synthesizer.stop();

      // Should call ConnectionManager.stopSynthesis() instead of direct audioService.stop()
      expect(mockConnectionManager.stopSynthesis).toHaveBeenCalled();
    });

    it("should trigger onStopped callback through ConnectionManager", async () => {
      const mockOptions: SpeechOptions = {
        onStopped: jest.fn(),
      };

      // Setup ConnectionManager to trigger the callback
      mockConnectionManager.stopSynthesis = jest.fn().mockImplementation(() => {
        mockOptions.onStopped?.();
        return Promise.resolve();
      });

      await synthesizer.speak("Hello world", mockOptions);
      await synthesizer.stop();

      expect(mockConnectionManager.stopSynthesis).toHaveBeenCalled();
      expect(mockOptions.onStopped).toHaveBeenCalled();
    });
  });

  describe("pause and resume", () => {
    it("should pause current playback", async () => {
      // Start a speech session and set it to playing
      await synthesizer.speak("Hello world");

      // Simulate audio playing state
      const currentSession = synthesizer.getCurrentSession();
      if (currentSession) {
        currentSession.state = ApplicationState.Playing;
      }

      await synthesizer.pause();

      expect(mockConnectionManager.pauseSynthesis).toHaveBeenCalled();
    });

    it("should resume paused playbook", async () => {
      // Start a speech session and set it to paused
      await synthesizer.speak("Hello world");

      const currentSession = synthesizer.getCurrentSession();
      if (currentSession) {
        currentSession.state = ApplicationState.Paused;
      }

      await synthesizer.resume();

      expect(mockConnectionManager.resumeSynthesis).toHaveBeenCalled();
    });
  });

  describe("session management", () => {
    it("should create unique session IDs", async () => {
      await synthesizer.speak("First text");
      const firstSession = synthesizer.getCurrentSession();

      await synthesizer.stop();
      await synthesizer.speak("Second text");
      const secondSession = synthesizer.getCurrentSession();

      expect(firstSession?.id).not.toEqual(secondSession?.id);
    });

    it("should track session state transitions", async () => {
      await synthesizer.speak("Hello world");

      const session = synthesizer.getCurrentSession();
      expect(session?.state).toBe("synthesizing");
    });

    it("should handle multiple sessions", async () => {
      await synthesizer.speak("First text");

      const sessions = synthesizer.getAllSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("should clear all sessions and reset state", async () => {
      await synthesizer.speak("Hello world");

      await synthesizer.reset();

      expect(synthesizer.getCurrentSession()).toBeNull();
      expect(synthesizer.getAllSessions()).toHaveLength(0);
    });
  });

  describe("voice resolution", () => {
    it("should fallback to language-based selection when voice not found", async () => {
      mockVoiceService.findVoiceByIdentifier.mockResolvedValue(null);

      await synthesizer.speak("Hello world", {
        voice: "invalid-voice",
        language: "en-US",
      });

      expect(mockVoiceService.getVoicesByLanguage).toHaveBeenCalledWith(
        "en-US",
      );
    });

    it("should fallback to default en-US voice when no voice or language specified", async () => {
      await synthesizer.speak("Hello world");

      expect(mockVoiceService.getVoicesByLanguage).toHaveBeenCalledWith(
        "en-US",
      );
    });

    it("should handle error when no suitable voice found", async () => {
      mockVoiceService.findVoiceByIdentifier.mockResolvedValue(null);
      mockVoiceService.getVoicesByLanguage.mockResolvedValue([]);

      const mockOptions: SpeechOptions = {
        onError: jest.fn(),
      };

      await synthesizer.speak("Hello world", mockOptions);

      expect(mockOptions.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "SynthesisError",
          code: "synthesis_error",
          message: "Voice resolution failed: No suitable voice found",
        }),
      );
    });
  });

  describe("SSML generation", () => {
    it("should generate basic SSML with prosody tags for default values", async () => {
      await synthesizer.speak("Hello world");

      expect(mockConnectionManager.startSynthesis).toHaveBeenCalledWith(
        expect.stringMatching(
          /<speak[^>]*>[\s\S]*<voice[^>]*>[\s\S]*<prosody[^>]*>[\s\S]*Hello world[\s\S]*<\/prosody>[\s\S]*<\/voice>[\s\S]*<\/speak>/,
        ),
        expect.objectContaining({
          voice: "en-US-AriaNeural",
        }),
      );
    });

    it("should generate SSML with prosody when rate or pitch specified", async () => {
      await synthesizer.speak("Hello world", { rate: 1.2 });

      expect(mockConnectionManager.startSynthesis).toHaveBeenCalledWith(
        expect.stringContaining("<prosody"),
        expect.objectContaining({
          voice: "en-US-AriaNeural",
        }),
      );
    });

    it("should clamp rate and pitch values to valid ranges", async () => {
      await synthesizer.speak("Hello world", { rate: 5.0, pitch: 0.1 });

      const startSynthesisCall =
        mockConnectionManager.startSynthesis.mock.calls[0];
      const ssmlText = startSynthesisCall[0]; // First parameter is the SSML text
      expect(ssmlText).toContain('rate="+100%"'); // Clamped to 2.0
      expect(ssmlText).toContain('pitch="-90%"'); // pitch 0.1 with 0-2 range maps to -90%
    });
  });
});
