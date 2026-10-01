import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canCreateElections, canCreateForms } from "@/lib/forms";
import { FormBuilder } from "../FormBuilder";

export default async function NewFormPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const election = (await searchParams).kind === "election";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role, is_board_member").eq("id", user.id).single();
  const profile = me as { role: string; is_board_member: boolean } | null;
  if (election ? !canCreateElections(profile) : !canCreateForms(profile)) redirect("/forms");

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-4">
      <Link href="/forms" className="text-sm text-gray-500 hover:underline">
        ← Forms &amp; Elections
      </Link>
      <h1 className="text-2xl font-bold">{election ? "New election" : "New form"}</h1>
      <FormBuilder
        initial={{
          kind: election ? "election" : "form",
          title: "",
          description: "",
          audience: "everyone",
          voters: "everyone",
          closes_at: null,
          questions: [],
        }}
      />
    </div>
  );
}
