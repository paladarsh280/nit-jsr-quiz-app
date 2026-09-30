"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function ScreenshotProtection() {
    const [isBlurred, setIsBlurred] = useState(false);
    const { data: session } = useSession();
    const userEmail = session?.user?.email || "NIT JSR Quiz Portal";

    useEffect(() => {
        // 1. Prevent Context Menu (Right click / Mobile long press menu)
        const handleContextMenu = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            toast.error("Security Restriction: Action not allowed.", { id: "sec-context" });
        };

        // 2. Prevent Copy & Cut
        const handleCopyCut = (e: ClipboardEvent) => {
            e.preventDefault();
            toast.error("Copying content is restricted.", { id: "sec-copy" });
        };

        // 3. Block Screenshot & DevTools Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // PrintScreen key
            if (e.key === "PrintScreen" || e.code === "PrintScreen") {
                e.preventDefault();
                try {
                    navigator.clipboard.writeText("");
                } catch {
                    // ignore
                }
                setIsBlurred(true);
                setTimeout(() => setIsBlurred(false), 2000);
                toast.error("Screenshots are restricted on this portal!", { id: "sec-prt-scn" });
                return;
            }

            const isCmdOrCtrl = e.ctrlKey || e.metaKey;

            // Ctrl + P / Cmd + P (Print)
            if (isCmdOrCtrl && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                toast.error("Printing is disabled.", { id: "sec-print" });
                return;
            }

            // Ctrl + S / Cmd + S (Save Page)
            if (isCmdOrCtrl && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                toast.error("Saving page is disabled.", { id: "sec-save" });
                return;
            }

            // F12 & DevTools
            if (
                e.key === "F12" ||
                (isCmdOrCtrl && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j")) ||
                (e.altKey && isCmdOrCtrl && (e.key === "I" || e.key === "i"))
            ) {
                e.preventDefault();
                toast.error("Developer tools are restricted.", { id: "sec-devtools" });
                return;
            }

            // Ctrl + U / Cmd + U
            if (isCmdOrCtrl && (e.key === "u" || e.key === "U")) {
                e.preventDefault();
                toast.error("Viewing page source is disabled.", { id: "sec-source" });
                return;
            }

            // Win+Shift+S / Snipping Tool
            if ((e.key === "S" || e.key === "s") && e.shiftKey && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsBlurred(true);
                setTimeout(() => setIsBlurred(false), 2500);
                toast.error("Screen capture tool detected!", { id: "sec-snip" });
                return;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "PrintScreen" || e.code === "PrintScreen") {
                try {
                    navigator.clipboard.writeText("");
                } catch {
                    // ignore
                }
            }
        };

        // 4. Mobile Multi-Finger Gesture Protection (e.g. 3-finger swipe screenshot on Android)
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches && e.touches.length >= 3) {
                setIsBlurred(true);
                setTimeout(() => setIsBlurred(false), 2000);
                toast.error("Multi-finger gesture detected! Content protected.", { id: "sec-touch" });
            }
        };

        // 5. Blur on window blur / tab switch / pagehide (App Switcher on Mobile)
        const handleWindowBlur = () => {
            setIsBlurred(true);
        };

        const handleWindowFocus = () => {
            setIsBlurred(false);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsBlurred(true);
            } else {
                setIsBlurred(false);
            }
        };

        const handlePageHide = () => {
            setIsBlurred(true);
        };

        // Attach listeners
        window.addEventListener("contextmenu", handleContextMenu);
        window.addEventListener("copy", handleCopyCut);
        window.addEventListener("cut", handleCopyCut);
        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        window.addEventListener("touchstart", handleTouchStart, { passive: true });
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("focus", handleWindowFocus);
        window.addEventListener("pagehide", handlePageHide);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("contextmenu", handleContextMenu);
            window.removeEventListener("copy", handleCopyCut);
            window.removeEventListener("cut", handleCopyCut);
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("focus", handleWindowFocus);
            window.removeEventListener("pagehide", handlePageHide);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return (
        <>
            {/* Dynamic Security Watermark across screen */}
            <div className="fixed inset-0 z-[88888] pointer-events-none overflow-hidden select-none opacity-[0.035] dark:opacity-[0.05] flex flex-wrap content-between justify-between p-4 rotate-[-15deg] scale-125">
                {Array.from({ length: 24 }).map((_, idx) => (
                    <div key={idx} className="p-6 text-xs md:text-sm font-mono font-bold tracking-widest text-foreground uppercase whitespace-nowrap">
                        {userEmail} • NIT JSR • SECURITY PROTECTED
                    </div>
                ))}
            </div>

            {/* Security Overlay when blurred */}
            {isBlurred && (
                <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 select-none pointer-events-auto">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md backdrop-blur-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="text-5xl mb-4">🛡️</div>
                        <h2 className="text-2xl font-bold text-red-400 mb-2">Content Protected</h2>
                        <p className="text-gray-300 text-sm">
                            Screen capturing or switching away is restricted to maintain portal security. Return focus to resume.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
