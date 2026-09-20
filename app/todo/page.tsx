import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface BacklogItem {
  checked: boolean;
  text: string;
}

interface BacklogSection {
  title: string;
  items: BacklogItem[];
}

function parseBacklog(markdown: string): BacklogSection[] {
  const sections: BacklogSection[] = [];
  let currentSection: BacklogSection | null = null;
  let currentItem: BacklogItem | null = null;

  for (const line of markdown.split("\n")) {
    const sectionMatch = line.match(/^## (.+)/);
    const itemMatch = line.match(/^- \[([ x])\] (.+)/);

    if (sectionMatch) {
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      sections.push(currentSection);
      currentItem = null;
    } else if (itemMatch && currentSection) {
      currentItem = { checked: itemMatch[1] === "x", text: itemMatch[2].trim() };
      currentSection.items.push(currentItem);
    } else if (line.startsWith("      ") && currentItem) {
      currentItem.text += " " + line.trim();
    } else if (line.trim() && !line.startsWith("#") && currentSection && !currentItem) {
      // A stray non-checklist note under a section heading.
      currentSection.items.push({ checked: false, text: line.trim() });
    }
  }

  return sections;
}

export default async function TodoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const callerRole = (callerData as { role: string } | null)?.role;
  if (callerRole !== "admin") notFound();

  const markdown = fs.readFileSync(path.join(process.cwd(), "BACKLOG.md"), "utf8");
  const sections = parseBacklog(markdown);
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const doneItems = sections.reduce((sum, s) => sum + s.items.filter((i) => i.checked).length, 0);

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">To-do list</h1>
        <span className="text-sm text-gray-500">
          {doneItems}/{totalItems} done
        </span>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="font-medium text-[#022e5d] mb-2">{section.title}</h2>
            <ul className="flex flex-col gap-1.5">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className={`text-sm flex gap-2 ${item.checked ? "text-gray-400 line-through" : ""}`}
                >
                  <span>{item.checked ? "✅" : "⬜"}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
