"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizForStudent, submitExam } from "@/actions/student";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, AlertTriangle, CheckCircle2, Maximize, Cloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PremiumLoader } from "@/components/ui/PremiumLoader";

export default function ExamRoom() {
    const params = useParams();
    const router = useRouter();
    const quizId = (params.quizId || params.quizid) as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Exam States
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examFinished, setExamFinished] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Anti-Cheat States
    const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
    const [isScreenBlurred, setIsScreenBlurred] = useState(false);
    const MAX_TAB_SWITCHES = 5;

    // Fetch Quiz & Hydrate from LocalStorage
    useEffect(() => {
        const fetchQuiz = async () => {
            const res = await getQuizForStudent(quizId);
            if (res.success && res.quiz) {
                setQuiz(res.quiz);

                // Hydrate from localStorage
                const savedState = localStorage.getItem(`exam_state_${quizId}`);
                if (savedState) {
                    try {
                        const parsed = JSON.parse(savedState);
                        setCurrentIndex(parsed.currentIndex ?? 0);
                        setAnswers(parsed.answers ?? {});
                        // Ensure time doesn't exceed full limit if bugged
                        setTimeLeft(parsed.timeLeft ?? res.quiz.questions[parsed.currentIndex ?? 0].timeLimit);
                    } catch (e) {
                        setTimeLeft(res.quiz.questions[0].timeLimit); // fallback
                    }
                } else {
                    setTimeLeft(res.quiz.questions[0].timeLimit); // first question timer
                }
            } else {
                toast.error(res.error);
                router.push("/student");
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId, router]);

    // Save state to LocalStorage continuously
    useEffect(() => {
        if (!loading && quiz && !examFinished && hasStarted) {
            setSaveStatus("saving");
            localStorage.setItem(`exam_state_${quizId}`, JSON.stringify({
                currentIndex,
                answers,
                timeLeft
            }));
            const t1 = setTimeout(() => setSaveStatus("saved"), 500);
            const t2 = setTimeout(() => setSaveStatus("idle"), 2000);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [currentIndex, answers, timeLeft, loading, quiz, examFinished, quizId, hasStarted]);

    // Anti-Cheat: Tab Switch Warning & Blur
    useEffect(() => {
        const handleCheatDetection = (customMessage?: string) => {
            if (examFinished || !quiz || !hasStarted) return;

            setIsScreenBlurred((prevBlurred) => {
                // If it's already blurred, don't increment strikes again
                if (!prevBlurred) {
                    setTabSwitchCount((prevCount) => {
                        const newCount = prevCount + 1;
                        if (newCount >= MAX_TAB_SWITCHES) {
                            toast.error("You violated exam rules too many times! Auto-submitting the exam.", { duration: 5000 });
                            handleSubmitExam(true); // Force Submit
                        } else {
                            toast.error(customMessage || `Warning: Do not switch tabs or lose focus!`, { icon: <AlertTriangle />, duration: 4000 });
                        }
                        return newCount;
                    });
                    return true; // Set blurred to true
                }
                return prevBlurred;
            });
        };

        const handleVisibilityChange = () => {
            if (document.hidden) handleCheatDetection();
        };

        const handleBlur = () => {
            handleCheatDetection();
        };

        const handleFocus = () => {};

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && hasStarted && !examFinished && !isScreenBlurred) {
                handleCheatDetection("You exited Full-Screen mode! This is a strict violation.");
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [examFinished, quiz, hasStarted, isScreenBlurred]);

    // Anti-Cheat: Block Copy/Paste/Right-Click
    useEffect(() => {
        const blockRightClick = (e: MouseEvent) => e.preventDefault();
        const blockKeyboardCopy = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'p')) {
                e.preventDefault();
                toast.error("Copy-Paste is disabled during the exam!");
            }
        };

        document.addEventListener("contextmenu", blockRightClick);
        document.addEventListener("keydown", blockKeyboardCopy);

        return () => {
            document.removeEventListener("contextmenu", blockRightClick);
            document.removeEventListener("keydown", blockKeyboardCopy);
        };
    }, []);

    // Timer Logic
    useEffect(() => {
        if (loading || examFinished || !quiz || !hasStarted) return;

        // If time is up, handle the transition synchronously
        if (timeLeft <= 0) {
            if (currentIndex < quiz.questions.length - 1) {
                // Time out for current question
                setCurrentIndex(currentIndex + 1);
                setTimeLeft(quiz.questions[currentIndex + 1].timeLimit);
            } else {
                // Last question time out
                setExamFinished(true);
                handleSubmitExam(true);
            }
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [loading, examFinished, timeLeft, currentIndex, quiz]);

    const handleNextQuestion = () => {
        if (!quiz) return;
        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setTimeLeft(quiz.questions[currentIndex + 1].timeLimit); // Reset timer for new question
        } else {
            handleSubmitExam(); // Manual submit check
        }
    };

    const handleAnswerChange = (questionId: string, value: any, type: string) => {
        setAnswers((prev) => {
            if (type === "MULTI_CORRECT") {
                const currentArr = prev[questionId] || [];
                if (currentArr.includes(value)) return { ...prev, [questionId]: currentArr.filter((id: string) => id !== value) };
                else return { ...prev, [questionId]: [...currentArr, value] };
            }
            return { ...prev, [questionId]: value }; // For Single Correct & Text
        });
    };

    const handleSubmitExam = async (isAutoSubmit: boolean = false) => {
        if (!isAutoSubmit && !confirm("Are you sure you want to submit the exam?")) return;
        setIsSubmitting(true);
        setExamFinished(true);

        const answersString = JSON.stringify(answers);
        const res = await submitExam(quizId, answersString);
        if (res.success) {
            // Clean up exact storage key after success submit
            localStorage.removeItem(`exam_state_${quizId}`);
            toast.success(isAutoSubmit ? `Auto-Submitted! Score: ${res.score}` : `Exam Submitted Successfully! Score: ${res.score}`);
            setTimeout(() => router.push("/student/history"), 2000); // Redirect to marks page
        } else {
            toast.error(res.error);
            setIsSubmitting(false);
            setExamFinished(false);
        }
    };

    if (loading) return <PremiumLoader text="Preparing your Exam Room..." />;
    if (!quiz || !quiz.questions[currentIndex]) return null;

    const currentQ = quiz.questions[currentIndex];
    const isLastQuestion = currentIndex >= quiz.questions.length - 1;

    // Format time (MM:SS)
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div
            className="min-h-screen bg-gray-50 flex flex-col select-none relative"
            onCopy={(e) => { e.preventDefault(); toast.error("Copy disabled!"); }}
            onPaste={(e) => { e.preventDefault(); toast.error("Paste disabled!"); }}
            onCut={(e) => { e.preventDefault(); toast.error("Cut disabled!"); }}
        >

            {/* Pre-Exam Kiosk Mode Starter */}
            {!hasStarted && !examFinished && (
                <div className="absolute inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 text-center">
                    <Maximize className="h-16 w-16 text-blue-600 mb-6" />
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Ready to Begin?</h2>
                    <p className="text-gray-600 max-w-md mb-8">
                        The exam takes place in strict full-screen mode. Do not exit full-screen, switch tabs, or open other applications during the test.
                    </p>
                    <Button 
                        size="lg" 
                        className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 rounded-full"
                        onClick={() => {
                            document.documentElement.requestFullscreen().catch((err) => {
                                console.warn("Fullscreen error: ", err);
                            });
                            setHasStarted(true);
                        }}
                    >
                        Enter Full-Screen & Start
                    </Button>
                </div>
            )}

            {/* Anti-cheat overlay (when tab loses focus) */}
            {isScreenBlurred && !examFinished && (
                <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-md">
                    <AlertTriangle className="h-16 w-16 text-red-500 mb-4 animate-bounce" />
                    <h2 className="text-3xl font-bold text-white mb-2">Focus Lost!</h2>
                    <p className="text-gray-300 max-w-md">
                        Please click anywhere on this screen to resume the exam. Switching tabs or exiting full-screen is strictly prohibited.
                    </p>
                    <Button onClick={() => {
                        document.documentElement.requestFullscreen().catch(() => {});
                        setIsScreenBlurred(false);
                    }} className="mt-8 bg-white text-black hover:bg-gray-200">
                        Resume Exam
                    </Button>
                </div>
            )}

            {/* Top Bar (Sticky) */}
            <header className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 md:px-8 py-3 flex flex-wrap justify-between items-center gap-4">
                <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center gap-3">
                        <h1 className="font-bold text-gray-900 truncate">{quiz.title}</h1>
                        {/* Auto-Save Indicator */}
                        {saveStatus === "saving" && <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</span>}
                        {saveStatus === "saved" && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Cloud className="h-3 w-3" /> Saved</span>}
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-1">Question {currentIndex + 1} of {quiz.questions.length}</p>
                </div>

                {/* Timer UI */}
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-lg font-bold border-2 ${timeLeft <= 10 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                    <Timer className="h-5 w-5" /> {formatTime(timeLeft)}
                </div>
            </header>

            {/* Main Exam Area */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col">

                {/* Question Card */}
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

                        {/* Options Area */}
                        <div className="mt-8 space-y-3 flex-1">

                            {/* Single Correct */}
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

                            {/* Multi Correct */}
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

                            {/* Fill in Blank / Integer */}
                            {(currentQ.type === "FILL_IN_BLANK" || currentQ.type === "INTEGER_TYPE") && (
                                <Input
                                    type={currentQ.type === "INTEGER_TYPE" ? "number" : "text"}
                                    placeholder="Type your exact answer here..."
                                    value={answers[currentQ.id] || ""}
                                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, currentQ.type)}
                                    className="h-14 text-lg border-2 focus-visible:ring-blue-500"
                                />
                            )}

                            {/* Descriptive */}
                            {currentQ.type === "DESCRIPTIVE" && (
                                <Textarea
                                    placeholder="Write your detailed answer here..."
                                    value={answers[currentQ.id] || ""}
                                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, currentQ.type)}
                                    className="min-h-[200px] text-base border-2 focus-visible:ring-blue-500"
                                    onPaste={(e) => {
                                        // Specific block for textareas just in case
                                        e.preventDefault();
                                        toast.error("Pasting is not allowed. Please type your answer.");
                                    }}
                                />
                            )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="mt-8 flex flex-wrap justify-between items-center gap-4 pt-6 border-t">
                            <Button
                                variant="outline"
                                onClick={() => handleAnswerChange(currentQ.id, null, currentQ.type)}
                                className="text-gray-500 w-full sm:w-auto"
                            >
                                Clear Answer
                            </Button>

                            {!isLastQuestion ? (
                                <Button onClick={handleNextQuestion} className="bg-blue-600 hover:bg-blue-700 px-8 text-lg h-12 w-full sm:w-auto">
                                    Save & Next
                                </Button>
                            ) : (
                                <Button onClick={() => handleSubmitExam()} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 px-8 text-lg h-12 gap-2 w-full sm:w-auto">
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