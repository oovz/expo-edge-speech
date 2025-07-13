/**
 * Jest setup file for expo-edge-speech tests
 */

// suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock expo-av for testing
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: jest.fn().mockImplementation(() => ({
      loadAsync: jest.fn(),
      playAsync: jest.fn(),
      pauseAsync: jest.fn(),
      stopAsync: jest.fn(),
      unloadAsync: jest.fn(),
      setVolumeAsync: jest.fn(),
      getStatusAsync: jest.fn(),
      setOnPlaybackStatusUpdate: jest.fn(),
    })),
  },
  InterruptionModeAndroid: {
    DoNotMix: 1,
    DuckOthers: 2,
  },
  InterruptionModeIOS: {
    DoNotMix: 1,
    DuckOthers: 2,
    MixWithOthers: 0,
  },
}));

// Mock expo-crypto for testing
jest.mock("expo-crypto", () => {
  let uuidCounter = 0;

  return {
    digestStringAsync: jest.fn().mockImplementation(async (algorithm, data) => {
      // Mock SHA-256 hash - return consistent hex string for testing
      return "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
    }),
    randomUUID: jest.fn().mockImplementation(() => {
      // Generate unique UUIDs for testing by incrementing a counter
      uuidCounter++;
      const base = "12345678-1234-4567-8901-123456789012";
      const suffix = uuidCounter.toString().padStart(3, "0");
      return base.slice(0, -3) + suffix;
    }),
    CryptoDigestAlgorithm: {
      SHA256: "SHA-256",
    },
  };
});

jest.mock("react-native", () => ({
  Platform: {
    OS: undefined,
  },
}));

// Mock global btoa/atob for base64 conversion testing
global.btoa = jest.fn((str) => Buffer.from(str, "binary").toString("base64"));
global.atob = jest.fn((str) => Buffer.from(str, "base64").toString("binary"));

// Mock URL.createObjectURL and revokeObjectURL for web platform testing
global.URL = {
  ...global.URL,
  createObjectURL: jest.fn(() => "blob:mock-url"),
  revokeObjectURL: jest.fn(),
} as any;

// Mock Blob for web platform testing
global.Blob = jest.fn().mockImplementation((data, options) => ({
  data,
  type: options?.type || "application/octet-stream",
}));
