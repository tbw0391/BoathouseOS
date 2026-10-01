"use client";

import { useRouter } from "next/navigation";

// "← Back" on the website's inner pages: the installed app has no browser
// back button. Goes to the site's home page when there's nowhere to go back to.
export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/site"))}
      className="mb-4 text-sm text-[var(--color-primary)] hover:underline"
    >
      ← Back
    </button>
  );
}
