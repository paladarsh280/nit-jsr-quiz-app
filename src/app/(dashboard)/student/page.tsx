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
import { GraduationCap, ArrowRight, Loader2, Clock, CheckCircle2, QrCode, X } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function StudentDashboard() {
    const { data: session } = useSession();
    const router = useRouter();

    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [isScanning, setIsScanning] = useState(false);

    // Initialize QR Scanner when modal opens
    const startScanner = () => {
        setIsScanning(true);
        setTimeout(() => {
            const scanner = new Html5QrcodeScanner("reader", { 
                qrbox: { width: 250, height: 250 }, 
                fps: 5 
            }, false);
            
            scanner.render((text) => {
                scanner.clear();
                setIsScanning(false);
                handleScannedUrl(text);
            }, (err) => {
                // Ignore continuous scan errors (normal behavior when no QR is in frame)
            });
        }, 100);
    };

    const stopScanner = () => {
        setIsScanning(false);
        // We can't perfectly unmount the scanner immediately without html5-qrcode throwing,
        // but removing it from the DOM handles most of it, we just let it die.
    };

    const handleScannedUrl = async (url: string) => {
        try {
            // Expected URL format: http://domain.com/test/[quizId]
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            // ["", "test", "cm8s32d8..."]
            if (pathParts[1] === 'test' && pathParts[2]) {
                const scannedQuizId = pathParts[2];
                // Since our join API takes a 6-letter `code`, but the QR encodes the `quizId`...
                // Wait, if the URL routes directly to `/test/[quizId]`, we don't even need to verify the code here!
                // The student just needs to be redirected to that URL. The test page itself handles verification if they are enrolled/etc.
                toast.success("QR Code scanned automatically!");
                router.push(`/test/${scannedQuizId}`);
            } else {
                toast.error("Invalid QR Code format.");
            }
        } catch (e) {
            toast.error("Unrecognized QR Code. Please try again.");
        }
    };

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
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <Button
                                    type="submit"
                                    disabled={isLoading || code.length !== 6}
                                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 gap-2"
                                >
                                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Join with Code"}
                                    {!isLoading && <ArrowRight className="h-5 w-5" />}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={startScanner}
                                    className="h-14 px-6 text-lg font-bold bg-purple-600 hover:bg-purple-700 gap-2"
                                >
                                    <QrCode className="h-6 w-6" /> Scan
                                </Button>
                            </div>
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

            {/* QR Scanner Modal */}
            {isScanning && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-xl font-bold flex items-center gap-2"><QrCode className="h-5 w-5" /> Scan to Join</h3>
                            <Button variant="ghost" size="icon" onClick={stopScanner} className="hover:bg-red-50 hover:text-red-500">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="p-6">
                            <div id="reader" className="w-full mx-auto rounded-xl overflow-hidden [&_video]:rounded-xl [&_video]:object-cover" />
                            <p className="text-center text-sm text-gray-500 mt-4">
                                Point your camera at the professor's screen
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}