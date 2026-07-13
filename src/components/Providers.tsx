"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <NextThemesProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
            <SessionProvider>
                {children}
            </SessionProvider>
        </NextThemesProvider>
    );
};
