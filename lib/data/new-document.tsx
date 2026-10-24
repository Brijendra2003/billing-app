import "server-only";
import { getContext } from "@/lib/auth";
import { blankEditorState, loadEditorOptions } from "@/lib/data/editor";
import { DocumentEditor } from "@/components/document-editor/editor";
import { PageHeader } from "@/components/ui";
import { DOC_LABEL, type DocType } from "@/lib/types";

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

  return (
    <>
      <PageHeader back={{ href: backHref, label: "Back" }} title={`New ${DOC_LABEL[docType].toLowerCase()}`} />
      <DocumentEditor initial={blankEditorState(ctx, docType, { client })} {...options} />
    </>
  );
}
