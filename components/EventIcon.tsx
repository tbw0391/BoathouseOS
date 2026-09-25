import { getEventIconUrl } from "@/lib/eventIcons";

export function EventIcon({
  title,
  iconUrl,
  className = "w-5 h-5",
}: {
  title: string;
  iconUrl?: string | null;
  className?: string;
}) {
  const url = iconUrl || getEventIconUrl(title);
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${className} shrink-0 object-contain`} />
  );
}
