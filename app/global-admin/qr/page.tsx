import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QrCodes } from "./QrCodes";

export default async function QrCodesPage() {
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) notFound();

  return (
    <div className="min-h-screen p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 print:hidden">QR codes</h1>
      <QrCodes />
    </div>
  );
}
