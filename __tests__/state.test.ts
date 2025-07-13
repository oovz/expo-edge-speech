/**
 * Test Criteria:
 * - State changes are properly tracked using Storage Service capabilities
 * - Configuration updates work with complete constants and types from Phase 4
 * - Service coordination maintains consistent state across all services
 * - Event notifications work using proper callback types from expanded interfaces
 * - Thread safety works in JavaScript environment
 * - Integration with all services maintains state consistency
 */

import {
  StateManager,
  ApplicationState,
  StateChangeListener,
} from "../src/core/state";
import { SpeechOptions, ConnectionState } from "../src/types";
import { AudioPlaybackState } from "../src/services/audioService";

// Mock commonUtils module to control generateConnectionId
jest.mock("../src/utils/commonUtils", () => ({
  ...jest.requireActual("../src/utils/commonUtils"),
  generateConnectionId: jest.fn().mockReturnValue("connection-123"),
}));

// =============================================================================
// Mock Services
// =============================================================================

const mockStorageService = {
  createConnection: jest.fn().mockResolvedValue("connection-123"),
  createConnectionBuffer: jest.fn().mockResolvedValue("connection-123"),
  cleanupConnection: jest.fn().mockResolvedValue(undefined),
  getActiveConnectionCount: jest.fn().mockReturnValue(1),
  getMemoryStats: jest
    .fn()
    .mockReturnValue({ totalMemory: 1024, usedMemory: 512 }),
  initialize: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
  onConnectionStateChange: jest.fn(),
};

const mockNetworkService = {
  onConnectionStateChange: jest.fn(),
  cleanup: jest.fn().mockResolvedValue(undefined),
};

const mockVoiceService = {
  initialize: jest.fn().mockResolvedValue(undefined),
};

const mockAudioService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
  onPlaybackStateChange: jest.fn(),
};

// =============================================================================
// Test Setup
// =============================================================================

