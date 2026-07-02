// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig((config) => ({
  ...enableTailwind(config),
  // Webpack's cache-snapshot hashing intermittently crashes under Node 22 in
  // wasm-hash ("Cannot read properties of undefined (reading 'length')"). The
  // crash is in FileSystemInfo snapshot creation, so disable webpack caching
  // entirely — a full re-bundle each run, but no corruption/crash.
  cache: false,
}));
