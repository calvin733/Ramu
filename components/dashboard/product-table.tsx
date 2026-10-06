"use client";
import { useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { ProductMetrics } from "@/lib/types";
import { formatNumber, formatPercentage, formatRupiah } from "@/lib/utils";

const colors = ["cocoa", "cookie", "cheese", "almond", "classic"];
export function ProductTable({ products }: { products: ProductMetrics[] }) {
  const [all, setAll] = useState(false);
  return (
    <section className="panel products-panel">
      <div className="panel-heading">
        <div>
          <h2>Produk Teratas</h2>
          <p>Produk dengan kontribusi pendapatan terbesar</p>
        </div>
        {products.length > 5 && (
          <button className="text-button" onClick={() => setAll(!all)}>
            {all ? "Tampilkan 5" : "Lihat semua"}
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="product-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>
                <span>
                  Pendapatan <ArrowDown size={12} />
                </span>
              </th>
              <th>Terjual</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {(all ? products : products.slice(0, 5)).map((p, index) => (
              <tr key={p.name}>
                <td>
                  <div className="product-cell">
                    <span
                      className={`product-avatar ${colors[index % colors.length]}`}
                    >
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        {formatPercentage(p.contribution)} dari pendapatan
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{formatRupiah(p.revenue)}</strong>
                  <div className="revenue-bar">
                    <span
                      style={{
                        width: `${products[0].revenue ? (p.revenue / products[0].revenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </td>
                <td>
                  {formatNumber(p.units)} <span className="muted">unit</span>
                </td>
                <td>
                  {p.margin !== null ? (
                    <span
                      className={
                        p.margin < 25 ? "margin-pill low" : "margin-pill"
                      }
                    >
                      {formatPercentage(p.margin)}
                    </span>
                  ) : (
                    <span className="muted" title="Data biaya belum tersedia">
                      -
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footnote">
        Margin dihitung dari biaya per unit (COGS), sebelum biaya operasional.
      </div>
    </section>
  );
}
