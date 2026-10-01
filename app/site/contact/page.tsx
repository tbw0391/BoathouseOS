import { SiteShell, loadSite } from "../SiteShell";
import { InquiryForm } from "../InquiryForm";

export const dynamic = "force-dynamic";

export default async function SiteContact() {
  const { club, preview } = await loadSite("contact");
  return (
    <SiteShell club={club} preview={preview}>
      <h1 className="text-3xl font-bold mb-2">Contact us</h1>
      <p className="text-gray-600 mb-6">Send {club.name} a message and someone will get back to you.</p>
      <InquiryForm kind="contact" />
    </SiteShell>
  );
}
