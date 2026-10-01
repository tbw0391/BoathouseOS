// Page text admins write for the club website: blank lines separate
// paragraphs, "## " starts a heading, "- " a bullet, and web addresses
// become links. Plain text only (React escapes it), so nothing typed can
// run as code.

function linkify(line: string, key: string) {
  const parts = line.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={`${key}-${i}`} href={part} target="_blank" rel="noreferrer" className="underline text-[var(--color-primary)] break-all">
        {part}
      </a>
    ) : (
      part
    )
  );
}

export function SiteText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines[0].startsWith("## ")) {
          return (
            <div key={i} className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-[var(--color-primary)]">{lines[0].slice(3)}</h2>
              {lines.length > 1 && <SiteText text={lines.slice(1).join("\n")} />}
            </div>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc pl-5 flex flex-col gap-1">
              {lines.map((l, j) => (
                <li key={j}>{linkify(l.slice(2), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {linkify(l, `${i}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
