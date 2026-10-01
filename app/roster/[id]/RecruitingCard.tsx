import { GraduationCap } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { RECRUIT_FIELDS, DEFAULT_RECRUIT_FIELDS, isAdult, listingBlocker, type RecruitListing } from "@/lib/recruiting";
import { saveRecruitListing } from "./recruitActions";

type Contact = { id: string; message: string; created_at: string; school: string; name: string };

// College recruiting on a rower's or coxswain's profile (0121): the athlete
// or their parent picks what college coaches see; a parent approves for
// under-18s. Coaches and admins see where it stands and any messages.
export function RecruitingCard({
  profile,
  listing,
  canEdit,
  isParent,
  hasParent,
  contacts,
}: {
  profile: { id: string; display_name: string; role: string; birthday: string | null; approved_at: string | null; disabled_at: string | null };
  listing: RecruitListing | null;
  canEdit: boolean;
  isParent: boolean;
  hasParent: boolean;
  contacts: Contact[];
}) {
  const adult = isAdult(profile.birthday);
  const blocker = listingBlocker(listing, profile, true);
  const fields = listing ? listing.fields : DEFAULT_RECRUIT_FIELDS;
  const status = blocker ? blocker : "Listed: approved college coaches can see the details below and contact you.";

  return (
    <div className="mt-6 max-w-lg rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-3">
      <h2 className="font-semibold flex items-center gap-2">
        <GraduationCap className="w-5 h-5" aria-hidden />
        College recruiting
      </h2>
      <p className={`text-sm ${blocker ? "text-gray-600" : "text-green-700"}`}>{status}</p>

      {canEdit && (
        <ActionForm action={saveRecruitListing} className="flex flex-col gap-3 text-sm">
          <input type="hidden" name="profile_id" value={profile.id} />
          <p className="text-gray-600">
            College coaches (checked by BoathouseOS, with a school email) can see {isParent ? "your rower's" : "your"}{" "}
            name, club, and only the things ticked below. They never see phone numbers, emails, addresses, birthdays
            or medical information. To get in touch, they message the club coach and parents.
          </p>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="shown" defaultChecked={listing?.shown ?? false} className="w-4 h-4" />
            List {isParent ? profile.display_name : "me"} for college coaches
          </label>
          <fieldset className="border rounded-lg px-3 py-2 grid grid-cols-2 gap-1">
            <legend className="text-xs text-gray-500 px-1">Show</legend>
            {RECRUIT_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="field" value={f.key} defaultChecked={fields.includes(f.key)} className="w-4 h-4" />
                {f.label}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-gray-500">Photo, grad year, high school, side, weight and erg times come from the profile.</p>
          <div className="grid grid-cols-2 gap-2">
            <input name="height" defaultValue={listing?.height ?? ""} maxLength={20} placeholder={`Height (e.g. 6'1")`} className="border rounded px-2 py-1.5" />
            <input name="gpa" defaultValue={listing?.gpa ?? ""} maxLength={20} placeholder="GPA" className="border rounded px-2 py-1.5" />
          </div>
          <input name="intended_major" defaultValue={listing?.intended_major ?? ""} maxLength={100} placeholder="Intended major" className="border rounded px-2 py-1.5" />
          <textarea name="about" defaultValue={listing?.about ?? ""} maxLength={2000} rows={3} placeholder="About me: goals, results, what you're looking for" className="border rounded px-2 py-1.5" />
          <input name="video_url" defaultValue={listing?.video_url ?? ""} maxLength={500} placeholder="Video link (https://...)" className="border rounded px-2 py-1.5" />
          {isParent && !adult && (
            <label className="flex items-start gap-2">
              <input type="checkbox" name="parent_approves" defaultChecked={!!listing?.parent_approved_at} className="w-4 h-4 mt-0.5" />
              I&apos;m {profile.display_name}&apos;s parent or guardian, and I approve this listing.
            </label>
          )}
          {!isParent && !adult && (
            <p className="text-xs text-gray-500">
              {hasParent
                ? "Because you're under 18 (or have no birthday on your profile), a parent or guardian approves it from your profile page. Changing what's shown asks them again."
                : "Because you're under 18 (or have no birthday on your profile), a parent or guardian has to approve it. Ask your club admin to link a parent to your profile."}
            </p>
          )}
          <button
            type="submit"
            className="self-start bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 font-medium hover:bg-[var(--color-accent)] transition-colors"
          >
            Save
          </button>
        </ActionForm>
      )}

      {contacts.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Messages from college coaches</p>
          <ul className="flex flex-col gap-2 mt-1">
            {contacts.map((c) => (
              <li key={c.id} className="border-l-2 border-gray-200 pl-2">
                <span className="text-xs text-gray-500">
                  {c.name}, {c.school} · {new Date(c.created_at).toLocaleDateString()}
                </span>
                <p className="whitespace-pre-wrap">{c.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
