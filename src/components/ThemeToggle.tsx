"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg border-2 bg-white dark:bg-white/5 dark:backdrop-blur-md border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
                {theme === "dark" ? (
                    <Sun className="h-6 w-6 text-yellow-400 animate-in spin-in-12 duration-500" />
                ) : (
                    <Moon className="h-6 w-6 text-blue-600 animate-in spin-in-12 duration-500" />
                )}
                <span className="sr-only">Toggle theme</span>
            </Button>
        </div>
    );
}
