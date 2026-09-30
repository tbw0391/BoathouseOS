import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QrCodes } from "./QrCodes";
import { IS_DEMO_SITE } from "@/lib/site";

export default async function QrCodesPage() {
  // These codes advertise the demo, so production has none.
  if (!IS_DEMO_SITE) notFound();
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 print:hidden">QR codes</h1>
      <QrCodes />
    </div>
  );
}
