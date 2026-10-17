import { getContext } from "@/lib/auth";
import { fileName, getDocumentWithItems } from "@/lib/data/documents";
import { renderDocumentPdf } from "@/lib/pdf/render";

export async function GET(request: Request, { params }: RouteContext<"/api/documents/[id]/pdf">) {
  const { id } = await params;
  const ctx = await getContext();
  const loaded = await getDocumentWithItems(ctx.supabase, id);
  if (!loaded) return new Response("Not found", { status: 404 });

  const pdf = await renderDocumentPdf(ctx.supabase, ctx.business, loaded.doc, loaded.items);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName(loaded.doc)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
