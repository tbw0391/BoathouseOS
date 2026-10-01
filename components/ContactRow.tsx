import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";
import type { Contact } from "@/lib/contacts";

// One person on the Who to Ask page or home card: photo, name (to their
// profile), what they do, and tap to email, call or text.
export function ContactRow({ person, role, compact = false }: { person: Contact; role?: string | null; compact?: boolean }) {
  const digits = (person.phone ?? "").replace(/[^\d+]/g, "");
  return (
    <li className="flex items-center gap-3 py-2">
      {!compact &&
        (person.photo_url ? (
          <StorageImage src={person.photo_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full border shrink-0" />
        ))}
      <div className="flex-1 min-w-0">
        {role && <p className="text-xs text-gray-500">{role}</p>}
        <Link href={`/roster/${person.id}`} className="font-medium hover:underline truncate block">
          {person.name}
        </Link>
      </div>
      <div className="flex items-center gap-3 text-[var(--color-primary)] shrink-0">
        {person.email && (
          <a href={`mailto:${person.email}`} aria-label={`Email ${person.name}`}>
            <Mail className="w-5 h-5" />
          </a>
        )}
        {digits && (
          <>
            <a href={`sms:${digits}`} aria-label={`Text ${person.name}`}>
              <MessageSquare className="w-5 h-5" />
            </a>
            <a href={`tel:${digits}`} aria-label={`Call ${person.name}`}>
              <Phone className="w-5 h-5" />
            </a>
          </>
        )}
      </div>
    </li>
  );
}
