"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden"
            style={{ fontFamily: "'Syne', sans-serif" }}>


            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] -z-10 animate-pulse delay-1000" />

            <div className="max-w-md w-full text-center space-y-8 z-10">

                <div className="relative flex justify-center items-center">
                    <h1 className="text-[150px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 select-none drop-shadow-2xl"
                        style={{ lineHeight: 1 }}>
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center opacity-50 mix-blend-overlay">
                        <FileQuestion className="h-32 w-32 text-blue-400 animate-bounce" style={{ animationDuration: "3s" }} />
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Lost in Cyberspace?</h2>
                    <p className="text-gray-400 text-lg">
                        The page or quiz you are looking for has been moved, deleted, or simply doesn't exist.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    <Button
                        onClick={() => router.back()}
                        variant="outline"
                        className="w-full sm:w-auto border-white/10 text-white hover:bg-white/5 hover:text-white h-12 px-6 gap-2 bg-transparent backdrop-blur-sm rounded-full transition-all duration-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> Go Back
                    </Button>
                    <Link href="/" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto h-12 px-8 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 border-none">
                            <Home className="h-4 w-4" /> Return Home
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="absolute bottom-8 text-white/20 text-xs tracking-[0.2em] uppercase font-bold text-center w-full">
                Error Code: PAGE_NOT_FOUND
            </div>
        </div>
    );
}
