import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyzeBusiness } from "@/lib/analytics";
import { createDemoData } from "@/lib/demo";
import { generateInsights } from "@/lib/insights";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { BusinessPulse } from "@/components/dashboard/business-pulse";
import { ProductPreview } from "@/components/dashboard/product-preview";
import { dashboardDecisions } from "@/lib/dashboard/decisions";
const m = analyzeBusiness(createDemoData())!;
describe("capability-aware executive presentation", () => {
  it("prioritizes four available KPIs without manufacturing unavailable zeros", () => {
    const full = renderToStaticMarkup(
      createElement(DashboardSummary, { metrics: m }),
    );
    expect(full.match(/class="panel kpi-card"/g)).toHaveLength(4);
    expect(full).toContain(m.units.toLocaleString("id-ID"));
    expect(full).not.toContain("kpi-value-missing");
    const partial = {
      ...m,
      grossProfit: null,
      capabilities: { ...m.capabilities, units: false, orders: false },
    };
    const html = renderToStaticMarkup(
      createElement(DashboardSummary, { metrics: partial }),
    );
    expect(html.match(/class="panel kpi-card"/g)).toHaveLength(2);
    expect(html).not.toContain("Belum tersedia");
    expect(html).not.toContain("kpi-value-missing");
    expect(html).not.toContain("Rp0");
  });
  it("does not allocate an empty channel panel or invent pulse signals", () => {
    const partial = {
      ...m,
      channels: [{ name: "Tanpa kanal", revenue: m.revenue }],
      products: [],
      capabilities: { ...m.capabilities, products: false },
    };
    expect(
      renderToStaticMarkup(
        createElement(ChannelPerformance, { metrics: partial }),
      ),
    ).toBe("");
    const pulse = renderToStaticMarkup(
      createElement(BusinessPulse, {
        decision: dashboardDecisions(partial, [], [])[0],
      }),
    );
    expect(pulse).not.toContain("Channel teratas");
    expect(pulse).not.toContain("Produk utama");
    expect(pulse).toContain("Angka pendukung");
  });
  it("uses existing product rows with unavailable columns omitted", () => {
    const partial = {
      ...m,
      capabilities: { ...m.capabilities, units: false },
      products: m.products.map((p) => ({
        ...p,
        margin: null,
        grossProfit: null,
      })),
    };
    const html = renderToStaticMarkup(
      createElement(ProductPreview, { metrics: partial }),
    );
    expect(html).not.toContain('class="product-extra"');
    expect(html).toContain(m.products[0].name);
    expect(html).toContain("Lihat analisis lengkap");
    const pulse = renderToStaticMarkup(
      createElement(BusinessPulse, {
        decision: dashboardDecisions(m, generateInsights(m), [])[0],
      }),
    );
    expect(pulse).toContain("Langkah berikutnya");
  });
});
