/**
 * Tests for the Speech API configure method
 * Verifies configuration validation and basic functionality
 */

import { configure } from "../src/index";
import * as Speech from "../src/index";
import type { SpeechAPIConfig } from "../src/types";

describe("Speech API Configuration", () => {
  describe("configure method", () => {
    test("should accept valid configuration", () => {
      const config: SpeechAPIConfig = {
        network: {
          maxRetries: 3,
          connectionTimeout: 8000,
          enableDebugLogging: true,
        },
        connection: {
          maxConnections: 5,
          poolingEnabled: true,
          circuitBreaker: {
            failureThreshold: 3,
            recoveryTimeout: 15000,
            testRequestLimit: 2,
          },
        },
        audio: {
          loadingTimeout: 6000,
          autoInitializeAudioSession: true,
        },
      };

      expect(() => configure(config)).not.toThrow();
    });

    test("should accept partial configuration", () => {
      const config: SpeechAPIConfig = {
        network: {
          maxRetries: 5,
        },
        audio: {
          loadingTimeout: 10000,
        },
      };

      expect(() => configure(config)).not.toThrow();
    });

    test("should accept empty configuration", () => {
      const config: SpeechAPIConfig = {};

      expect(() => configure(config)).not.toThrow();
    });

    test("should throw error for invalid configuration", () => {
      expect(() => configure(null as any)).toThrow(
        "Configuration must be a valid SpeechAPIConfig object",
      );

      expect(() => configure(undefined as any)).toThrow(
        "Configuration must be a valid SpeechAPIConfig object",
      );

      expect(() => configure("invalid" as any)).toThrow(
        "Configuration must be a valid SpeechAPIConfig object",
      );
    });
  });

  describe("configuration types", () => {
    test("should support all configuration interfaces", () => {
      const fullConfig: SpeechAPIConfig = {
        network: {
          maxRetries: 3,
          baseRetryDelay: 1000,
          maxRetryDelay: 10000,
          connectionTimeout: 10000,
          gracefulCloseTimeout: 5000,
          enableDebugLogging: true,
        },
        audio: {
          platformConfig: {
            ios: {
              staysActiveInBackground: false,
              playsInSilentModeIOS: true,
              interruptionModeIOS: 1,
            },
            android: {
              staysActiveInBackground: false,
              shouldDuckAndroid: true,
              playThroughEarpieceAndroid: false,
              interruptionModeAndroid: 1,
            },
          },
          loadingTimeout: 8000,
          autoInitializeAudioSession: true,
        },
        storage: {
          maxBufferSize: 32 * 1024 * 1024,
          cleanupInterval: 60000,
          warningThreshold: 0.8,
        },
        connection: {
          maxConnections: 10,
          connectionTimeout: 15000,
          poolingEnabled: true,
          circuitBreaker: {
            failureThreshold: 5,
            recoveryTimeout: 30000,
            testRequestLimit: 3,
          },
        },
        voice: {
          cacheTTL: 24 * 60 * 60 * 1000,
          enableDebugLogging: false,
          networkTimeout: 10000,
        },
      };

      // Should compile and run without type errors
      expect(() => configure(fullConfig)).not.toThrow();
    });

    test("should support circuit breaker configuration", () => {
      const config: SpeechAPIConfig = {
        connection: {
          circuitBreaker: {
            failureThreshold: 5,
            recoveryTimeout: 30000,
            testRequestLimit: 3,
          },
        },
      };

      expect(() => configure(config)).not.toThrow();
    });

    test("should block configuration after Speech API initialization", async () => {
      const config: SpeechAPIConfig = {
        network: {
          maxRetries: 2,
        },
      };

      // First configure should work fine
      expect(() => configure(config)).not.toThrow();

      try {
        // Try to initialize Speech API by calling getAvailableVoicesAsync
        // This should trigger initialization and lock configuration
        await Speech.getAvailableVoicesAsync();
      } catch {
        // It's expected this might fail due to network/environment issues
        // The important part is that it attempts initialization
      } finally {
        // Always cleanup to prevent open handles
        try {
          await Speech.cleanup();
        } catch {
          // Ignore cleanup errors in tests
        }
      }

      // Now configuration should be blocked
      expect(() => configure(config)).toThrow(
        "Speech API configuration cannot be changed after initialization. Call Speech.configure() before using any other Speech API methods.",
      );
    });
  });
});
