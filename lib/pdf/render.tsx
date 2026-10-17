import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentPdf, type PdfAssets } from "@/lib/pdf/document-pdf";
import { upiUrl } from "@/lib/messaging/templates";
import type { Business, DocumentItem, DocumentRow } from "@/lib/types";

async function downloadAsDataUri(supabase: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("branding").download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const type = data.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
  // react-pdf supports PNG and JPEG only
  if (!/image\/(png|jpe?g)/.test(type)) return null;
  return `data:${type};base64,${buf.toString("base64")}`;
}

export async function loadPdfAssets(supabase: SupabaseClient, business: Business, doc: DocumentRow): Promise<PdfAssets> {
  const [logo, signature, uploadedQr] = await Promise.all([
    downloadAsDataUri(supabase, business.logo_path),
    downloadAsDataUri(supabase, business.signature_path),
    downloadAsDataUri(supabase, business.payment_qr_path),
  ]);

  let paymentQr: string | null = null;
  const payable = doc.doc_type !== "quotation" && doc.doc_type !== "credit_note" && doc.status !== "cancelled";
  if (payable && business.upi_id) {
    const amount = doc.balance_due > 0 ? doc.balance_due : doc.grand_total;
    paymentQr = await QRCode.toDataURL(upiUrl(business.upi_id, business.name, amount, doc.number ?? undefined), {
      margin: 0,
      width: 300,
    });
  } else if (payable) {
    paymentQr = uploadedQr;
  }
  return { logo, signature, paymentQr };
}

export async function renderDocumentPdf(
  supabase: SupabaseClient,
  business: Business,
  doc: DocumentRow,
  items: DocumentItem[],
): Promise<Buffer> {
  const assets = await loadPdfAssets(supabase, business, doc);
  return renderToBuffer(<DocumentPdf business={business} doc={doc} items={items} assets={assets} />);
}
