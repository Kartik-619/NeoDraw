import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load the monorepo-root .env regardless of the process working directory.
// From this module: packages/backand-common/<dist|src> -> ../../../ is the repo root.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, "../../../.env");

dotenv.config({ path: rootEnvPath });
