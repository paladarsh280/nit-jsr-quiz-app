import Link from "next/link";
import { Github, Info, Heart } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-white border-t border-gray-100 mt-auto py-6 relative overflow-hidden">
            {/* Subtle top gradient line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">

                {/* Left Side: Instructions Icon */}
                <Link href="/instructions" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors group">
                    <div className="p-2 bg-gray-50 rounded-full border border-gray-100 group-hover:border-blue-200 group-hover:bg-blue-50 transition-all">
                        <Info className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Instructions & Rules</span>
                </Link>

                {/* Middle: Credits */}
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                    Created with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500 animate-pulse" /> by
                    <a
                        href="https://nitjsr.ac.in/clubs/webteam"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
                    >
                        Official Web-Team
                    </a>
                </div>

                {/* Right Side: GitHub Icon */}
                <a
                    href="https://github.com/paladarsh280/nit-jsr-quiz-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
                >
                    <span className="text-sm font-medium hidden sm:inline-block">View Source</span>
                    <div className="p-2 bg-gray-50 rounded-full border border-gray-100 group-hover:border-gray-300 group-hover:bg-gray-100 transition-all">
                        <Github className="h-4 w-4" />
                    </div>
                </a>

            </div>
        </footer>
    );
}
