import {
  StorageService,
  getStorageService,
} from "../src/services/storageService";

describe("StorageService", () => {
  let storageService: StorageService;

  beforeEach(() => {
    // Create fresh instance for each test
    storageService = new StorageService({
      maxBufferSize: 1024 * 1024, // 1MB for testing
      cleanupInterval: 100, // 100ms for faster tests
    });
  });

  afterEach(() => {
    // Clean up after each test
    storageService.destroy();
  });

  describe("Connection Buffer Creation and Cleanup", () => {
    it("should create connection buffers properly", () => {
      const connectionId = "test-connection-1";

      storageService.createConnectionBuffer(connectionId);

      const bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.exists).toBe(true);
      expect(bufferInfo.size).toBe(0);
      expect(bufferInfo.chunkCount).toBe(0);
      expect(bufferInfo.state).toBe("active");
      expect(bufferInfo.lastActivity).toBeInstanceOf(Date);
    });

    it("should prevent duplicate buffer creation", () => {
      const connectionId = "test-connection-1";

      storageService.createConnectionBuffer(connectionId);

      expect(() => {
        storageService.createConnectionBuffer(connectionId);
      }).toThrow("Buffer already exists for connection: test-connection-1");
    });

    it("should clean up connection buffers properly", () => {
      const connectionId = "test-connection-1";
      const audioData = new Uint8Array([1, 2, 3, 4]);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, audioData);

      // Verify buffer exists with data
      let bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.exists).toBe(true);
      expect(bufferInfo.size).toBe(4);

      // Cleanup and verify removal
      const cleaned = storageService.cleanupConnection(connectionId);
      expect(cleaned).toBe(true);

      bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.exists).toBe(false);
    });

    it("should handle cleanup of non-existent connection gracefully", () => {
      const result = storageService.cleanupConnection("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("Memory Limits Enforcement", () => {
    it("should enforce memory limits correctly (1MB max)", () => {
      const connectionId = "test-connection-1";
      const largeData = new Uint8Array(1024 * 1024 + 1); // 1MB + 1 byte

      storageService.createConnectionBuffer(connectionId);

      expect(() => {
        storageService.addAudioChunk(connectionId, largeData);
      }).toThrow(/Buffer size limit exceeded/);
    });

    it("should allow data up to the memory limit", () => {
      const connectionId = "test-connection-1";
      const maxData = new Uint8Array(1024 * 1024); // Exactly 1MB

      storageService.createConnectionBuffer(connectionId);

      expect(() => {
        storageService.addAudioChunk(connectionId, maxData);
      }).not.toThrow();

      const bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.size).toBe(1024 * 1024);
    });

    it("should track memory usage incrementally", () => {
      const connectionId = "test-connection-1";
      const chunk1 = new Uint8Array(500000); // 500KB
      const chunk2 = new Uint8Array(400000); // 400KB

      storageService.createConnectionBuffer(connectionId);

      storageService.addAudioChunk(connectionId, chunk1);
      let bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.size).toBe(500000);

      storageService.addAudioChunk(connectionId, chunk2);
      bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.size).toBe(900000);
    });

    it("should prevent adding data when limit would be exceeded", () => {
      const connectionId = "test-connection-1";
      const chunk1 = new Uint8Array(800000); // 800KB
      const chunk2 = new Uint8Array(300000); // 300KB (would exceed 1MB limit)

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, chunk1);

      expect(() => {
        storageService.addAudioChunk(connectionId, chunk2);
      }).toThrow(/Buffer size limit exceeded/);
    });
  });

  describe("Audio Data Merging", () => {
    it("should merge byte arrays correctly", () => {
      const connectionId = "test-connection-1";
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);
      const chunk3 = new Uint8Array([7, 8, 9]);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, chunk1);
      storageService.addAudioChunk(connectionId, chunk2);
      storageService.addAudioChunk(connectionId, chunk3);

      const merged = storageService.getMergedAudioData(connectionId);
      expect(merged).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it("should handle empty buffer merging", () => {
      const connectionId = "test-connection-1";

      storageService.createConnectionBuffer(connectionId);

      const merged = storageService.getMergedAudioData(connectionId);
      expect(merged).toEqual(new Uint8Array(0));
    });

    it("should handle single chunk merging", () => {
      const connectionId = "test-connection-1";
      const chunk = new Uint8Array([1, 2, 3, 4, 5]);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, chunk);

      const merged = storageService.getMergedAudioData(connectionId);
      expect(merged).toEqual(chunk);
    });

    it("should throw error when merging non-existent connection", () => {
      expect(() => {
        storageService.getMergedAudioData("non-existent");
      }).toThrow("No buffer found for connection: non-existent");
    });
  });

  describe("Connection Lifecycle Management", () => {
    it("should mark connections as completed", () => {
      const connectionId = "test-connection-1";

      storageService.createConnectionBuffer(connectionId);
      let bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.state).toBe("active");

      storageService.markConnectionCompleted(connectionId);
      bufferInfo = storageService.getConnectionBufferInfo(connectionId);
      expect(bufferInfo.state).toBe("completed");
    });

    it("should prevent adding data to completed connections", () => {
      const connectionId = "test-connection-1";
      const audioData = new Uint8Array([1, 2, 3]);

      storageService.createConnectionBuffer(connectionId);
      storageService.markConnectionCompleted(connectionId);

      const result = storageService.addAudioChunk(connectionId, audioData);
      expect(result).toBe(false);
    });

    it("should handle lifecycle state transitions correctly", () => {
      const connectionId = "test-connection-1";

      storageService.createConnectionBuffer(connectionId);

      // Active -> Completed
      expect(storageService.getConnectionBufferInfo(connectionId).state).toBe(
        "active",
      );
      storageService.markConnectionCompleted(connectionId);
      expect(storageService.getConnectionBufferInfo(connectionId).state).toBe(
        "completed",
      );

      // Completed -> Cleaning -> Removed
      storageService.cleanupConnection(connectionId);
      expect(storageService.getConnectionBufferInfo(connectionId).exists).toBe(
        false,
      );
    });
  });

  describe("Memory Usage Tracking and Cleanup", () => {
    it("should track memory usage correctly", () => {
      const connection1 = "test-connection-1";
      const connection2 = "test-connection-2";
      const data1 = new Uint8Array(1000);
      const data2 = new Uint8Array(2000);

      storageService.createConnectionBuffer(connection1);
      storageService.createConnectionBuffer(connection2);
      storageService.addAudioChunk(connection1, data1);
      storageService.addAudioChunk(connection2, data2);

      const stats = storageService.getMemoryStats();
      expect(stats.totalMemoryUsed).toBe(3000);
      expect(stats.activeConnections).toBe(2);
      expect(stats.largestBuffer).toBe(2000);
      expect(stats.memoryLimitPerConnection).toBe(1024 * 1024);
    });

    it("should work without memory leaks during cleanup", () => {
      const connections = ["conn1", "conn2", "conn3"];
      const data = new Uint8Array(1000);

      // Create connections and add data
      connections.forEach((id) => {
        storageService.createConnectionBuffer(id);
        storageService.addAudioChunk(id, data);
      });

      let stats = storageService.getMemoryStats();
      expect(stats.totalMemoryUsed).toBe(3000);
      expect(stats.activeConnections).toBe(3);

      // Clean up all connections
      connections.forEach((id) => {
        storageService.cleanupConnection(id);
      });

      stats = storageService.getMemoryStats();
      expect(stats.totalMemoryUsed).toBe(0);
      expect(stats.activeConnections).toBe(0);
    });

    it("should perform automatic cleanup of completed connections", (done) => {
      const connectionId = "test-connection-1";
      const data = new Uint8Array(100);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, data);
      storageService.markConnectionCompleted(connectionId);

      // Wait for automatic cleanup (interval is 100ms in test config)
      setTimeout(() => {
        const bufferInfo = storageService.getConnectionBufferInfo(connectionId);
        expect(bufferInfo.exists).toBe(false);
        done();
      }, 150);
    });
  });

  describe("Streaming Coordination", () => {
    it("should estimate buffer sizes correctly", () => {
      const connectionId = "test-connection-1";
      const existingData = new Uint8Array(500);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, existingData);

      const estimate = storageService.estimateBufferSize(connectionId, 300);
      expect(estimate.currentSize).toBe(500);
      expect(estimate.estimatedSize).toBe(800);
      expect(estimate.remainingCapacity).toBe(1024 * 1024 - 800);
      expect(estimate.utilizationPercent).toBeCloseTo(0.076, 2); // ~0.076%
    });

    it("should check if connection can accept more data", () => {
      const connectionId = "test-connection-1";
      const largeData = new Uint8Array(900000); // 900KB

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, largeData);

      // Should accept small additional data
      expect(storageService.canAcceptMoreData(connectionId, 100000)).toBe(true); // 100KB more

      // Should reject large additional data that would exceed limit
      expect(storageService.canAcceptMoreData(connectionId, 200000)).toBe(
        false,
      ); // 200KB more
    });

    it("should validate audio data format correctly", () => {
      // Valid data
      const validData = new Uint8Array(1000); // 1000 bytes
      expect(storageService.validateAudioData(validData)).toBe(true);

      // Invalid data - empty
      expect(storageService.validateAudioData(new Uint8Array(0))).toBe(false);

      // Invalid data - null/undefined
      expect(storageService.validateAudioData(null as any)).toBe(false);
      expect(storageService.validateAudioData(undefined as any)).toBe(false);

      // Invalid data - too small (less than MIN_CHUNK_SIZE = 256)
      const tooSmall = new Uint8Array(100);
      expect(storageService.validateAudioData(tooSmall)).toBe(false);

      // Invalid data - too large (more than MAX_CHUNK_SIZE = 32768)
      const tooLarge = new Uint8Array(40000);
      expect(storageService.validateAudioData(tooLarge)).toBe(false);
    });
  });

  describe("Service Lifecycle", () => {
    it("should provide singleton instance access", () => {
      const instance1 = getStorageService();
      const instance2 = getStorageService();

      expect(instance1).toBe(instance2);

      // Clean up singleton
      instance1.destroy();
    });

    it("should handle service destruction properly", () => {
      const connectionId = "test-connection-1";
      const data = new Uint8Array(100);

      storageService.createConnectionBuffer(connectionId);
      storageService.addAudioChunk(connectionId, data);

      // Verify data exists
      expect(storageService.getConnectionBufferInfo(connectionId).exists).toBe(
        true,
      );

      // Destroy service
      storageService.destroy();

      // Verify cleanup
      expect(storageService.getConnectionBufferInfo(connectionId).exists).toBe(
        false,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle adding chunks to non-existent connections", () => {
      const audioData = new Uint8Array([1, 2, 3]);

      expect(() => {
        storageService.addAudioChunk("non-existent", audioData);
      }).toThrow("No buffer found for connection: non-existent");
    });

    it("should handle marking non-existent connections as completed", () => {
      // Should not throw error, just handle gracefully
      expect(() => {
        storageService.markConnectionCompleted("non-existent");
      }).not.toThrow();
    });

    it("should provide accurate buffer info for non-existent connections", () => {
      const bufferInfo = storageService.getConnectionBufferInfo("non-existent");

      expect(bufferInfo.exists).toBe(false);
      expect(bufferInfo.size).toBe(0);
      expect(bufferInfo.chunkCount).toBe(0);
      expect(bufferInfo.state).toBe("none");
      expect(bufferInfo.lastActivity).toBe(null);
    });
  });
});
