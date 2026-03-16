import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "./db";

export const authOptions: NextAuthOptions = {
    // @ts-ignore
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,

            authorization: {
                params: {
                    prompt: "select_account",
                    access_type: "offline",
                    response_type: "code"
                }
            },
            profile(profile) {
                // 🔥 TESTING KE LIYE SPECIAL EMAIL (Is ko sidha PROFESSOR bana do)
                if (profile.email === "paladarsh593@gmail.com") {
                    return {
                        id: profile.sub,
                        name: profile.name,
                        email: profile.email,
                        image: profile.picture,
                        role: "PROFESSOR",
                    };
                }

                // NIT JSR ke liye normal logic
                // Students ka email 4 numbers se suru hota hai (jaise 2024ugcs034@nitjsr.ac.in)
                const isStudent = /^\d{4}/.test(profile.email);
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    role: isStudent ? "STUDENT" : "PROFESSOR", // Numbers se suru hoto student varna Professor (jaise adarsh.cse@nitjsr.ac.in)
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            // 🔥 ALLOW ONLY NIT JSR + TERI TESTING EMAIL
            if (
                user.email === "paladarsh593@gmail.com" ||
                (user.email && user.email.endsWith("@nitjsr.ac.in"))
            ) {
                return true;
            }
            return false; // Baki sab reject
        },

        async jwt({ token, user, trigger }) {
            // First time login: `user` is available
            if (user) {
                console.log("[NextAuth] First Login - User:", user.email, "Role given by profile:", (user as any).role);
                token.id = user.id;
                token.email = user.email;
                token.role = (user as any).role || "STUDENT"; // Assume student if missing
            }

            // OVERRIDE: Absolutely force paladarsh593 to be PROFESSOR no matter what
            if (token.email === "paladarsh593@gmail.com") {
                token.role = "PROFESSOR";
            } else if (!token.role && token.email) {
                // If token role is somehow missing, fetch from DB
                const dbUser = await prisma.user.findUnique({
                    where: { email: token.email },
                    select: { role: true }
                });
                if (dbUser) {
                    token.role = dbUser.role;
                }
            }

            console.log(`[NextAuth] JWT Generated -> Email: ${token.email} | Role: ${token.role}`);
            return token;
        },

        async session({ session, token }) {
            console.log("[NextAuth] Session Callback - Token:", token);
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as "STUDENT" | "PROFESSOR";
            }
            return session;
        },
    },
    pages: { signIn: "/login" },
    secret: process.env.NEXTAUTH_SECRET,
};