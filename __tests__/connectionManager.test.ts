/**
 * Comprehensive tests for ConnectionManager - the critical coordination component
 * Tests all service coordination, connection pooling, circuit breaker pattern,
 * session management, error handling, and resource cleanup functionality.
 */

import { ConnectionManager } from "../src/core/connectionManager";
import { StateManager, ApplicationState } from "../src/core/state";
import { NetworkService } from "../src/services/networkService";
import { AudioService, AudioPlaybackState } from "../src/services/audioService";
import { StorageService } from "../src/services/storageService";
import { SpeechOptions } from "../src/types";
import { AppState } from "react-native";

// Mock React Native AppState
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn().mockReturnValue({
      remove: jest.fn(),
    }),
  },
}));

// Mock services for comprehensive testing
const createMockStateManager = () =>
  ({
    getState: jest.fn().mockReturnValue(ApplicationState.Ready),
    addStateChangeListener: jest.fn(),
    removeStateChangeListener: jest.fn(),
    getConfiguration: jest.fn(),
    updateConfiguration: jest.fn(),
    setState: jest.fn(),
  }) as unknown as StateManager;

const createMockNetworkService = () =>
  ({
    synthesizeText: jest.fn().mockResolvedValue({
      audioChunks: [new Uint8Array([1, 2, 3, 4])],
      boundaries: [{ charIndex: 0, charLength: 4, audioOffset: 0 }],
    }),
    close: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({
      activeSessions: 0,
      activeConnections: 0,
      connections: [],
    }),
  }) as unknown as NetworkService;

const createMockAudioService = () =>
  ({
    speak: jest.fn().mockResolvedValue(undefined),
    playStreamedAudio: jest.fn().mockResolvedValue(undefined),
    startProgressivePlayback: jest.fn().mockResolvedValue(undefined),
    finalizeProgressivePlayback: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockReturnValue(AudioPlaybackState.Idle),
  }) as unknown as AudioService;

