import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { amountInWords, stateName } from "@/lib/india";
import { money, date, number } from "@/lib/format";
import { calculateTotals } from "@/lib/tax/calculate";
import { DOC_TITLE, type Business, type DocumentItem, type DocumentRow, type Party } from "@/lib/types";
import { DIM_UNIT_LABEL } from "@/lib/tax/calculate";

const fontDir = path.join(process.cwd(), "lib", "pdf", "fonts");
Font.register({
  family: "Noto",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const BRAND = "#1d4ed8";
const BORDER = "#cbd5e1";
const MUTED = "#475569";
const RADIUS = 6;

const s = StyleSheet.create({
  page: { fontFamily: "Noto", fontSize: 8.5, padding: 28, color: "#0f172a", lineHeight: 1.35 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 10 },
  logo: { width: 64, height: 64, objectFit: "contain", marginRight: 10 },
  // Serif bold to match the "S.N. SAFETY" lettering in the logo (Times is a built-in PDF font)
  company: { fontFamily: "Times-Bold", fontSize: 18, color: BRAND, letterSpacing: 0.5, lineHeight: 1.2, marginBottom: 2 },
  muted: { color: MUTED },
  title: { fontSize: 15, fontWeight: 700, textAlign: "right", color: "#0f172a", letterSpacing: 1, lineHeight: 1.25, marginBottom: 3 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 1.5 },
  metaLabel: { color: MUTED, width: 78, textAlign: "right", marginRight: 6 },
  metaValue: { fontWeight: 700, minWidth: 80, textAlign: "right" },
  parties: { flexDirection: "row", marginTop: 10, borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS },
  party: { flex: 1, padding: 8 },
  partyLabel: { fontSize: 7.5, fontWeight: 700, color: BRAND, textTransform: "uppercase", marginBottom: 3 },
  partyName: { fontSize: 10, fontWeight: 700, lineHeight: 1.3 },
  table: { marginTop: 10, borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS },
  th: {
    flexDirection: "row", backgroundColor: "#eff6ff", borderBottomWidth: 1, borderBottomColor: BORDER, fontWeight: 700, fontSize: 7.5,
    borderTopLeftRadius: RADIUS - 1, borderTopRightRadius: RADIUS - 1,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  cell: { paddingVertical: 4, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  bold: { fontWeight: 700 },
  bottom: { flexDirection: "row", marginTop: 10 },
  box: { borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS, padding: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 4, paddingTop: 5 },
  stamp: { width: 62, height: 62, objectFit: "contain", opacity: 0.85, marginBottom: 4 },
  signature: { width: 110, height: 40, objectFit: "contain" },
  sectionLabel: { fontSize: 7.5, fontWeight: 700, color: BRAND, textTransform: "uppercase", marginBottom: 3 },
  watermark: {
    position: "absolute", top: 330, left: 0, right: 0, textAlign: "center",
    fontSize: 80, fontWeight: 700, color: "#ef4444", opacity: 0.12, transform: "rotate(-30deg)",
  },
});

// Column widths (percent) for the items table
const COLS = { sn: "5%", item: "35%", hsn: "10%", qty: "10%", rate: "11%", disc: "6%", gst: "7%", amt: "16%" };

export interface PdfAssets {
  logo?: string | null;
  signature?: string | null;
  stamp?: string | null;
  paymentQr?: string | null; // data URI (generated UPI QR or uploaded image)
}

function PartyBlock({ label, party }: { label: string; party: Party }) {
  const lines = [party.address, [party.city, party.pincode].filter(Boolean).join(" - ")].filter(Boolean);
  const state = party.state || stateName(party.state_code);
  return (
    <View style={s.party}>
      <Text style={s.partyLabel}>{label}</Text>
      <Text style={s.partyName}>{party.name}</Text>
      {party.company_name ? <Text>{party.company_name}</Text> : null}
      {lines.map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
      {state ? (
        <Text>
          State: {state}
          {party.state_code ? ` (${party.state_code})` : ""}
        </Text>
      ) : null}
      {party.gstin ? <Text style={s.bold}>GSTIN: {party.gstin}</Text> : null}
      {party.phone ? <Text>Ph: +{party.phone}</Text> : null}
      {party.email ? <Text>{party.email}</Text> : null}
    </View>
  );
}

function itemDetail(it: DocumentItem): string {
  const parts: string[] = [];
  if (it.description) parts.push(it.description);
  if (it.pricing_mode === "area" && it.length && it.breadth && it.dimension_unit) {
    parts.push(`Size: ${number(it.length)} × ${number(it.breadth)} ${DIM_UNIT_LABEL[it.dimension_unit].toLowerCase()}`);
  }
  return parts.join("\n");
}

export function DocumentPdf({
  business,
  doc,
  items,
  assets,
}: {
  business: Business;
  doc: DocumentRow;
  items: DocumentItem[];
  assets: PdfAssets;
}) {
  const totals = calculateTotals({
    items,
    taxMode: doc.tax_mode,
    sellerStateCode: business.state_code,
    placeOfSupplyStateCode: doc.place_of_supply_state_code,
    freightAmount: doc.freight_amount,
    freightTaxable: doc.freight_taxable,
    freightTaxRate: doc.freight_tax_rate,
    roundOff: doc.apply_round_off,
  });
  const inter = totals.interState;
  const isQuote = doc.doc_type === "quotation";
  const watermark = doc.status === "cancelled" ? "CANCELLED" : doc.status === "draft" ? "DRAFT" : null;
  const sellerAddr = [business.address, [business.city, business.pincode].filter(Boolean).join(" - "), business.state]
    .filter(Boolean)
    .join(", ");
  const showBank = !isQuote && business.bank_account_no;

  return (
    <Document title={`${DOC_TITLE[doc.doc_type]} ${doc.number ?? ""}`} author={business.name}>
      <Page size="A4" style={s.page}>
        {watermark && (
          <Text style={s.watermark} fixed>
            {watermark}
          </Text>
        )}

        {/* Header */}
        <View style={s.header}>
          <View style={[s.row, { flex: 1 }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {assets.logo ? <Image src={assets.logo} style={s.logo} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.company}>{business.name}</Text>
              <Text style={s.muted}>{sellerAddr}</Text>
              {business.gstin ? <Text style={s.bold}>GSTIN: {business.gstin}</Text> : null}
              <Text style={s.muted}>
                {[business.phone && `Ph: +${business.phone}`, business.email].filter(Boolean).join("  |  ")}
              </Text>
            </View>
          </View>
          <View style={{ width: 200 }}>
            <Text style={s.title}>{DOC_TITLE[doc.doc_type]}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>No.</Text>
              <Text style={s.metaValue}>{doc.number ?? "DRAFT"}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{date(doc.issue_date)}</Text>
            </View>
            {doc.place_of_supply_state_code ? (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Place of supply</Text>
                <Text style={s.metaValue}>
                  {stateName(doc.place_of_supply_state_code)} ({doc.place_of_supply_state_code})
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Parties */}
        <View style={s.parties}>
          <PartyBlock label={isQuote ? "Quotation for" : "Bill to"} party={doc.bill_to} />
          {doc.ship_to ? (
            <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: BORDER }}>
              <PartyBlock label="Ship to" party={doc.ship_to} />
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.cell, { width: COLS.sn }]}>#</Text>
            <Text style={[s.cell, { width: COLS.item }]}>Item & description</Text>
            <Text style={[s.cell, { width: COLS.hsn }]}>HSN/SAC</Text>
            <Text style={[s.cell, s.right, { width: COLS.qty }]}>Qty</Text>
            <Text style={[s.cell, s.right, { width: COLS.rate }]}>Rate</Text>
            <Text style={[s.cell, s.right, { width: COLS.disc }]}>Disc</Text>
            <Text style={[s.cell, s.right, { width: COLS.gst }]}>GST</Text>
            <Text style={[s.cell, s.right, { width: COLS.amt }]}>Taxable amt</Text>
          </View>
          {items.map((it, i) => {
            const detail = itemDetail(it);
            const line = totals.lines[i];
            const qtyText =
              it.pricing_mode === "area"
                ? `${number(it.qty)} ${it.unit}\n(${number(line.quantityBasis)} sq ft)`
                : `${number(it.qty)} ${it.unit}`;
            return (
              <View key={it.id ?? i} style={s.tr} wrap={false}>
                <Text style={[s.cell, { width: COLS.sn }]}>{i + 1}</Text>
                <View style={[s.cell, { width: COLS.item }]}>
                  <Text style={s.bold}>{it.name}</Text>
                  {detail ? <Text style={[s.muted, { fontSize: 7.5 }]}>{detail}</Text> : null}
                </View>
                <Text style={[s.cell, { width: COLS.hsn }]}>{it.hsn_sac}</Text>
                <Text style={[s.cell, s.right, { width: COLS.qty }]}>{qtyText}</Text>
                <Text style={[s.cell, s.right, { width: COLS.rate }]}>
                  {number(it.rate)}
                  {it.pricing_mode === "area" ? "/sqft" : ""}
                </Text>
                <Text style={[s.cell, s.right, { width: COLS.disc }]}>{it.discount_pct ? `${number(it.discount_pct)}%` : "-"}</Text>
                <Text style={[s.cell, s.right, { width: COLS.gst }]}>{number(it.tax_rate)}%</Text>
                <Text style={[s.cell, s.right, s.bold, { width: COLS.amt }]}>{money(line.taxable)}</Text>
              </View>
            );
          })}
          <View style={[s.row, { backgroundColor: "#f8fafc" }]}>
            <Text style={[s.cell, s.bold, { width: "60%" }]}>Total quantity: {number(totals.totalQty)}</Text>
            <Text style={[s.cell, s.right, s.bold, { width: "40%" }]}>{money(totals.subtotal)}</Text>
          </View>
        </View>

        {/* Bottom: words + tax breakup + bank | totals */}
        <View style={s.bottom} wrap={false}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={[s.box, { marginBottom: 6 }]}>
              <Text style={s.sectionLabel}>Amount in words</Text>
              <Text style={s.bold}>{amountInWords(totals.grandTotal)}</Text>
            </View>

            {showBank || assets.paymentQr ? (
              <View style={[s.box, s.row]}>
                {showBank ? (
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionLabel}>Bank details</Text>
                    <Text>A/C name: {business.bank_account_name}</Text>
                    <Text>
                      A/C no: <Text style={s.bold}>{business.bank_account_no}</Text>
                    </Text>
                    <Text>IFSC: {business.bank_ifsc}</Text>
                    <Text>
                      Bank: {[business.bank_name, business.bank_branch].filter(Boolean).join(", ")}
                    </Text>
                    {business.upi_id ? <Text>UPI: {business.upi_id}</Text> : null}
                  </View>
                ) : null}
                {assets.paymentQr ? (
                  <View style={{ alignItems: "center", marginLeft: 6 }}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={assets.paymentQr} style={{ width: 76, height: 86, objectFit: "contain" }} />
                    <Text style={[s.muted, { fontSize: 6.5 }]}>Scan to pay</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={{ width: 200 }}>
            <View style={s.box}>
              <View style={s.totalsRow}>
                <Text style={s.muted}>Sub total</Text>
                <Text>{money(totals.subtotal)}</Text>
              </View>
              {totals.freight > 0 && doc.freight_taxable ? (
                <View style={s.totalsRow}>
                  <Text style={s.muted}>Courier / freight</Text>
                  <Text>{money(totals.freight)}</Text>
                </View>
              ) : null}
              {inter ? (
                <View style={s.totalsRow}>
                  <Text style={s.muted}>IGST</Text>
                  <Text>{money(totals.igst)}</Text>
                </View>
              ) : (
                <>
                  <View style={s.totalsRow}>
                    <Text style={s.muted}>CGST</Text>
                    <Text>{money(totals.cgst)}</Text>
                  </View>
                  <View style={s.totalsRow}>
                    <Text style={s.muted}>SGST</Text>
                    <Text>{money(totals.sgst)}</Text>
                  </View>
                </>
              )}
              {totals.freight > 0 && !doc.freight_taxable ? (
                <View style={s.totalsRow}>
                  <Text style={s.muted}>Courier / freight</Text>
                  <Text>{money(totals.freight)}</Text>
                </View>
              ) : null}
              {totals.roundOff !== 0 ? (
                <View style={s.totalsRow}>
                  <Text style={s.muted}>Round off</Text>
                  <Text>{money(totals.roundOff)}</Text>
                </View>
              ) : null}
              <View style={s.grand}>
                <Text style={[s.bold, { fontSize: 10.5 }]}>Grand total</Text>
                <Text style={[s.bold, { fontSize: 10.5, color: BRAND }]}>{money(totals.grandTotal)}</Text>
              </View>
              {doc.amount_paid > 0 ? (
                <>
                  <View style={s.totalsRow}>
                    <Text style={s.muted}>Paid</Text>
                    <Text>{money(doc.amount_paid)}</Text>
                  </View>
                  <View style={s.totalsRow}>
                    <Text style={s.bold}>Balance due</Text>
                    <Text style={s.bold}>{money(doc.balance_due)}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={[s.box, { marginTop: 6, alignItems: "center" }]}>
              <Text style={[s.bold, { fontSize: 7.5 }]}>For {business.name}</Text>
              <View style={{ width: "100%", minHeight: 66, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                {assets.stamp ? <Image src={assets.stamp} style={s.stamp} /> : null}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                {assets.signature ? <Image src={assets.signature} style={s.signature} /> : null}
              </View>
              <Text style={[s.muted, { fontSize: 7.5 }]}>Authorized Signatory</Text>
            </View>
          </View>
        </View>

        {doc.notes || doc.terms ? (
          <View style={[s.row, { marginTop: 10 }]} wrap={false}>
            {doc.terms ? (
              <View style={{ flex: 1, marginRight: doc.notes ? 10 : 0 }}>
                <Text style={s.sectionLabel}>Terms & conditions</Text>
                <Text style={s.muted}>{doc.terms}</Text>
              </View>
            ) : null}
            {doc.notes ? (
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Notes</Text>
                <Text style={s.muted}>{doc.notes}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {doc.status === "cancelled" && doc.cancel_reason ? (
          <Text style={{ marginTop: 8, color: "#b91c1c" }}>Cancelled: {doc.cancel_reason}</Text>
        ) : null}

        <Text
          style={{ position: "absolute", bottom: 14, left: 28, right: 28, textAlign: "center", fontSize: 7, color: "#94a3b8" }}
          render={({ pageNumber, totalPages }) => `This is a computer-generated document. Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
