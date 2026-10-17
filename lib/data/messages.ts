import "server-only";
import { env } from "@/lib/env";
import { documentVars, fillTemplate } from "@/lib/messaging/templates";
import type { Business, DocumentRow } from "@/lib/types";

export function shareUrl(token: string) {
  return `${env.appUrl()}/share/${token}`;
}

/** Pre-filled email & WhatsApp texts for a document. */
export function messageDefaults(business: Business, doc: DocumentRow) {
  const link = shareUrl(doc.share_token);
  const vars = documentVars(doc, business.name, link);
  return {
    link,
    emailSubject: fillTemplate(business.email_subject_template, vars),
    emailBody: fillTemplate(business.email_body_template, vars),
    whatsapp: fillTemplate(business.whatsapp_template, vars),
    reminder: fillTemplate(business.reminder_template, vars),
  };
}
