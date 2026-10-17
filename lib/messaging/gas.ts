import "server-only";
import { env } from "@/lib/env";

type GasResult = { ok: true; [k: string]: unknown } | { ok: false; error: string };

export function gasConfigured(): boolean {
  return Boolean(env.gasUrl() && env.gasSecret());
}

/** Calls the Google Apps Script web app (see gas/Code.gs). Never throws. */
export async function callGas(payload: Record<string, unknown>): Promise<GasResult> {
  if (!gasConfigured()) {
    return { ok: false, error: "Email is not set up. Add GAS_WEBAPP_URL and GAS_SHARED_SECRET (see README)." };
  }
  try {
    const res = await fetch(env.gasUrl(), {
      method: "POST",
      // text/plain avoids a CORS preflight and is what Apps Script expects in e.postData.contents
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, secret: env.gasSecret() }),
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as GasResult;
    } catch {
      return { ok: false, error: `Unexpected response from Apps Script (HTTP ${res.status}). Check the deployment URL and access setting.` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not reach Apps Script: ${msg}` };
  }
}

export interface EmailPayload {
  to: string;
  cc?: string;
  subject: string;
  body: string; // plain text; converted to simple HTML by the script
  fromName: string;
  replyTo?: string;
  attachment: { fileName: string; base64: string };
  backup?: { folderPath: string[] };
}

export function sendEmailViaGas(p: EmailPayload) {
  return callGas({ action: "sendEmail", ...p });
}

export function backupToDrive(p: { fileName: string; base64: string; folderPath: string[] }) {
  return callGas({ action: "backup", ...p });
}
