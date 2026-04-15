import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "./db";

export const authOptions: NextAuthOptions = {

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

                if (profile.email === "paladarsh593@gmail.com") {
                    return {
                        id: profile.sub,
                        name: profile.name,
                        email: profile.email,
                        image: profile.picture,
                        role: "PROFESSOR",
                    };
                }


                const isStudent = /^\d{4}/.test(profile.email);
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    role: isStudent ? "STUDENT" : "PROFESSOR",
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {

            if (
                user.email === "paladarsh593@gmail.com" ||
                (user.email && user.email.endsWith("@nitjsr.ac.in"))
            ) {
                return true;
            }
            return false;
        },

        async jwt({ token, user, trigger }) {

            if (user) {
                console.log("[NextAuth] First Login - User:", user.email, "Role given by profile:", (user as any).role);
                token.id = user.id;
                token.email = user.email;
                token.role = (user as any).role || "STUDENT";
            }

            if (token.email === "paladarsh593@gmail.com") {
                token.role = "PROFESSOR";
            } else if (!token.role && token.email) {

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