import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-10 text-[#17201b]">
      <section className="mx-auto max-w-xl rounded-lg border border-[#d8ded1] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">Not found</p>
        <h1 className="mt-2 text-2xl font-semibold">
          This part of Tribe is not available.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#34443a]">
          The page may have moved, been removed, or may not be available to your
          account.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          href="/"
        >
          Return to People
        </Link>
      </section>
    </main>
  );
}
