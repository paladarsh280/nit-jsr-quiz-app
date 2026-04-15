"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizStats, updateQuizStatus } from "@/actions/professor";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/ui/PremiumLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayCircle, StopCircle, ArrowLeft, Loader2, Download, Users, BookOpen } from "lucide-react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

export default function QuizDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.quizId as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);
    const [waitingUsers, setWaitingUsers] = useState<number>(0);

    useEffect(() => {
        fetchQuiz();
    }, [quizId]);

    // Listen to Waiting Room Presence for DRAFT quizzes
    useEffect(() => {
        if (!quiz || quiz.status !== "DRAFT") return;

        const room = supabase.channel(`waiting_room_${quizId}`);

        const updateCount = () => {
            const state = room.presenceState();
            const count = Object.values(state).flat().filter((p: any) => p.role === 'student').length;
            setWaitingUsers(count);
        };

        room
            .on("presence", { event: "sync" }, updateCount)
            .on("presence", { event: "join" }, updateCount)
            .on("presence", { event: "leave" }, updateCount)
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await room.track({ role: "professor", joinedAt: Date.now() });
                }
            });

        return () => {
            supabase.removeChannel(room);
        };
    }, [quiz?.status, quizId]);

    const fetchQuiz = async () => {
        const res = await getQuizStats(quizId);
        if (res.success) setQuiz(res.quiz);
        else toast.error(res.error);
        setLoading(false);
    };

    const handleStatusChange = async (newStatus: "LIVE" | "COMPLETED") => {
        if (!confirm(`Are you sure you want to mark this quiz as ${newStatus}?`)) return;

        setStatusLoading(true);
        const res = await updateQuizStatus(quizId, newStatus);
        if (res.success) {
            toast.success(`Quiz is now ${newStatus}!`);
            fetchQuiz(); // Refresh data
        } else {
            toast.error("Failed to update status");
        }
        setStatusLoading(false);
    };
    // 🔥 EXCEL DOWNLOAD LOGIC
    const handleDownloadExcel = () => {
        if (!quiz || quiz.attempts.length === 0) {
            toast.error("No student data available to download!");
            return;
        }

        // 1. Data ko Excel format me map karo
        const excelData = quiz.attempts.map((attempt: any, index: number) => ({
            "Rank": index + 1,
            "Student Name": attempt.student.name || "Unknown",
            "Email (Roll No)": attempt.student.email,
            "Status": attempt.isFinished ? "Submitted" : "In Progress",
            "Total Score": attempt.score,
        }));

        // 2. SheetJS (xlsx) use karke file banao
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

        // 3. File ka naam set karo aur Download trigger karo
        const fileName = `${quiz.title.replace(/\s+/g, '_')}_Results.xlsx`;
        XLSX.writeFile(workbook, fileName);

        toast.success("Excel file downloaded successfully!");
    };
    if (loading) return <PremiumLoader text="Fetching Test Analytics..." />;
    if (!quiz) return <div className="text-center py-20">Quiz not found!</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">

            {/* Top Navigation */}
            <Button variant="ghost" onClick={() => router.push("/professor")} className="gap-2 -ml-4 text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>

            {/* Header Card */}
            <div className="bg-white p-6 md:p-8 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{quiz.title}</h1>
                        <Badge variant={quiz.status === 'LIVE' ? 'default' : quiz.status === 'COMPLETED' ? 'secondary' : 'outline'}
                            className={quiz.status === 'LIVE' ? 'bg-green-100 text-green-800' : ''}>
                            {quiz.status}
                        </Badge>
                    </div>
                    <p className="text-gray-500 text-sm max-w-2xl">{quiz.description || "No description provided."}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
                        <span className="bg-gray-100 px-3 py-1.5 rounded-md border text-gray-700 font-mono">
                            Code: <strong className="text-lg tracking-wider text-blue-700">{quiz.code}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-md text-blue-700">
                            <BookOpen className="h-4 w-4" /> {quiz.questions.length} Questions
                        </span>
                        <span className="flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-md text-purple-700">
                            <Users className="h-4 w-4" /> {quiz.attempts.length} Attempts
                        </span>
                    </div>
                </div>

                {/* Right Side: QR Code & Actions */}
                <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                    {/* QR Code */}
                    <div className="flex flex-col items-center justify-center bg-gray-50 p-3 rounded-lg border hover:shadow-md transition-shadow">
                        <QRCodeSVG
                            value={typeof window !== 'undefined' ? `${window.location.origin}/test/${quiz.id}` : ''}
                            size={120}
                            level="M"
                            includeMargin={false}
                        />
                        <span className="text-xs text-gray-500 mt-2 font-semibold tracking-wide uppercase">Scan to Join</span>
                    </div>

                    {/* Action Buttons (Live / End Test) */}
                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[200px]">
                        {quiz.status === "DRAFT" && (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in zoom-in duration-300">
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                        </div>
                                        <span className="text-sm font-semibold text-blue-800">Students Waiting</span>
                                    </div>
                                    <span className="text-2xl font-black text-blue-700">{waitingUsers}</span>
                                </div>
                                <Button onClick={() => handleStatusChange("LIVE")} disabled={statusLoading} className="bg-green-600 hover:bg-green-700 w-full gap-2 h-11">
                                    {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Start Test (Make Live)
                                </Button>
                            </div>
                        )}
                        {quiz.status === "LIVE" && quiz.quizMode === "LIVE_GUIDED" && (
                            <Button onClick={() => router.push(`/professor/live/${quiz.id}`)} className="bg-blue-600 hover:bg-blue-700 w-full gap-2 h-11">
                                <PlayCircle className="h-4 w-4" /> Enter Live Room
                            </Button>
                        )}
                        {quiz.status === "LIVE" && (
                            <Button onClick={() => handleStatusChange("COMPLETED")} disabled={statusLoading} variant="destructive" className="w-full gap-2 h-11">
                                {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />} End Test
                            </Button>
                        )}
                        {quiz.status === "COMPLETED" && (
                            <Button disabled variant="secondary" className="w-full h-11">
                                Test Ended
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            <Tabs defaultValue="results" className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="results">Student Results</TabsTrigger>
                    <TabsTrigger value="questions">Questions Overview</TabsTrigger>
                </TabsList>

                {/* RESULTS TAB */}
                <TabsContent value="results" className="mt-6 space-y-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-t-xl border-b">
                        <h2 className="text-lg font-semibold text-gray-800">Leaderboard & Marks</h2>
                        <Button
                            onClick={handleDownloadExcel} // 🔥 YE ADD KIYA
                            variant="outline"
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            <Download className="h-4 w-4" /> Download Excel
                        </Button>
                    </div>

                    <div className="bg-white border rounded-b-xl overflow-x-auto">
                        <Table className="min-w-[600px]">
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="w-16 text-center">Rank</TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Email (Roll No)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Score</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quiz.attempts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                            No students have attempted this quiz yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    quiz.attempts.map((attempt: any, idx: number) => (
                                        <TableRow key={attempt.id}>
                                            <TableCell className="text-center font-semibold text-gray-500">{idx + 1}</TableCell>
                                            <TableCell className="font-medium text-gray-900">{attempt.student.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-gray-600">{attempt.student.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={attempt.isFinished ? "default" : "outline"} className={attempt.isFinished ? "bg-green-100 text-green-800" : "text-yellow-600"}>
                                                    {attempt.isFinished ? "Submitted" : "In Progress"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">{attempt.score} Marks</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* QUESTIONS TAB */}
                <TabsContent value="questions" className="mt-6">
                    <div className="space-y-4">
                        {quiz.questions.map((q: any, i: number) => (
                            <div key={q.id} className="bg-white p-5 rounded-xl border shadow-sm">
                                <div className="flex gap-2 mb-2">
                                    <Badge variant="secondary">Q{i + 1}</Badge>
                                    <Badge variant="outline" className="text-xs">{q.type.replace(/_/g, ' ')}</Badge>
                                    <Badge variant="outline" className="text-green-600 border-green-200">+{q.marks} / -{q.negative}</Badge>
                                </div>
                                <p className="text-gray-800 font-medium whitespace-pre-wrap">{q.text}</p>
                                {q.imageUrl && <img src={q.imageUrl} alt="Q Diagram" className="mt-3 h-32 object-contain rounded border p-1" />}
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}