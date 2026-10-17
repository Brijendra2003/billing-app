import type { Metadata } from "next";
import { connection } from "next/server";
import { AreaCalculator } from "./calculator";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Area calculator" };

export default async function AreaCalculatorPage() {
  await connection();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Material area calculator" subtitle="Convert sizes between units and price by area. Send the result straight to a new invoice." />
      <AreaCalculator />
    </div>
  );
}
