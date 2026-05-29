import { withAuth } from "next-auth/middleware";

// Redirect unauthenticated users to our custom login page (not the default
// NextAuth /api/auth/signin page).
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/invoices/:path*",
    "/services/:path*",
    "/notifications/:path*",
    "/settings/:path*",
  ],
};
