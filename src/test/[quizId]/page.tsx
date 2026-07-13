"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizForStudent, submitExam } from "@/actions/student";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ExamRoom() {
    const params = useParams();
    const router = useRouter();
    const quizId = (params.quizId || params.quizid) as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);


    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examFinished, setExamFinished] = useState(false);

    useEffect(() => {
        const fetchQuiz = async () => {
            const res = await getQuizForStudent(quizId);

            if (res.success && res.quiz) {
                setQuiz(res.quiz);
                setTimeLeft(res.quiz.questions[0].timeLimit);
            } else {
                toast.error(res.error || "Failed to load quiz");
                router.push("/student");
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId, router]);


    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && !examFinished && quiz) {
                toast.error("Warning: Please do not switch tabs during the exam!", { icon: <AlertTriangle /> });
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [examFinished, quiz]);


    useEffect(() => {
        if (loading || examFinished || !quiz) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleNextQuestion();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [loading, examFinished, currentIndex, quiz]);

    const handleNextQuestion = () => {
        if (!quiz) return;
        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setTimeLeft(quiz.questions[currentIndex + 1].timeLimit);
        } else {
            handleSubmitExam();
        }
    };

    const handleAnswerChange = (questionId: string, value: any, type: string) => {
        setAnswers((prev) => {
            if (type === "MULTI_CORRECT") {
                const currentArr = prev[questionId] || [];
                if (currentArr.includes(value)) return { ...prev, [questionId]: currentArr.filter((id: string) => id !== value) };
                else return { ...prev, [questionId]: [...currentArr, value] };
            }
            return { ...prev, [questionId]: value };
        });
    };

    const handleSubmitExam = async () => {
        if (!confirm("Are you sure you want to submit the exam?")) return;
        setIsSubmitting(true);
        setExamFinished(true);

        try {

            const answersString = JSON.stringify(answers);

            const res = await submitExam(quiz.id, answersString);

            if (res.success) {
                toast.success(`Exam Submitted Successfully! Score: ${res.score}`);
                setTimeout(() => router.push("/student"), 2000);
            } else {
                toast.error(res.error);
                setIsSubmitting(false);
                setExamFinished(false);
            }
        } catch (err) {
            console.error("Submission Crash:", err);
            toast.error("Network error while submitting.");
            setIsSubmitting(false);
            setExamFinished(false);
        }
    };
    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>;
    if (!quiz) return null;

    const currentQ = quiz.questions[currentIndex];
    const isLastQuestion = currentIndex === quiz.questions.length - 1;


    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">


            <header className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 md:px-8 py-3 flex justify-between items-center">
                <div>
                    <h1 className="font-bold text-gray-900 truncate max-w-[200px] md:max-w-md">{quiz.title}</h1>
                    <p className="text-xs text-gray-500 font-medium">Question {currentIndex + 1} of {quiz.questions.length}</p>
                </div>


                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-lg font-bold border-2 ${timeLeft <= 10 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                    <Timer className="h-5 w-5" /> {formatTime(timeLeft)}
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col">


                <Card className="shadow-md border-t-4 border-t-blue-600 flex-1">
                    <CardContent className="p-6 md:p-8 flex flex-col h-full">

                        <div className="flex gap-2 mb-4">
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">Q. {currentIndex + 1}</Badge>
                            <Badge variant="outline" className="text-green-600 border-green-200">+{currentQ.marks} Marks</Badge>
                            {currentQ.negative > 0 && <Badge variant="outline" className="text-red-500 border-red-200">-{currentQ.negative} Negative</Badge>}
                        </div>

                        <h2 className="text-xl md:text-2xl font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {currentQ.text}
                        </h2>

                        {currentQ.imageUrl && (
                            <img src={currentQ.imageUrl} alt="Question Reference" className="mt-4 max-h-64 object-contain rounded-lg border bg-gray-50 p-2" />
                        )}


                        <div className="mt-8 space-y-3 flex-1">


                            {currentQ.type === "SINGLE_CORRECT" && currentQ.options.map((opt: any) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleAnswerChange(currentQ.id, opt.id, "SINGLE_CORRECT")}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[currentQ.id] === opt.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                        }`}
                                >
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${answers[currentQ.id] === opt.id ? "border-blue-600" : "border-gray-400"}`}>
                                        {answers[currentQ.id] === opt.id && <div className="h-2.5 w-2.5 bg-blue-600 rounded-full" />}
                                    </div>
                                    <span className="text-gray-800 text-lg">{opt.text}</span>
                                </div>
                            ))}


                            {currentQ.type === "MULTI_CORRECT" && currentQ.options.map((opt: any) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleAnswerChange(currentQ.id, opt.id, "MULTI_CORRECT")}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${(answers[currentQ.id] || []).includes(opt.id) ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                        }`}
                                >
                                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${(answers[currentQ.id] || []).includes(opt.id) ? "border-blue-600 bg-blue-600" : "border-gray-400"
                                        }`}>
                                        {(answers[currentQ.id] || []).includes(opt.id) && <CheckCircle2 className="h-4 w-4 text-white" />}
                                    </div>
                                    <span className="text-gray-800 text-lg">{opt.text}</span>
                                </div>
                            ))}


                            {(currentQ.type === "FILL_IN_BLANK" || currentQ.type === "INTEGER_TYPE") && (
                                <Input
                                    type={currentQ.type === "INTEGER_TYPE" ? "number" : "text"}
                                    placeholder="Type your exact answer here..."
                                    value={answers[currentQ.id] || ""}
                                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, currentQ.type)}
                                    className="h-14 text-lg border-2 focus-visible:ring-blue-500"
                                />
                            )}


                            {currentQ.type === "DESCRIPTIVE" && (
                                <Textarea
                                    placeholder="Write your detailed answer here..."
                                    value={answers[currentQ.id] || ""}
                                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, currentQ.type)}
                                    className="min-h-[200px] text-base border-2 focus-visible:ring-blue-500"
                                />
                            )}
                        </div>

                        <div className="mt-8 flex justify-between items-center pt-6 border-t">
                            <Button
                                variant="outline"
                                onClick={() => handleAnswerChange(currentQ.id, null, currentQ.type)}
                                className="text-gray-500"
                            >
                                Clear Answer
                            </Button>

                            {!isLastQuestion ? (
                                <Button onClick={handleNextQuestion} className="bg-blue-600 hover:bg-blue-700 px-8 text-lg h-12">
                                    Save & Next
                                </Button>
                            ) : (
                                <Button onClick={handleSubmitExam} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 px-8 text-lg h-12 gap-2">
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                    Submit Exam
                                </Button>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
