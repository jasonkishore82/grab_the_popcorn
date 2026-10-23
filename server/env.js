// Loads variables from .env (project root) into process.env.
// Values already set in the real environment win, so hosting secrets override the file.
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  /* no .env file: rely on the real environment */
}