describe("StateManager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock implementations to their default resolved state
    mockStorageService.initialize.mockResolvedValue(undefined);
    mockVoiceService.initialize.mockResolvedValue(undefined);
    mockAudioService.initialize.mockResolvedValue(undefined);
    mockStorageService.cleanup.mockResolvedValue(undefined);
    mockNetworkService.cleanup.mockResolvedValue(undefined);
    mockAudioService.cleanup.mockResolvedValue(undefined);

    stateManager = new StateManager(
      mockStorageService as any,
      mockNetworkService as any,
      mockVoiceService as any,
      mockAudioService as any,
    );
  });

  // =============================================================================
  // Configuration Management Tests
  // =============================================================================

  describe("Configuration Management", () => {
    test("should create default configuration using complete constants", () => {
      const config = stateManager.getConfiguration();

      expect(config).toEqual({
        audioFormat: {
          format: "audio-24khz-48kbitrate-mono-mp3",
          sampleRate: 24000,
          bitRate: 48000,
          channels: 1,
        },
        connectionPooling: {
          maxConnections: 1, // From CONNECTION_LIFECYCLE.POOL_MANAGEMENT.MAX_POOL_SIZE
          connectionTimeout: 10000, // From CONNECTION_LIFECYCLE.TIMEOUTS.CONNECTION_ESTABLISHMENT
          reuseConnections: false, // From CONNECTION_LIFECYCLE.POOL_MANAGEMENT.CONNECTION_REUSE
        },
        wordBoundary: {
          enabled: true,
          offsetCompensation: 8750000, // 8,750,000 ticks padding
        },
      });
    });

    test("should update configuration with state change notification", async () => {
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      const updates = {
        connectionPooling: {
          maxConnections: 2,
          connectionTimeout: 10000,
          reuseConnections: false,
        },
      };

      await stateManager.updateConfiguration(updates);

      const updatedConfig = stateManager.getConfiguration();
      expect(updatedConfig.connectionPooling.maxConnections).toBe(2);
      expect(updatedConfig.connectionPooling.connectionTimeout).toBe(10000);
      expect(updatedConfig.connectionPooling.reuseConnections).toBe(false);

      // Verify state change notification was triggered
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "configuration",
          newState: expect.objectContaining({
            connectionPooling: expect.objectContaining({
              maxConnections: 2,
              connectionTimeout: 10000,
              reuseConnections: false,
            }),
          }),
          context: { updates },
        }),
      );
    });

    test("should accept initial configuration overrides", () => {
      const initialConfig = {
        connectionPooling: {
          maxConnections: 5,
          connectionTimeout: 15000,
          reuseConnections: false,
        },
      };

      const customStateManager = new StateManager(
        mockStorageService as any,
        mockNetworkService as any,
        mockVoiceService as any,
        mockAudioService as any,
        initialConfig,
      );

      const config = customStateManager.getConfiguration();
      expect(config.connectionPooling.maxConnections).toBe(5);
      expect(config.connectionPooling.connectionTimeout).toBe(15000);
      expect(config.connectionPooling.reuseConnections).toBe(false);
    });
  });

  // =============================================================================
  // Application State Management Tests
  // =============================================================================

  describe("Application State Management", () => {
    test("should initialize with Idle state", () => {
      expect(stateManager.getApplicationState()).toBe(ApplicationState.Idle);
    });

    test("should update application state during initialization", async () => {
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      await stateManager.initialize();

      expect(stateManager.getApplicationState()).toBe(ApplicationState.Ready);

      // Verify state transitions were notified
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "application",
          previousState: ApplicationState.Idle,
          newState: ApplicationState.Initializing,
        }),
      );

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "application",
          previousState: ApplicationState.Initializing,
          newState: ApplicationState.Ready,
        }),
      );
    });

    test("should handle initialization errors", async () => {
      mockVoiceService.initialize.mockRejectedValue(
        new Error("Voice service error"),
      );

      await expect(stateManager.initialize()).rejects.toThrow(
        "Voice service error",
      );
      expect(stateManager.getApplicationState()).toBe(ApplicationState.Error);
    });
  });

  // =============================================================================
  // Speech Synthesis Session Management Tests
  // =============================================================================

  describe("Speech Synthesis Session Management", () => {
    test("should create synthesis session - buffer creation handled by ConnectionManager", async () => {
      const text = "Hello world";
      const options: SpeechOptions = { voice: "en-US-AriaNeural" };

      const session = await stateManager.createSynthesisSession(text, options);

      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      // Note: StateManager no longer creates connection buffers directly
      // This is now handled by ConnectionManager to avoid duplication
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();

      const retrievedSession = stateManager.getSynthesisSession(session.id);
      expect(retrievedSession).toEqual({
        id: session.id,
        connectionId: "connection-123",
        text,
        options,
        state: ApplicationState.Initializing,
        createdAt: expect.any(Date),
        lastActivity: expect.any(Date),
      });
    });

    test("should track active synthesis sessions", async () => {
      const session1 = await stateManager.createSynthesisSession("Text 1", {});
      const session2 = await stateManager.createSynthesisSession("Text 2", {});

      const activeSessions = stateManager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map((s) => s.id)).toContain(session1.id);
      expect(activeSessions.map((s) => s.id)).toContain(session2.id);
    });

    test("should update synthesis session state", async () => {
      const session = await stateManager.createSynthesisSession("Test", {});
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      await stateManager.updateSynthesisSession(session.id, {
        state: ApplicationState.Synthesizing,
      });

      const updatedSession = stateManager.getSynthesisSession(session.id);
      expect(updatedSession!.state).toBe(ApplicationState.Synthesizing);
      expect(updatedSession!.lastActivity).toBeInstanceOf(Date);

      // Verify state change notification
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "synthesis",
          newState: expect.objectContaining({
            state: ApplicationState.Synthesizing,
          }),
          context: {
            sessionId: session.id,
            updates: { state: ApplicationState.Synthesizing },
          },
        }),
      );
    });

    test("should remove synthesis session and cleanup connection", async () => {
      const session = await stateManager.createSynthesisSession("Test", {});
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      await stateManager.removeSynthesisSession(session.id);

      expect(stateManager.getSynthesisSession(session.id)).toBeUndefined();
      expect(mockStorageService.cleanupConnection).toHaveBeenCalledWith(
        "connection-123",
      );

      // Verify state change notification
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "synthesis",
          newState: null,
          context: { action: "removed", sessionId: session.id },
        }),
      );
    });
  });

  // =============================================================================
  // Service Coordination Tests
  // =============================================================================

  describe("Service Coordination", () => {
    test("should coordinate state between all services", async () => {
      await stateManager.initialize();

      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(mockVoiceService.initialize).toHaveBeenCalled();
      expect(mockAudioService.initialize).toHaveBeenCalled();
    });

    test("should handle connection state changes from Storage Service", async () => {
      const session = await stateManager.createSynthesisSession("Test", {});
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      // Simulate storage service connection state change
      const connectionStateHandler =
        mockStorageService.onConnectionStateChange.mock.calls[0][0];
      connectionStateHandler("connection-123", ConnectionState.Connected);

      // Verify session state was updated
      await new Promise((resolve) => setTimeout(resolve, 0)); // Allow async updates
      const updatedSession = stateManager.getSynthesisSession(session.id);
      expect(updatedSession!.state).toBe(ApplicationState.Ready);
    });

    test("should handle connection state changes from Network Service", async () => {
      const networkSession = await stateManager.createSynthesisSession(
        "Test",
        {},
      );

      // Simulate network service connection state change
      const connectionStateHandler =
        mockNetworkService.onConnectionStateChange.mock.calls[0][0];
      connectionStateHandler("connection-123", ConnectionState.Synthesizing);

      // Verify session state was updated
      await new Promise((resolve) => setTimeout(resolve, 0)); // Allow async updates
      const updatedNetworkSession = stateManager.getSynthesisSession(
        networkSession.id,
      );
      expect(updatedNetworkSession!.state).toBe(ApplicationState.Synthesizing);
    });

    test("should handle audio state changes from Audio Service", async () => {
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      // Simulate audio service playback state change
      const audioStateHandler =
        mockAudioService.onPlaybackStateChange.mock.calls[0][0];
      audioStateHandler(AudioPlaybackState.Playing, { duration: 5000 });

      // Verify application state was updated
      await new Promise((resolve) => setTimeout(resolve, 0)); // Allow async updates
      expect(stateManager.getApplicationState()).toBe(ApplicationState.Playing);

      // Verify state change notification
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "audio",
          newState: AudioPlaybackState.Playing,
          context: { duration: 5000 },
        }),
      );
    });
  });

  // =============================================================================
  // Thread Safety Tests
  // =============================================================================

  describe("Thread Safety", () => {
    test("should handle concurrent state updates safely", async () => {
      const promises: Promise<void>[] = [];

      // Create multiple concurrent updates
      for (let i = 0; i < 10; i++) {
        promises.push(
          stateManager.updateConfiguration({
            connectionPooling: {
              maxConnections: i,
              connectionTimeout: 5000,
              reuseConnections: true,
            },
          }),
        );
      }

      // Wait for all updates to complete
      await Promise.all(promises);

      // Configuration should be in a valid state
      const config = stateManager.getConfiguration();
      expect(config.connectionPooling.maxConnections).toBeGreaterThanOrEqual(0);
      expect(config.connectionPooling.maxConnections).toBeLessThan(10);
    });

    test("should process state updates sequentially", async () => {
      const updateOrder: number[] = [];
      const listener: StateChangeListener = (event) => {
        if (event.type === "configuration") {
          updateOrder.push(event.newState.connectionPooling.maxConnections);
        }
      };

      stateManager.addStateChangeListener(listener);

      // Queue multiple updates rapidly
      const promises = [
        stateManager.updateConfiguration({
          connectionPooling: {
            maxConnections: 1,
            connectionTimeout: 5000,
            reuseConnections: true,
          },
        }),
        stateManager.updateConfiguration({
          connectionPooling: {
            maxConnections: 2,
            connectionTimeout: 5000,
            reuseConnections: true,
          },
        }),
        stateManager.updateConfiguration({
          connectionPooling: {
            maxConnections: 3,
            connectionTimeout: 5000,
            reuseConnections: true,
          },
        }),
      ];

      await Promise.all(promises);

      // Updates should be processed in some order
      expect(updateOrder).toHaveLength(3);
      expect(updateOrder).toContain(1);
      expect(updateOrder).toContain(2);
      expect(updateOrder).toContain(3);
    });
  });

  // =============================================================================
  // Event Listeners and Notifications Tests
  // =============================================================================

  describe("Event Listeners and Notifications", () => {
    test("should add and remove state change listeners", async () => {
      const listener1: StateChangeListener = jest.fn();
      const listener2: StateChangeListener = jest.fn();

      stateManager.addStateChangeListener(listener1);
      stateManager.addStateChangeListener(listener2);

      // Trigger state change
      await stateManager.updateConfiguration({
        wordBoundary: { enabled: false, offsetCompensation: 0 },
      });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Remove listener and verify
      stateManager.removeStateChangeListener(listener1);
      jest.clearAllMocks();

      await stateManager.updateConfiguration({
        wordBoundary: { enabled: true, offsetCompensation: 8750000 },
      });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test("should handle listener errors gracefully", async () => {
      const errorListener: StateChangeListener = jest
        .fn()
        .mockImplementation(() => {
          throw new Error("Listener error");
        });
      const normalListener: StateChangeListener = jest.fn();

      stateManager.addStateChangeListener(errorListener);
      stateManager.addStateChangeListener(normalListener);

      // Console.error should be called, but other listeners should still work
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await stateManager.updateConfiguration({
        wordBoundary: { enabled: false, offsetCompensation: 0 },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error in state change listener:",
        expect.any(Error),
      );
      expect(normalListener).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Utility Methods Tests
  // =============================================================================

  describe("Utility Methods", () => {
    test("should provide comprehensive state summary", async () => {
      await stateManager.initialize();
      await stateManager.createSynthesisSession("Test", {});

      const summary = stateManager.getStateSummary();

      expect(summary).toEqual({
        application: ApplicationState.Ready,
        configuration: expect.objectContaining({
          audioFormat: expect.objectContaining({
            format: "audio-24khz-48kbitrate-mono-mp3",
          }),
        }),
        activeSessions: 1,
        connections: 1,
        memoryUsage: { totalMemory: 1024, usedMemory: 512 },
      });
    });

    test("should cleanup state manager and all services", async () => {
      await stateManager.initialize();
      await stateManager.createSynthesisSession("Test", {});
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      await stateManager.cleanup();

      expect(stateManager.getApplicationState()).toBe(ApplicationState.Idle);
      expect(stateManager.getActiveSessions()).toHaveLength(0);
      expect(mockStorageService.cleanup).toHaveBeenCalled();
      expect(mockNetworkService.cleanup).toHaveBeenCalled();
      expect(mockAudioService.cleanup).toHaveBeenCalled();

      // Verify listeners were cleared (no notification for this update)
      jest.clearAllMocks();
      await stateManager.updateConfiguration({
        wordBoundary: { enabled: false, offsetCompensation: 0 },
      });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe("Integration Tests", () => {
    test("should maintain state consistency across service operations", async () => {
      await stateManager.initialize();
      const integrationSession = await stateManager.createSynthesisSession(
        "Integration test",
        {},
      );

      // Simulate full workflow state changes
      const networkHandler =
        mockNetworkService.onConnectionStateChange.mock.calls[0][0];
      const audioHandler =
        mockAudioService.onPlaybackStateChange.mock.calls[0][0];

      // Connection established
      networkHandler("connection-123", ConnectionState.Connected);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Start synthesis
      networkHandler("connection-123", ConnectionState.Synthesizing);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Audio starts playing
      audioHandler(AudioPlaybackState.Playing);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify consistent state
      expect(stateManager.getApplicationState()).toBe(ApplicationState.Playing);
      const session = stateManager.getSynthesisSession(integrationSession.id);
      expect(session!.state).toBe(ApplicationState.Synthesizing);

      // Audio completes
      audioHandler(AudioPlaybackState.Completed);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stateManager.getApplicationState()).toBe(ApplicationState.Idle);
    });

    test("should handle error states consistently across services", async () => {
      await stateManager.initialize();
      const errorSession = await stateManager.createSynthesisSession(
        "Error test",
        {},
      );

      const networkHandler =
        mockNetworkService.onConnectionStateChange.mock.calls[0][0];
      const audioHandler =
        mockAudioService.onPlaybackStateChange.mock.calls[0][0];

      // Simulate connection error
      networkHandler("connection-123", ConnectionState.Error);
      await new Promise((resolve) => setTimeout(resolve, 0));

      let session = stateManager.getSynthesisSession(errorSession.id);
      expect(session!.state).toBe(ApplicationState.Error);

      // Simulate audio error
      audioHandler(AudioPlaybackState.Error);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stateManager.getApplicationState()).toBe(ApplicationState.Error);
    });
  });
});
