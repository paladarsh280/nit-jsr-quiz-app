// src/app/(dashboard)/student/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { verifyAndJoinQuiz } from "@/actions/student";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowRight, Loader2, Clock, CheckCircle2 } from "lucide-react";

export default function StudentDashboard() {
    const { data: session } = useSession();
    const router = useRouter();

    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.trim().length !== 6) {
            toast.error("Please enter a valid 6-character code.");
            return;
        }

        setIsLoading(true);
        const result = await verifyAndJoinQuiz(code.trim());

        if (result.success) {
            if (result.message) toast.info(result.message); // Resuming message
            else toast.success("Code Verified! Taking you to the exam room...");

            // ✅ Agar code sahi hai, toh sidha Test Room me le jao (Yeh page hum next banayenge)
            setTimeout(() => {
                router.push(`/test/${result.quizId}`);
            }, 1000);

        } else {
            toast.error(result.error);
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">

            {/* Welcome Section */}
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-green-500">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <GraduationCap className="h-8 w-8 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Welcome, {session?.user?.name?.split(" ")[0] || "Student"}! 🎓
                    </h1>
                    <p className="text-gray-500">Enter your professor's code to join a live quiz.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* JOIN QUIZ CARD */}
                <Card className="shadow-md border-t-4 border-t-blue-600">
                    <CardHeader className="text-center pb-2 pt-8">
                        <CardTitle className="text-3xl font-black text-gray-800 tracking-tight">Join a Quiz</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Enter the 6-character code provided by your professor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-10 pt-4">
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="e.g. A7X9BQ"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="text-center text-3xl font-mono tracking-[0.25em] h-16 uppercase placeholder:text-gray-300 border-2 focus-visible:ring-blue-500"
                                    maxLength={6}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading || code.length !== 6}
                                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 gap-2"
                            >
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Join Now"}
                                {!isLoading && <ArrowRight className="h-5 w-5" />}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* QUICK STATS / INFO CARD */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" /> Important Instructions
                    </h2>
                    <Card className="bg-blue-50/50 border-blue-100">
                        <CardContent className="p-6 space-y-4 text-sm text-gray-700">
                            <div className="flex gap-3">
                                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                                <p>Ensure you have a stable internet connection before joining.</p>
                            </div>
                            <div className="flex gap-3">
                                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                                <p>Do not switch tabs or minimize the browser during the test. Your actions are being recorded.</p>
                            </div>
                            <div className="flex gap-3">
                                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                                <p>Answers are auto-saved. If disconnected, simply rejoin using the same code to resume.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}