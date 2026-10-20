import "server-only";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

/** 伺服器端專用（Route Handler、Server Component、Server Action）。前端 import 會在 build 時報錯。 */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env);
  return cached;
}
