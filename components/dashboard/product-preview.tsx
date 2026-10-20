"use client";
import { entityLabel } from "@/lib/copy/entity-label";
import { useState } from "react";
import { ProductTable } from "./product-table";
import type { BusinessMetrics } from "@/lib/types";
import { formatNumber, formatPercentage, formatRupiah } from "@/lib/utils";
export function ProductPreview({ metrics }: { metrics: BusinessMetrics }) {
  const [expanded, setExpanded] = useState(false);
  const { products } = metrics;
  const profitLeader =
    products.length && products.every((p) => p.grossProfit !== null)
      ? products.toSorted((a, b) => b.grossProfit! - a.grossProfit!)[0]
      : null;
  return (
    <section
      className="panel product-preview executive-products"
      aria-label="Ringkasan produk teratas"
    >
      <div className="executive-heading">
        <h2>Performa Produk</h2>
        <p>Lima kontributor pendapatan terbesar</p>
      </div>
      {profitLeader && (
        <p className="product-profit-focus">
          Laba kotor terbesar: <strong>{entityLabel(profitLeader.name)}</strong>{" "}
          · {formatRupiah(profitLeader.grossProfit!)}. Peringkat penjualan di
          bawah bisa berbeda dari peringkat keuntungan.
        </p>
      )}
      <table className="executive-product-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Pendapatan</th>
            <th>Porsi</th>
            {metrics.capabilities.units && (
              <th className="product-extra">Unit</th>
            )}
            {products.some((p) => p.margin !== null) && (
              <th className="product-extra">Margin</th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.slice(0, 5).map((p) => (
            <tr key={p.name}>
              <th scope="row">{entityLabel(p.name)}</th>
              <td>{formatRupiah(p.revenue)}</td>
              <td>
                {metrics.revenue > 0 ? formatPercentage(p.contribution) : "—"}
              </td>
              {metrics.capabilities.units && (
                <td className="product-extra">{formatNumber(p.units)}</td>
              )}
              {products.some((x) => x.margin !== null) && (
                <td className="product-extra">
                  {p.margin === null ? "—" : formatPercentage(p.margin)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <details
        className="product-detail-disclosure"
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>Lihat analisis lengkap</summary>
        {expanded && <ProductTable products={products} />}
      </details>
    </section>
  );
}
