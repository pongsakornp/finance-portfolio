import type { NextAuthConfig } from "next-auth";

// Edge-safe subset: no DB / bcrypt imports here (used by middleware)
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // self-hosted behind Dokploy's reverse proxy — we own the ingress
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = String(token.id);
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isPublic =
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/health");

      if (!isPublic) return isLoggedIn;
      if (isLoggedIn && (path === "/login" || path === "/register")) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
  providers: [], // added in auth.ts (bcrypt + db are node-only)
  // ponytail: dev fallback secret so local dev never blocks; Dokploy env sets a real one
  secret: process.env.AUTH_SECRET ?? "dev-only-insecure-secret",
} satisfies NextAuthConfig;
