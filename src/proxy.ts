import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isClerkInternalRoute = createRouteMatcher(["/__clerk(.*)", "/clerk_(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/",
  "/onboarding(.*)",
  "/profile(.*)",
  "/saved(.*)",
  "/passed(.*)",
  "/api/discover(.*)",
  "/api/me(.*)",
  "/api/onboarding(.*)",
  "/api/profile(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isClerkInternalRoute(req)) {
    return;
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|clerk_|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
