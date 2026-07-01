import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isClerkInternalRoute = createRouteMatcher(["/__clerk(.*)", "/clerk_(.*)"]);
const isSignedWebhookRoute = createRouteMatcher(["/api/premium/webhook(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/",
  "/ai(.*)",
  "/onboarding(.*)",
  "/profile(.*)",
  "/profiles(.*)",
  "/saved(.*)",
  "/passed(.*)",
  "/messages(.*)",
  "/notifications(.*)",
  "/premium(.*)",
  "/safety(.*)",
  "/settings(.*)",
  "/square(.*)",
  "/voice(.*)",
  "/api/conversations(.*)",
  "/api/ai(.*)",
  "/api/discover(.*)",
  "/api/messages(.*)",
  "/api/me(.*)",
  "/api/notifications(.*)",
  "/api/onboarding(.*)",
  "/api/premium(.*)",
  "/api/profile(.*)",
  "/api/square(.*)",
  "/api/voice(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isClerkInternalRoute(req) || isSignedWebhookRoute(req)) {
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
