module.exports = {
  extends: ["expo", "prettier"],
  ignorePatterns: ["/dist/*", "/example-app/*"],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "error",
  },
};
