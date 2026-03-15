// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "./db";

export const authOptions: NextAuthOptions = {
    // @ts-ignore - Prisma Adapter type mismatch ignore karne ke liye
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            profile(profile) {
                // Agar email me shuru me 4 numbers hain (jaise 2024), toh wo STUDENT hai
                const isStudent = /^\d{4}/.test(profile.email);

                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    role: isStudent ? "STUDENT" : "PROFESSOR", // Auto-assign Role
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            if (user.email && user.email.endsWith("@nitjsr.ac.in")) {
                return true;
            }
            return false; // Sirf NIT JSR allowed
        },

        async session({ session, user }) {
            if (session.user) {
                // user object ko any bol diya taaki TS error na de
                const dbUser = user as any;
                session.user.id = dbUser.id;
                session.user.role = dbUser.role;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
};