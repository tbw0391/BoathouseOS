import { SiteShell, loadSite } from "../SiteShell";
import { SiteText } from "../SiteText";
import { InquiryForm } from "../InquiryForm";

export const dynamic = "force-dynamic";

export default async function SiteJoin() {
  const { club, preview } = await loadSite("join");
  return (
    <SiteShell club={club} preview={preview}>
      <h1 className="text-3xl font-bold mb-2">Join {club.name}</h1>
      <div className="text-gray-700 mb-6 max-w-2xl">
        {club.settings.joinText ? (
          <SiteText text={club.settings.joinText} />
        ) : (
          <p>Interested in rowing with us? Tell us a little about yourself and we&apos;ll be in touch.</p>
        )}
      </div>
      <InquiryForm kind="join" />
    </SiteShell>
  );
}
