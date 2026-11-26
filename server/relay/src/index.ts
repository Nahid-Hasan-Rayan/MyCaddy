// NHR: relay entry point, settings come from environment variables
import { randomBytes } from "node:crypto";
import { startRelay } from "./server";

const secret = process.env.RELAY_SECRET ?? randomBytes(24).toString("hex");
if (!process.env.RELAY_SECRET) console.warn("RELAY_SECRET is not set: a restart will invalidate organiser tokens");

startRelay({
  port: Number(process.env.PORT ?? 8080),
  secret,
  publicUrl: process.env.PUBLIC_URL,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
}).then((s) => {
  console.log(`relay listening on ${s.port}`);
  const stop = () => s.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
});
