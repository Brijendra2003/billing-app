import { fileName } from "@/lib/data/documents";
import { getSharedDocument } from "@/lib/data/share";
import { renderDocumentPdf } from "@/lib/pdf/render";

export async function GET(request: Request, { params }: RouteContext<"/api/share/[token]/pdf">) {
  const { token } = await params;
  const shared = await getSharedDocument(token);
  if (!shared) return new Response("This link is invalid or has been revoked.", { status: 404 });

  const pdf = await renderDocumentPdf(shared.admin, shared.business, shared.doc, shared.items);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName(shared.doc)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
