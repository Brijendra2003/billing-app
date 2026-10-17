import { describe, expect, it } from "vitest";
import { amountInWords, financialYear, normalizePhone, stateCodeFromGstin } from "@/lib/india";
import { fillTemplate, whatsappUrl } from "@/lib/messaging/templates";

describe("india helpers", () => {
  it("writes amounts in the Indian system", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(1180)).toBe("Rupees One Thousand One Hundred Eighty Only");
    expect(amountInWords(12345678.5)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Fifty Paise Only",
    );
    expect(amountInWords(100000)).toBe("Rupees One Lakh Only");
  });

  it("computes the April–March financial year", () => {
    expect(financialYear("2026-10-17")).toBe("2026-27");
    expect(financialYear("2027-03-31")).toBe("2026-27");
    expect(financialYear("2027-04-01")).toBe("2027-28");
    expect(financialYear("2099-05-01")).toBe("2099-00");
  });

  it("normalises phone numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("098765-43210")).toBe("919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("14155550100");
    expect(normalizePhone("")).toBe("");
  });

  it("reads the state from a GSTIN", () => {
    expect(stateCodeFromGstin("27AOBPY0011L1ZZ")).toBe("27");
    expect(stateCodeFromGstin("not-a-gstin")).toBe("");
  });

  it("builds WhatsApp links with the message encoded", () => {
    const msg = fillTemplate("Hi {client_name}, total {amount} & more {unknown}", {
      client_name: "Ravi",
      amount: "₹1,180.00",
    } as never);
    expect(msg).toBe("Hi Ravi, total ₹1,180.00 & more {unknown}");
    expect(whatsappUrl("91 98765 43210", msg)).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent(msg)}`,
    );
  });
});
