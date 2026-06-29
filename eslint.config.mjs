import { config } from "@remotion/eslint-config-flat";

export default [
  ...[].concat(config),
  {
    files: ["scripts/**/*.{mjs,js}"],
    languageOptions: {
      globals: {
        fetch: "readonly",
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
