"use client";
import { useState } from "react";
import { ProductTable } from "./product-table";
import type { ProductMetrics } from "@/lib/types";
import { formatPercentage, formatRupiah } from "@/lib/utils";

export function ProductPreview({ products }: { products: ProductMetrics[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className="panel product-preview"
      aria-label="Ringkasan produk teratas"
    >
      <div className="panel-heading">
        <div>
          <h2>Produk Teratas</h2>
          <p>Tiga kontributor pendapatan terbesar pada periode ringkasan.</p>
        </div>
      </div>
      <ul className="product-preview-list">
        {products.slice(0, 3).map((product, i) => (
          <li key={product.name}>
            <span className="product-rank" aria-hidden="true">
              {i + 1}
            </span>
            <strong>{product.name}</strong>
            <div>
              <strong>{formatRupiah(product.revenue)}</strong>
              <span>
                {formatPercentage(product.contribution)} dari pendapatan
              </span>
            </div>
          </li>
        ))}
      </ul>
      <details
        className="product-detail-disclosure"
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>Lihat Analisis Produk</summary>
        {expanded && <ProductTable products={products} />}
      </details>
    </section>
  );
}
