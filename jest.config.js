/**
 * Jest configuration file
 */
module.exports = {
  // Use the jest-expo preset
  preset: "jest-expo",

  // Node environment for testing
  testEnvironment: "node",

  // Setup file
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],

  // Transform all files except those matching the pattern
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|react-navigation|@react-navigation/.*|@reanimated|reanimated|@babel/runtime)",
  ],

  // File extensions to consider
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Coverage settings
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!**/node_modules/**",
  ],

  // Test match pattern
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],

  // Test timeout
  testTimeout: 10000,

  // Mock files
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
  },
};
