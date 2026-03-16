// src/middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;

        console.log(`[Middleware] Path: ${path} | Token Role:`, token?.role);

        // Agar user logged in hai aur login/home page pe jaana chahta hai, toh dashboard bhej do
        if (path === "/login" || path === "/") {
            if (token?.role === "PROFESSOR") {
                return NextResponse.redirect(new URL("/professor", req.url));
            } else if (token?.role === "STUDENT") {
                return NextResponse.redirect(new URL("/student", req.url));
            }
        }

        // 🔥 SECURITY: Agar STUDENT hai aur Professor ke route pe jaa raha hai, block karo
        if (path.startsWith("/professor") && token?.role !== "PROFESSOR") {
            return NextResponse.redirect(new URL("/student", req.url));
        }

        // 🔥 SECURITY: Agar PROFESSOR hai aur Student ke route pe jaa raha hai, block karo
        if (path.startsWith("/student") && token?.role !== "STUDENT") {
            return NextResponse.redirect(new URL("/professor", req.url));
        }
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const path = req.nextUrl.pathname;
                // Agar protected route hai, toh token (login) hona zaroori hai
                if (path.startsWith("/professor") || path.startsWith("/student")) {
                    return !!token;
                }
                return true; // Login page sabke liye khula hai
            },
        },
    }
);

// Yeh un URLs ki list hai jaha middleware chalega
export const config = {
    matcher: ["/", "/login", "/professor/:path*", "/student/:path*"],
};