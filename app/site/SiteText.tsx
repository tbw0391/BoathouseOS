// Page text admins write for the club website: blank lines separate
// paragraphs, "## " starts a heading, "- " a bullet, "![caption](address)"
// on its own line is a photo, and web addresses become links. Plain text only (React escapes it), so nothing typed can
// run as code.

const LINK = /(\((?:https?:\/\/[^\s)]+|\/site(?:\/[^\s)]*)?)\)|https?:\/\/[^\s)]+|\/site(?:\/[^\s)]*)?)/g;

// A short label for a link, instead of printing the whole address.
function linkLabel(url: string) {
  if (/\.pdf(\?|$)/i.test(url)) return "Download PDF";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "Download";
  if (url.startsWith("/site")) return "Read more";
  return "Open link";
}

// Web addresses and the site's own pages (/site/...) become links. An
// address in brackets after some text ("Bylaws (https://...)") shows as a
// short label like "Download PDF".
function linkify(line: string, key: string) {
  const parts = line.split(LINK);
  return parts.map((part, i) => {
    if (!part) return null;
    const bracketed = part.startsWith("(") && part.endsWith(")");
    const url = bracketed ? part.slice(1, -1) : part;
    if (!/^(https?:\/\/|\/site)/.test(url)) return part;
    const external = !url.startsWith("/");
    return (
      <a
        key={`${key}-${i}`}
        href={url}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className={
          bracketed
            ? "inline-block mx-1 rounded-full border border-[var(--color-primary)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] no-underline align-middle"
            : "underline text-[var(--color-primary)] [overflow-wrap:anywhere]"
        }
      >
        {bracketed ? linkLabel(url) : url}
      </a>
    );
  });
}

const IMAGE_LINE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/;

export function SiteText({ text }: { text: string }) {
  const raw = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  // Photos one after another become one gallery, so a phone doesn't scroll
  // through a screenful per photo before the text.
  const blocks: string[] = [];
  for (const b of raw) {
    const isImages = b.split("\n").every((l) => IMAGE_LINE.test(l));
    const prev = blocks[blocks.length - 1];
    if (isImages && prev && prev.split("\n").every((l) => IMAGE_LINE.test(l))) blocks[blocks.length - 1] = `${prev}\n${b}`;
    else blocks.push(b);
  }
  return (
    <div className="flex flex-col gap-3 leading-relaxed min-w-0 [overflow-wrap:anywhere]">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const images = lines.map((l) => l.match(IMAGE_LINE));
        if (images.every(Boolean)) {
          return images.length === 1 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={images[0]![2]} alt={images[0]![1]} loading="lazy" className="w-full sm:max-w-xl h-auto rounded-lg" />
          ) : (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {images.map((m, j) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={j} src={m![2]} alt={m![1]} loading="lazy" className="w-full h-auto rounded-lg" />
              ))}
            </div>
          );
        }
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