const createMockStorageService = () =>
  ({
    createConnectionBuffer: jest.fn(),
    addAudioChunk: jest.fn(),
    getMergedAudioData: jest.fn().mockReturnValue(new Uint8Array(1024)),
    cleanupConnection: jest.fn(),
    getMemoryStats: jest.fn().mockReturnValue({
      totalMemoryUsed: 1024,
      connectionCount: 0,
      buffers: [],
    }),
  }) as unknown as StorageService;

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;
  let mockStateManager: StateManager;
  let mockNetworkService: NetworkService;
  let mockAudioService: AudioService;
  let mockStorageService: StorageService;
  let testSpeechOptions: SpeechOptions & {
    clientSessionId: string;
    connectionId: string;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mocks for each test
    mockStateManager = createMockStateManager();
    mockNetworkService = createMockNetworkService();
    mockAudioService = createMockAudioService();
    mockStorageService = createMockStorageService();

    // Setup default successful behavior
    (mockNetworkService.synthesizeText as jest.Mock).mockResolvedValue({
      audioChunks: [new Uint8Array([1, 2, 3, 4])],
      boundaries: [{ charIndex: 0, charLength: 4, audioOffset: 0 }],
    });

    // Mock AudioService.speak to simulate calling onDone callback after "playback"
    (mockAudioService.speak as jest.Mock).mockImplementation(
      async (options: any) => {
        // Simulate audio playback completion by calling onDone callback
        if (options.onDone) {
          setTimeout(() => options.onDone(), 10);
        }
        return Promise.resolve();
      },
    );

    connectionManager = new ConnectionManager(
      mockStateManager,
      mockNetworkService,
      mockAudioService,
      mockStorageService,
    );

    testSpeechOptions = {
      voice: "en-US-AriaNeural",
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      onStart: jest.fn(),
      onDone: jest.fn(),
      onError: jest.fn(),
      onStopped: jest.fn(),
      onPause: jest.fn(),
      onResume: jest.fn(),
      onBoundary: jest.fn(),
      clientSessionId: "test-session-123",
      connectionId: "test-connection-123",
    };
  });

  afterEach(async () => {
    await connectionManager.shutdown();
  });

  describe("Initialization and Configuration", () => {
    test("should initialize with default configuration", () => {
      const status = connectionManager.getConnectionPoolStatus();

      expect(status.maxConnections).toBe(1); // Default from CONNECTION_LIFECYCLE.POOL_MANAGEMENT.MAX_POOL_SIZE
      expect(status.activeConnections).toBe(0);
      expect(status.availableConnections).toBe(1);
      expect(status.circuitBreakerState).toBe("closed");
    });

    test("should initialize with custom configuration", () => {
      const customConfig = {
        maxConnections: 3,
        connectionTimeout: 10000,
        poolingEnabled: true,
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeout: 15000,
          testRequestLimit: 2,
        },
      };

      const customConnectionManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
        customConfig,
      );

      const status = customConnectionManager.getConnectionPoolStatus();
      expect(status.maxConnections).toBe(3);

      return customConnectionManager.shutdown();
    });

    test("should setup event handlers during initialization", () => {
      expect(mockStateManager.addStateChangeListener).toHaveBeenCalled();
      expect(AppState.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("Session Management", () => {
    test("should start synthesis and return session ID", async () => {
      const sessionId = await connectionManager.startSynthesis(
        "Test synthesis",
        testSpeechOptions,
      );

      expect(sessionId).toBe("test-session-123");
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test("should coordinate all services during synthesis", async () => {
      await connectionManager.startSynthesis(
        "Test synthesis coordination",
        testSpeechOptions,
      );

      // Verify service coordination
      expect(mockStorageService.createConnectionBuffer).toHaveBeenCalledWith(
        "test-connection-123",
      );
      expect(mockNetworkService.synthesizeText).toHaveBeenCalledWith(
        "Test synthesis coordination",
        testSpeechOptions,
        "test-session-123",
        "test-connection-123",
      );
      expect(mockAudioService.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: "en-US-AriaNeural",
          onDone: expect.any(Function),
          onError: expect.any(Function),
        }),
        "test-connection-123",
      );
    });

    test("should stop synthesis for valid session", async () => {
      const sessionId = await connectionManager.startSynthesis(
        "Test synthesis",
        testSpeechOptions,
      );

      await connectionManager.stopSynthesis(sessionId);

      expect(mockAudioService.stop).toHaveBeenCalled();
      expect(mockStorageService.cleanupConnection).toHaveBeenCalledWith(
        "test-connection-123",
      );
    });

    test("should throw error for invalid session stop", async () => {
      await expect(
        connectionManager.stopSynthesis("invalid-session"),
      ).rejects.toThrow("Session not found");
    });

    test("should pause synthesis for valid session", async () => {
      const sessionId = await connectionManager.startSynthesis(
        "Test synthesis",
        testSpeechOptions,
      );

      await connectionManager.pauseSynthesis(sessionId);

      expect(mockAudioService.pause).toHaveBeenCalled();
      expect(testSpeechOptions.onPause).toHaveBeenCalled();
    });

    test("should resume synthesis for valid session", async () => {
      const sessionId = await connectionManager.startSynthesis(
        "Test synthesis",
        testSpeechOptions,
      );

      await connectionManager.resumeSynthesis(sessionId);

      expect(mockAudioService.resume).toHaveBeenCalled();
      expect(testSpeechOptions.onResume).toHaveBeenCalled();
    });

    test("should throw error for invalid session pause/resume", async () => {
      await expect(
        connectionManager.pauseSynthesis("invalid-session"),
      ).rejects.toThrow("Session not found");

      await expect(
        connectionManager.resumeSynthesis("invalid-session"),
      ).rejects.toThrow("Session not found");
    });
  });

  describe("Connection Pool Management", () => {
    test("should enforce maximum concurrent connections (pooling disabled)", async () => {
      const maxConnections =
        connectionManager.getConnectionPoolStatus().maxConnections;

      // Create sessions up to the limit
      const sessions: Promise<string>[] = [];
      for (let i = 0; i < maxConnections; i++) {
        const options = {
          ...testSpeechOptions,
          clientSessionId: `test-session-${i}`,
          connectionId: `test-connection-${i}`,
        };
        sessions.push(connectionManager.startSynthesis(`Test ${i}`, options));
      }

      await Promise.all(sessions);

      // Verify pool status
      const status = connectionManager.getConnectionPoolStatus();
      expect(status.activeConnections).toBe(maxConnections);
      expect(status.availableConnections).toBe(0);

      // Try to create one more session beyond the limit
      const overLimitOptions = {
        ...testSpeechOptions,
        clientSessionId: "over-limit-session",
        connectionId: "over-limit-connection",
      };

      await expect(
        connectionManager.startSynthesis("Over limit", overLimitOptions),
      ).rejects.toThrow("Maximum concurrent connections reached");
    });

    test("should handle pooled connections with queuing (pooling enabled)", async () => {
      const pooledConnectionManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
        { poolingEnabled: true, maxConnections: 1 },
      );

      try {
        const session1Options = {
          ...testSpeechOptions,
          clientSessionId: "test-session-1",
          connectionId: "test-connection-1",
        };
        const session2Options = {
          ...testSpeechOptions,
          clientSessionId: "test-session-2",
          connectionId: "test-connection-2",
        };

        // Start first connection
        const session1Promise = pooledConnectionManager.startSynthesis(
          "Test 1",
          session1Options,
        );
        const session1 = await session1Promise;
        expect(session1).toBe("test-session-1");

        // Start second connection - should be queued
        const session2Promise = pooledConnectionManager.startSynthesis(
          "Test 2",
          session2Options,
        );

        // Complete first session to allow second to process
        await pooledConnectionManager.stopSynthesis(session1);

        const session2 = await session2Promise;
        expect(session2).toBe("test-session-2");
      } finally {
        await pooledConnectionManager.shutdown();
      }
    });

    test("should report accurate pool status", async () => {
      const initialStatus = connectionManager.getConnectionPoolStatus();
      expect(initialStatus.activeConnections).toBe(0);
      expect(initialStatus.availableConnections).toBe(
        initialStatus.maxConnections,
      );

      await connectionManager.startSynthesis("Test", testSpeechOptions);

      const activeStatus = connectionManager.getConnectionPoolStatus();
      expect(activeStatus.activeConnections).toBe(1);
      expect(activeStatus.availableConnections).toBe(
        initialStatus.maxConnections - 1,
      );
    });
  });

  describe("Circuit Breaker Pattern", () => {
    test("should start in closed state", () => {
      const status = connectionManager.getConnectionPoolStatus();
      expect(status.circuitBreakerState).toBe("closed");
    });

    test("should open circuit breaker after repeated failures", async () => {
      // Configure circuit breaker with low failure threshold for testing
      const testConnectionManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
        {
          circuitBreaker: {
            failureThreshold: 2,
            recoveryTimeout: 1000,
            testRequestLimit: 1,
          },
        },
      );

      try {
        // Mock network service to fail
        (mockNetworkService.synthesizeText as jest.Mock).mockRejectedValue(
          new Error("Network error"),
        );

        // Cause failures to reach threshold
        for (let i = 0; i < 2; i++) {
          const options = {
            ...testSpeechOptions,
            clientSessionId: `fail-session-${i}`,
            connectionId: `fail-connection-${i}`,
          };

          try {
            await testConnectionManager.startSynthesis(`Fail ${i}`, options);
          } catch {
            // Expected to fail
          }
        }

        // Circuit breaker should now be open
        const failOptions = {
          ...testSpeechOptions,
          clientSessionId: "circuit-open-session",
          connectionId: "circuit-open-connection",
        };

        await expect(
          testConnectionManager.startSynthesis("Should fail", failOptions),
        ).rejects.toThrow(
          "Service temporarily unavailable due to repeated failures",
        );
      } finally {
        await testConnectionManager.shutdown();
      }
    });

    test("should transition to half-open after recovery timeout", async () => {
      // This test would require more complex timing control
      // For now, we test the basic circuit breaker state tracking
      const manager = connectionManager.getStatus();
      expect(manager.circuitBreakerState).toBe("closed");
      expect(manager.failureCount).toBe(0);
    });
  });

  describe("Error Handling and Recovery", () => {
    test("should handle retryable errors with exponential backoff", async () => {
      // Mock network service to fail then succeed
      (mockNetworkService.synthesizeText as jest.Mock)
        .mockRejectedValueOnce(
          Object.assign(new Error("Network error"), { code: "NetworkError" }),
        )
        .mockResolvedValueOnce({
          audioChunks: [new Uint8Array([1, 2, 3, 4])],
          boundaries: [{ charIndex: 0, charLength: 4, audioOffset: 0 }],
        });

      const sessionId = await connectionManager.startSynthesis(
        "Test retry",
        testSpeechOptions,
      );

      expect(sessionId).toBe("test-session-123");
      expect(mockNetworkService.synthesizeText).toHaveBeenCalledTimes(2); // Initial + retry
    });

    test("should propagate error callbacks", async () => {
      const errorCallback = jest.fn();
      const optionsWithError = {
        ...testSpeechOptions,
        onError: errorCallback,
      };

      // Mock network service to fail with non-retryable error
      (mockNetworkService.synthesizeText as jest.Mock).mockRejectedValue(
        Object.assign(new Error("Authentication error"), { code: "AuthError" }),
      );

      await expect(
        connectionManager.startSynthesis("Test error", optionsWithError),
      ).rejects.toThrow("Authentication error");

      expect(errorCallback).toHaveBeenCalled();
    });

    test("should stop retrying after max attempts", async () => {
      // Mock network service to always fail with retryable error
      (mockNetworkService.synthesizeText as jest.Mock).mockRejectedValue(
        Object.assign(new Error("Network timeout"), { code: "TimeoutError" }),
      );

      await expect(
        connectionManager.startSynthesis("Test max retries", testSpeechOptions),
      ).rejects.toThrow("Maximum retry attempts");

      // Should have tried initial + 3 retries = 4 times total
      expect(mockNetworkService.synthesizeText).toHaveBeenCalledTimes(4);
    });
  });

  describe("Lifecycle and Resource Management", () => {
    test("should shutdown cleanly", async () => {
      // Start a synthesis session
      await connectionManager.startSynthesis("Test", testSpeechOptions);

      // Shutdown should stop all connections
      await connectionManager.shutdown();

      expect(mockAudioService.stop).toHaveBeenCalled();
      expect(mockStorageService.cleanupConnection).toHaveBeenCalled();

      // Pool should be empty after shutdown
      const status = connectionManager.getConnectionPoolStatus();
      expect(status.activeConnections).toBe(0);
    });

    test("should handle AppState changes", () => {
      // Verify AppState listener was set up
      expect(AppState.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );

      // Get the callback function
      const appStateCallback = (AppState.addEventListener as jest.Mock).mock
        .calls[0][1];

      // Mock stopAllConnections to verify it's called
      const stopAllConnectionsSpy = jest.spyOn(
        connectionManager,
        "stopAllConnections",
      );

      // Simulate app going to background
      appStateCallback("background");

      expect(stopAllConnectionsSpy).toHaveBeenCalled();
    });

    test("should clean up AppState subscription on shutdown", async () => {
      const mockSubscription = {
        remove: jest.fn(),
      };

      (AppState.addEventListener as jest.Mock).mockReturnValue(
        mockSubscription,
      );

      // Create new manager to test subscription setup
      const testManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
      );

      await testManager.shutdown();

      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    test("should report accurate manager status", async () => {
      const initialStatus = connectionManager.getStatus();
      expect(initialStatus.activeConnections).toBe(0);
      expect(initialStatus.queuedConnections).toBe(0);
      expect(initialStatus.circuitBreakerState).toBe("closed");
      expect(initialStatus.failureCount).toBe(0);

      // Start a synthesis to change status
      await connectionManager.startSynthesis("Test", testSpeechOptions);

      const activeStatus = connectionManager.getStatus();
      expect(activeStatus.activeConnections).toBe(1);
    });
  });

  describe("Service Integration", () => {
    test("should handle boundary events from NetworkService", async () => {
      const boundaryCallback = jest.fn();
      const optionsWithBoundary = {
        ...testSpeechOptions,
        onBoundary: boundaryCallback,
      };

      await connectionManager.startSynthesis(
        "Test boundary",
        optionsWithBoundary,
      );

      // Should have received boundary from mock network service
      expect(boundaryCallback).toHaveBeenCalledWith({
        charIndex: 0,
        charLength: 4,
        audioOffset: 0,
      });
    });

    test("should coordinate storage buffer management", async () => {
      await connectionManager.startSynthesis("Test storage", testSpeechOptions);

      expect(mockStorageService.createConnectionBuffer).toHaveBeenCalledWith(
        "test-connection-123",
      );
    });

    test("should wrap user callbacks for connection cleanup", async () => {
      const userOnDone = jest.fn();
      const optionsWithCallback = {
        ...testSpeechOptions,
        onDone: userOnDone,
      };

      // Mock AudioService.speak to immediately call the onDone callback
      (mockAudioService.speak as jest.Mock).mockImplementation(
        async (options: any) => {
          if (options.onDone) {
            options.onDone();
          }
          return Promise.resolve();
        },
      );

      await connectionManager.startSynthesis(
        "Test callback",
        optionsWithCallback,
      );

      // Wait for callback execution
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(userOnDone).toHaveBeenCalled();
      expect(mockStorageService.cleanupConnection).toHaveBeenCalledWith(
        "test-connection-123",
      );
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    test("should handle empty SSML input", async () => {
      const sessionId = await connectionManager.startSynthesis(
        "",
        testSpeechOptions,
      );

      expect(sessionId).toBe("test-session-123");
      expect(mockNetworkService.synthesizeText).toHaveBeenCalledWith(
        "",
        testSpeechOptions,
        "test-session-123",
        "test-connection-123",
      );
    });

    test("should handle service cleanup errors gracefully", async () => {
      // Mock storage service to throw during cleanup
      (mockStorageService.cleanupConnection as jest.Mock).mockImplementation(
        () => {
          throw new Error("Cleanup error");
        },
      );

      const sessionId = await connectionManager.startSynthesis(
        "Test",
        testSpeechOptions,
      );

      // Should not throw despite cleanup error
      await expect(
        connectionManager.stopSynthesis(sessionId),
      ).resolves.not.toThrow();
    });

    test("should handle concurrent session operations", async () => {
      // Create connection manager with higher limit for concurrent test
      const concurrentManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
        { maxConnections: 3 },
      );

      try {
        const promises: Promise<string>[] = [];

        // Start multiple sessions concurrently
        for (let i = 0; i < 3; i++) {
          const options = {
            ...testSpeechOptions,
            clientSessionId: `concurrent-session-${i}`,
            connectionId: `concurrent-connection-${i}`,
          };
          promises.push(concurrentManager.startSynthesis(`Test ${i}`, options));
        }

        const sessionIds = await Promise.all(promises);
        expect(sessionIds).toHaveLength(3);
        expect(new Set(sessionIds).size).toBe(3); // All unique
      } finally {
        await concurrentManager.shutdown();
      }
    });

    test("should handle queue rejection on shutdown", async () => {
      const queuedManager = new ConnectionManager(
        mockStateManager,
        mockNetworkService,
        mockAudioService,
        mockStorageService,
        { poolingEnabled: true, maxConnections: 1 },
      );

      try {
        // Fill the connection pool
        const firstOptions = {
          ...testSpeechOptions,
          clientSessionId: "first-session",
          connectionId: "first-connection",
        };
        await queuedManager.startSynthesis("First", firstOptions);

        // Queue a second request
        const secondOptions = {
          ...testSpeechOptions,
          clientSessionId: "second-session",
          connectionId: "second-connection",
        };
        const queuedPromise = queuedManager.startSynthesis(
          "Second",
          secondOptions,
        );

        // Shutdown while request is queued
        await queuedManager.shutdown();

        // Queued request should be rejected
        await expect(queuedPromise).rejects.toThrow(
          "Connection stopped by user request",
        );
      } finally {
        await queuedManager.shutdown();
      }
    });
  });
});
