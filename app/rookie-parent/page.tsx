import { createClient } from "@/lib/supabase/server";
import { ROOKIE_PARENT_SECTIONS } from "@/lib/rookieParent";
import { SectionEditor } from "./SectionEditor";

export default async function RookieParentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: callerProfile }, { data: settingsData }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
    supabase
      .from("club_settings")
      .select("key, value")
      .in(
        "key",
        ROOKIE_PARENT_SECTIONS.map((s) => s.key)
      ),
  ]);
  const isAdmin = (callerProfile as { role: string } | null)?.role === "admin";
  const textByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [
      s.key,
      s.value,
    ])
  );

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Rookie Parent</h1>
      <p className="text-sm text-gray-500 mb-6">New to the team? Start here.</p>

      <div className="grid grid-cols-1 gap-3 max-w-md mb-8">
        {ROOKIE_PARENT_SECTIONS.map((s) => (
          <a
            key={s.key}
            href={`#${s.anchor}`}
            className="rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-center font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
          >
            {s.title}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-8 max-w-lg">
        {ROOKIE_PARENT_SECTIONS.map((s) => (
          <section key={s.key} id={s.anchor} className="scroll-mt-4">
            <h2 className="text-lg font-semibold mb-2">{s.title}</h2>
            <SectionEditor
              settingKey={s.key}
              text={textByKey.get(s.key) ?? null}
              canEdit={isAdmin}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
