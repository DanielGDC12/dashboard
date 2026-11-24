import "server-only";
import { headers } from "next/headers";

export async function getRequestInfo() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  };
}
