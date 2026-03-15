// src/types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: "STUDENT" | "PROFESSOR";
        } & DefaultSession["user"];
    }

    interface User {
        role: "STUDENT" | "PROFESSOR";
    }
}