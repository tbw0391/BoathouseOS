import Link from "next/link";

export default function StorePage() {
  return (
    <div className="min-h-screen p-8">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold mt-4">Team Store</h1>
      <p className="text-sm text-gray-500 mt-2">Coming soon.</p>
    </div>
  );
}
