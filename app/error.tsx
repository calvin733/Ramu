"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="route-error">
      <h1>Halaman belum dapat ditampilkan</h1>
      <p>Coba muat ulang halaman untuk melanjutkan.</p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  );
}
