import "server-only";
import { getContext } from "@/lib/auth";
import { blankEditorState, loadEditorOptions } from "@/lib/data/editor";
import { DocumentEditor } from "@/components/document-editor/editor";
import { PageHeader } from "@/components/ui";
import { DOC_LABEL, type DimUnit, type DocType } from "@/lib/types";

const DIM_UNITS = ["in", "ft", "m", "yd", "cm", "mm"];

/** Shared body of /quotations/new and /invoices/new. */
export async function NewDocument({
  docType,
  search,
  backHref,
}: {
  docType: DocType;
  search: Record<string, string | string[] | undefined>;
  backHref: string;
}) {
  const ctx = await getContext();
  const options = await loadEditorOptions(ctx);
  const clientId = typeof search.client === "string" ? search.client : null;
  const client = clientId ? (options.clients.find((c) => c.id === clientId) ?? null) : null;

  // ?area=L,B,unit,rate from the area calculator
  let areaItem: { length: number; breadth: number; unit: DimUnit; rate: number; qty: number } | null = null;
  if (typeof search.area === "string") {
    const [l, b, unit, rate, qty] = search.area.split(",");
    if (Number(l) > 0 && Number(b) > 0 && DIM_UNITS.includes(unit)) {
      areaItem = { length: Number(l), breadth: Number(b), unit: unit as DimUnit, rate: Number(rate) || 0, qty: Number(qty) || 1 };
    }
  }

  return (
    <>
      <PageHeader back={{ href: backHref, label: "Back" }} title={`New ${DOC_LABEL[docType].toLowerCase()}`} />
      <DocumentEditor initial={blankEditorState(ctx, docType, { client, areaItem })} {...options} />
    </>
  );
}
