import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="route-error">
      <h1>Halaman tidak ditemukan</h1>
      <p>Halaman yang Anda cari belum tersedia.</p>
      <Button asChild>
        <Link href="/dashboard">Kembali ke Dashboard</Link>
      </Button>
    </div>
  );
}
