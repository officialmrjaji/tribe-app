import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <ClerkSetupNotice mode="sign in" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f1] px-4 py-10">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </main>
  );
}

function ClerkSetupNotice({ mode }: { mode: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f1] px-4 py-10 text-[#17201b]">
      <section className="max-w-md rounded-lg border border-[#d8ded1] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">Sign-in setup</p>
        <h1 className="mt-2 text-2xl font-semibold">Authentication keys needed</h1>
        <p className="mt-3 text-sm leading-6 text-[#34443a]">
          Add the authentication environment variables from <code>.env.example</code> to
          enable {mode}.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white"
          href="/"
        >
          Back to Tribe
        </Link>
      </section>
    </main>
  );
}
