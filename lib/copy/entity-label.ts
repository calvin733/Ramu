// Presentation only: keep stored names and query matching untouched.
export function entityLabel(
  name: string,
  kind: "channel" | "product" = "product",
) {
  return /^(tanpa kanal|unassigned_channel|unknown(?: channel)?|null|undefined)$/i.test(
    name.trim(),
  )
    ? kind === "channel"
      ? "Channel belum diketahui"
      : "Produk belum diketahui"
    : name;
}
