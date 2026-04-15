"use client";

import { useEffect, useState } from "react";
import { getStudentHistory, getDetailedResultForPDF } from "@/actions/student";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/ui/PremiumLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, BookOpen, Clock, Lock } from "lucide-react";

export default function StudentHistoryPage() {
    const [attempts, setAttempts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const res = await getStudentHistory();
        if (res.success && res.attempts) setAttempts(res.attempts);
        else toast.error(res.error);
        setLoading(false);
    };

    const handleDownloadPDF = async (quizId: string, quizTitle: string) => {
        setDownloadingId(quizId);

        const res = await getDetailedResultForPDF(quizId);

        if (!res.success) {
            toast.error(res.error);
            setDownloadingId(null);
            return;
        }

        const { quiz, attempt } = res;

        if (!quiz || !attempt) {
            toast.error("Complete result not found");
            setDownloadingId(null);
            return;
        }

        const doc = new jsPDF();
        let yPos = 20;
        const pageHeight = doc.internal.pageSize.height;

        // Title Section
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("NIT JSR - Official Quiz Report", 105, yPos, { align: "center" });
        yPos += 12;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Quiz Title: ${quiz.title}`, 20, yPos);
        yPos += 8;
        doc.text(`Total Score: ${attempt.score}`, 20, yPos);
        yPos += 15;


        quiz.questions.forEach((q: any, index: number) => {

            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = 20;
            }


            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            const qLines = doc.splitTextToSize(`Q${index + 1}. ${q.text}`, 170);
            doc.text(qLines, 20, yPos);
            yPos += (qLines.length * 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            if (q.type === "SINGLE_CORRECT" || q.type === "MULTI_CORRECT") {
                q.options.forEach((opt: any, optIdx: number) => {
                    const optLines = doc.splitTextToSize(`   ${String.fromCharCode(65 + optIdx)}) ${opt.text}`, 160);
                    doc.text(optLines, 20, yPos);
                    yPos += (optLines.length * 5);
                });
                yPos += 2;
            }


            let correctAnswerText = "N/A";
            let studentAnswerText = "Not Attempted";

            const studentAns = attempt.answers.find((a: any) => a.questionId === q.id);
            const marksGot = studentAns ? studentAns.marksAwarded : 0;

            if (q.type === "SINGLE_CORRECT" || q.type === "MULTI_CORRECT") {
                const correctOpts = q.options.filter((o: any) => o.isCorrect).map((o: any) => o.text).join(", ");
                correctAnswerText = correctOpts || "None";

                if (studentAns && studentAns.selectedOptions.length > 0) {
                    const selectedTexts = q.options
                        .filter((o: any) => studentAns.selectedOptions.includes(o.id))
                        .map((o: any) => o.text);
                    studentAnswerText = selectedTexts.join(", ");
                }
            } else {

                correctAnswerText = (q.correctAnswer !== null && q.correctAnswer !== undefined && q.correctAnswer !== "")
                    ? String(q.correctAnswer)
                    : "Manual Grading Required";

                if (studentAns && studentAns.textResponse) {
                    studentAnswerText = String(studentAns.textResponse);
                }
            }


            doc.setTextColor(100, 100, 100);
            const stuAnsLines = doc.splitTextToSize(`Your Answer: ${studentAnswerText}`, 170);
            doc.text(stuAnsLines, 20, yPos);
            yPos += (stuAnsLines.length * 5);


            doc.setTextColor(0, 128, 0);
            const corrAnsLines = doc.splitTextToSize(`Correct Answer: ${correctAnswerText}`, 170);
            doc.text(corrAnsLines, 20, yPos);
            yPos += (corrAnsLines.length * 5);


            if (marksGot > 0) doc.setTextColor(0, 128, 0);
            else if (marksGot < 0) doc.setTextColor(200, 0, 0);
            else doc.setTextColor(0, 0, 0);

            doc.setFont("helvetica", "bold");
            doc.text(`Marks Awarded: ${marksGot}`, 20, yPos);
            yPos += 15;

            doc.setTextColor(0, 0, 0);
        });


        doc.save(`${quizTitle.replace(/\s+/g, "_")}_Report.pdf`);
        toast.success("Detailed Report Downloaded!");
        setDownloadingId(null);
    };

    if (loading) return <PremiumLoader text="Fetching your Results..." />;

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
                <BookOpen className="h-10 w-10 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Exam History</h1>
                    <p className="text-gray-500">View your past results and download answer keys.</p>
                </div>
            </div>

            {attempts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed text-gray-500">
                    You haven't attempted any quizzes yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {attempts.map((attempt) => {
                        const isCompleted = attempt.quiz.status === "COMPLETED";

                        return (
                            <Card key={attempt.id} className="hover:shadow-md transition-all">
                                <CardHeader className="pb-3 border-b bg-gray-50/50">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-bold text-gray-800 line-clamp-1">{attempt.quiz.title}</CardTitle>
                                        <Badge variant="outline" className={isCompleted ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"}>
                                            {attempt.quiz.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                        <Clock className="h-4 w-4" />
                                        {new Date(attempt.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-6 space-y-6">
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Total Score</p>
                                        <p className="text-4xl font-black text-blue-600">{attempt.score}</p>
                                    </div>

                                    {isCompleted ? (
                                        <Button
                                            onClick={() => handleDownloadPDF(attempt.quizId, attempt.quiz.title)}
                                            disabled={downloadingId === attempt.quizId}
                                            className="w-full gap-2 bg-gray-900 hover:bg-gray-800"
                                        >
                                            {downloadingId === attempt.quizId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            Download Detailed Result (PDF)
                                        </Button>
                                    ) : (
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3 items-start text-sm text-yellow-800">
                                            <Lock className="h-5 w-5 shrink-0 text-yellow-600" />
                                            <p>Answer key and PDF will be unlocked once the professor officially ends this test.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}