import { notFound, redirect } from "next/navigation";
import { getContext } from "@/lib/auth";
import { getDocumentWithItems } from "@/lib/data/documents";
import { editorStateFromDocument, loadEditorOptions } from "@/lib/data/editor";
import { DocumentEditor } from "@/components/document-editor/editor";
import { PageHeader } from "@/components/ui";
import { DOC_LABEL } from "@/lib/types";

export default async function EditDocumentPage({ params }: PageProps<"/documents/[id]/edit">) {
  const ctx = await getContext();
  const { id } = await params;
  const loaded = await getDocumentWithItems(ctx.supabase, id);
  if (!loaded) notFound();
  const { doc, items } = loaded;
  const editable =
    doc.status === "draft" ||
    ((doc.doc_type === "quotation" || doc.doc_type === "proforma") && ["issued", "sent", "accepted", "rejected"].includes(doc.status));
  if (!editable) redirect(`/documents/${id}`);

  const options = await loadEditorOptions(ctx);
  return (
    <>
      <PageHeader
        back={{ href: `/documents/${id}`, label: "Back" }}
        title={`Edit ${DOC_LABEL[doc.doc_type]} ${doc.number ?? "(draft)"}`}
      />
      <DocumentEditor initial={editorStateFromDocument(doc, items)} {...options} />
    </>
  );
}
