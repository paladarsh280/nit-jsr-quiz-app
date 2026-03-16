"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Menu } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isProfessor = session?.user?.role === "PROFESSOR";

    const links = isProfessor
        ? [
            { href: "/professor", label: "Dashboard" },
            { href: "/professor/create-test", label: "Create Test" },

        ]
        : [
            { href: "/student", label: "Dashboard" },
            { href: "/student/history", label: "My Results" },
        ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
            <div className="flex h-16 items-center px-4 md:px-8 justify-between">

                {/* Left Side: Mobile Hamburger & Logo */}
                <div className="flex items-center gap-2 md:gap-4">

                    {/* Mobile Menu Trigger (Only visible on small screens) */}
                    <div className="md:hidden">
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="mr-2">
                                    <Menu className="h-6 w-6 text-gray-700" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] bg-white">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2 text-left">
                                        <GraduationCap className="h-6 w-6 text-blue-600" />
                                        <span>NITJSR Quiz</span>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col space-y-3 mt-8">
                                    {links.map((link) => {
                                        const isActive = pathname === link.href;
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setIsMobileMenuOpen(false)} // Click karne pe menu band ho jaye
                                            >
                                                <span
                                                    className={`block px-4 py-3 rounded-md text-base font-medium transition-colors ${isActive
                                                        ? "bg-blue-50 text-blue-700"
                                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                                        }`}
                                                >
                                                    {link.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-blue-600 hidden md:block" />
                        <span className="text-xl font-bold tracking-tight text-gray-900">
                            NITJSR Quiz
                        </span>
                    </Link>
                </div>

                {/* Center: Desktop Navigation Links (Hidden on mobile) */}
                <div className="hidden md:flex items-center space-x-2 flex-1 ml-8">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link key={link.href} href={link.href}>
                                <span
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        }`}
                                >
                                    {link.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side: User Profile Dropdown (Visible on both) */}
                <div className="flex items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10 border border-gray-200">
                                    <AvatarImage src={session?.user?.image || ""} alt="User" />
                                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                        {session?.user?.name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none truncate">{session?.user?.name}</p>
                                    <p className="text-xs leading-none text-muted-foreground truncate">
                                        {session?.user?.email}
                                    </p>
                                    <p className="text-xs font-bold text-blue-600 mt-1">
                                        Role: {session?.user?.role}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                                onClick={() => signOut({ callbackUrl: "/login" })}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

            </div>
        </nav>
    );
}