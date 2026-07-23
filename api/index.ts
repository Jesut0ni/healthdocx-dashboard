// Vercel loads this API entry as CommonJS, so keep this file CJS-compatible.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createBackendApp } = require("../backend/src/app") as typeof import("../backend/src/app");

module.exports = createBackendApp();
