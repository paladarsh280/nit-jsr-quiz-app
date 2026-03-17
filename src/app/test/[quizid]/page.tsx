"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizForStudent, submitExam, submitLiveAnswer } from "@/actions/student";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, CheckCircle2, Maximize, Cloud, Hourglass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PremiumLoader } from "@/components/ui/PremiumLoader";

export default function ExamRoom() {
    const params = useParams();
    const router = useRouter();
    const quizId = (params.quizId || params.quizid) as string;

    const [quiz, setQuiz] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [loading, setLoading] = useState(true);

    // Exam States
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examFinished, setExamFinished] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // LIVE_GUIDED specific states
    const [liveAnswerSubmitted, setLiveAnswerSubmitted] = useState(false);
    const [liveAnswerResult, setLiveAnswerResult] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [waitingForProfessor, setWaitingForProfessor] = useState(false);
    const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now());

    // Stable ref for handleSubmitExam to avoid useEffect dependency issues
    const handleSubmitExamRef = useRef<((isAutoSubmit?: boolean) => Promise<void>) | undefined>(undefined);

    const isLiveGuided = (quiz as any)?.quizMode === "LIVE_GUIDED";

    // Fetch Quiz & Hydrate from LocalStorage
    useEffect(() => {
        const fetchQuiz = async () => {
            const res = await getQuizForStudent(quizId);
            if (res.success && res.quiz) {
                setQuiz(res.quiz);

                if (res.quiz.quizMode === "LIVE_GUIDED") {
                    setCurrentIndex((res.quiz as any).activeQuestionIndex);
                    setTimeLeft(res.quiz.questions[(res.quiz as any).activeQuestionIndex]?.timeLimit || 30);
                    setQuestionStartTime(Date.now());
                    const savedState = localStorage.getItem(`exam_state_${quizId}`);
                    if (savedState) {
                        try { setAnswers(JSON.parse(savedState).answers || {}); } catch { /* ignore */ }
                    }
                } else {
                    const savedState = localStorage.getItem(`exam_state_${quizId}`);
                    if (savedState) {
                        try {
                            const parsed = JSON.parse(savedState);
                            setCurrentIndex(parsed.currentIndex ?? 0);
                            setAnswers(parsed.answers ?? {});
                            setTimeLeft((parsed.timeLeft ?? res.quiz.questions[parsed.currentIndex ?? 0]?.timeLimit) || 60);
                        } catch {
                            setTimeLeft(res.quiz.questions[0]?.timeLimit || 60); 
                        }
                    } else {
                        setTimeLeft(res.quiz.questions[0]?.timeLimit || 60); 
                    }
                }
            } else {
                toast.error(res.error);
                router.push("/student");
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId, router]);

    // Polling for LIVE_GUIDED mode — sync with professor
    useEffect(() => {
        if (!quiz || !isLiveGuided || examFinished) return;
        
        const interval = setInterval(async () => {
            const res = await getQuizForStudent(quizId);
            if (res.success && res.quiz) {
                const newQuiz = res.quiz;
                
                // Check if professor advanced to next question
                if ((newQuiz as any).activeQuestionIndex > currentIndex) {
                    setCurrentIndex((newQuiz as any).activeQuestionIndex);
                    setTimeLeft(newQuiz.questions[(newQuiz as any).activeQuestionIndex]?.timeLimit || 30);
                    setLiveAnswerSubmitted(false);
                    setLiveAnswerResult(null);
                    setWaitingForProfessor(false);
                    setQuestionStartTime(Date.now());
                }
                
                // Check if quiz ended
                if (newQuiz.status === "COMPLETED" && !examFinished) {
                    toast.info("The Professor has ended the quiz. Redirecting...");
                    setExamFinished(true);
                    localStorage.removeItem(`exam_state_${quizId}`);
                    setTimeout(() => router.push("/student/history"), 2000);
                }

                setQuiz(newQuiz);
            }
        }, 2000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId, currentIndex, examFinished, isLiveGuided]);

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

    // Timer Logic
    useEffect(() => {
        if (loading || examFinished || !quiz || !hasStarted) return;

        if (timeLeft <= 0) {
            if (isLiveGuided) {
                // In live guided, when time's up, mark as waiting
                if (!liveAnswerSubmitted) {
                    // Time ran out without answering
                    setWaitingForProfessor(true);
                }
                return;
            }

            if (currentIndex < quiz.questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setTimeLeft(quiz.questions[currentIndex + 1]?.timeLimit || 60);
            } else {
                setExamFinished(true);
                handleSubmitExamRef.current?.(true);
            }
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [loading, examFinished, timeLeft, currentIndex, quiz, hasStarted, isLiveGuided, liveAnswerSubmitted]);

    const handleNextQuestion = () => {
        if (!quiz) return;
        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setTimeLeft(quiz.questions[currentIndex + 1]?.timeLimit || 60);
        } else {
            handleSubmitExam();
        }
    };

    const handleAnswerChange = (questionId: string, value: any, type: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        setAnswers((prev) => {
            if (type === "MULTI_CORRECT") {
                const currentArr = prev[questionId] || [];
                if (currentArr.includes(value)) return { ...prev, [questionId]: currentArr.filter((id: string) => id !== value) };
                else return { ...prev, [questionId]: [...currentArr, value] };
            }
            return { ...prev, [questionId]: value };
        });
    };

    // LIVE_GUIDED: Submit single answer immediately
    const handleLiveAnswerSubmit = async (questionId: string, value: any, type: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (liveAnswerSubmitted) return; // Already submitted

        const timeTaken = Math.round((new Date().getTime() - questionStartTime) / 1000);
        setLiveAnswerSubmitted(true);

        let answerValue = value;
        if (type === "MULTI_CORRECT") {
            answerValue = JSON.stringify(value);
        } else {
            answerValue = String(value);
        }

        const res = await submitLiveAnswer(quizId, questionId, answerValue, type, timeTaken);
        if (res.success) {
            setLiveAnswerResult(res);
            toast.success(res.isCorrect ? `✅ Correct! +${res.marksAwarded} pts` : `❌ Wrong! ${res.marksAwarded} pts`);
        } else {
            toast.error(res.error || "Failed to submit answer");
            setLiveAnswerSubmitted(false);
        }
    };

    const handleSubmitExam = async (isAutoSubmit: boolean = false) => {
        if (!isAutoSubmit && !confirm("Are you sure you want to submit the exam?")) return;
        setIsSubmitting(true);
        setExamFinished(true);

        const answersString = JSON.stringify(answers);
        const res = await submitExam(quizId, answersString);
        if (res.success) {
            localStorage.removeItem(`exam_state_${quizId}`);
            toast.success(isAutoSubmit ? `Auto-Submitted! Score: ${res.score}` : `Exam Submitted Successfully! Score: ${res.score}`);
            setTimeout(() => router.push("/student/history"), 2000);
        } else {
            toast.error(res.error);
            setIsSubmitting(false);
            setExamFinished(false);
        }
    };

    // Keep ref updated
    handleSubmitExamRef.current = handleSubmitExam;

    if (loading) return <PremiumLoader text="Preparing your Exam Room..." />;
    if (!quiz || !quiz.questions[currentIndex]) return null;

    const currentQ = quiz.questions[currentIndex];
    const isLastQuestion = currentIndex >= quiz.questions.length - 1;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Calculate timer progress for circular animation
    // const timerProgress = currentQ ? (timeLeft / currentQ.timeLimit) * 100 : 100;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col relative">

            {/* Exam Starter */}
            {!hasStarted && !examFinished && (
                <div className="absolute inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 text-center">
                    <Maximize className="h-16 w-16 text-blue-600 mb-6" />
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Ready to Begin?</h2>
                    <p className="text-gray-600 max-w-md mb-4">
                        {isLiveGuided 
                            ? "This is a Live Quiz! Questions will appear one at a time as the professor presents them."
                            : "The timer will start as soon as you begin the exam. Good luck!"
                        }
                    </p>
                    {isLiveGuided && (
                        <Badge className="mb-6 bg-purple-100 text-purple-700 text-base px-4 py-2">
                            📡 Live Guided Mode — Speed matters!
                        </Badge>
                    )}
                    <Button 
                        size="lg" 
                        className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 rounded-full"
                        onClick={() => {
                            setHasStarted(true);
                            setQuestionStartTime(Date.now());
                        }}
                    >
                        {isLiveGuided ? "Join Live Quiz" : "Start Exam"}
                    </Button>
                </div>
            )}

            {/* LIVE_GUIDED: Waiting for Professor Screen */}
            {isLiveGuided && hasStarted && (liveAnswerSubmitted || waitingForProfessor) && !examFinished && (
                <div className="absolute inset-0 z-[150] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    {liveAnswerResult ? (
                        <>
                            <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-6 ${liveAnswerResult.isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                {liveAnswerResult.isCorrect 
                                    ? <CheckCircle2 className="h-10 w-10 text-green-600" />
                                    : <span className="text-4xl">❌</span>
                                }
                            </div>
                            <h2 className="text-3xl font-bold mb-2">
                                {liveAnswerResult.isCorrect ? "Correct!" : "Wrong!"}
                            </h2>
                            <p className={`text-2xl font-bold ${liveAnswerResult.marksAwarded >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liveAnswerResult.marksAwarded >= 0 ? '+' : ''}{liveAnswerResult.marksAwarded} Points
                            </p>
                        </>
                    ) : (
                        <>
                            <Hourglass className="h-16 w-16 text-amber-500 mb-6 animate-pulse" />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Time&apos;s Up!</h2>
                        </>
                    )}
                    <div className="mt-8 flex items-center gap-3 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-lg">Waiting for professor to show next question...</span>
                    </div>
                </div>
            )}

            {/* Top Bar (Sticky) */}
            <header className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 md:px-8 py-3 flex flex-wrap justify-between items-center gap-4">
                <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center gap-3">
                        <h1 className="font-bold text-gray-900 truncate">{quiz.title}</h1>
                        {isLiveGuided && <Badge className="bg-purple-100 text-purple-700 text-xs">LIVE</Badge>}
                        {saveStatus === "saving" && <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</span>}
                        {saveStatus === "saved" && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Cloud className="h-3 w-3" /> Saved</span>}
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-1">Question {currentIndex + 1} of {quiz.questions.length}</p>
                </div>

                {/* Timer UI */}
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-lg font-bold border-2 transition-all ${
                    timeLeft <= 5 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse scale-105' : 
                    timeLeft <= 10 ? 'bg-red-50 text-red-600 border-red-200' : 
                    'bg-blue-50 text-blue-700 border-blue-200'
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
                            {isLiveGuided && <Badge variant="outline" className="text-purple-600 border-purple-200">⚡ Speed Bonus</Badge>}
                        </div>

                        <h2 className="text-xl md:text-2xl font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {currentQ.text}
                        </h2>

                        {currentQ.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={currentQ.imageUrl} alt="Question Reference" className="mt-4 max-h-64 object-contain rounded-lg border bg-gray-50 p-2" />
                        )}

                        {/* Options Area */}
                        <div className="mt-8 space-y-3 flex-1">

                            {/* Single Correct */}
                            {currentQ.type === "SINGLE_CORRECT" && currentQ.options.map((opt: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <div
                                    key={opt.id}
                                    onClick={() => {
                                        if (isLiveGuided && liveAnswerSubmitted) return;
                                        handleAnswerChange(currentQ.id, opt.id, "SINGLE_CORRECT");
                                        if (isLiveGuided) {
                                            handleLiveAnswerSubmit(currentQ.id, opt.id, "SINGLE_CORRECT");
                                        }
                                    }}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        answers[currentQ.id] === opt.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                    } ${isLiveGuided && liveAnswerSubmitted ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${answers[currentQ.id] === opt.id ? "border-blue-600" : "border-gray-400"}`}>
                                        {answers[currentQ.id] === opt.id && <div className="h-2.5 w-2.5 bg-blue-600 rounded-full" />}
                                    </div>
                                    <span className="text-gray-800 text-lg">{opt.text}</span>
                                </div>
                            ))}

                            {/* Multi Correct */}
                            {currentQ.type === "MULTI_CORRECT" && currentQ.options.map((opt: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <div
                                    key={opt.id}
                                    onClick={() => {
                                        if (isLiveGuided && liveAnswerSubmitted) return;
                                        handleAnswerChange(currentQ.id, opt.id, "MULTI_CORRECT");
                                    }}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        (answers[currentQ.id] || []).includes(opt.id) ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                    } ${isLiveGuided && liveAnswerSubmitted ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                                        (answers[currentQ.id] || []).includes(opt.id) ? "border-blue-600 bg-blue-600" : "border-gray-400"
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
                                    disabled={isLiveGuided && liveAnswerSubmitted}
                                />
                            )}

                            {/* Descriptive */}
                            {currentQ.type === "DESCRIPTIVE" && (
                                <Textarea
                                    placeholder="Write your detailed answer here..."
                                    value={answers[currentQ.id] || ""}
                                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, currentQ.type)}
                                    className="min-h-[200px] text-base border-2 focus-visible:ring-blue-500"
                                    disabled={isLiveGuided && liveAnswerSubmitted}
                                />
                            )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="mt-8 flex flex-wrap justify-between items-center gap-4 pt-6 border-t">
                            <Button
                                variant="outline"
                                onClick={() => handleAnswerChange(currentQ.id, null, currentQ.type)}
                                className="text-gray-500 w-full sm:w-auto"
                                disabled={isLiveGuided && liveAnswerSubmitted}
                            >
                                Clear Answer
                            </Button>

                            {/* NORMAL MODE: Save & Next / Submit */}
                            {!isLiveGuided && (
                                !isLastQuestion ? (
                                    <Button onClick={handleNextQuestion} className="bg-blue-600 hover:bg-blue-700 px-8 text-lg h-12 w-full sm:w-auto">
                                        Save & Next
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleSubmitExam()} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 px-8 text-lg h-12 gap-2 w-full sm:w-auto">
                                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                        Submit Exam
                                    </Button>
                                )
                            )}
                            
                            {/* LIVE GUIDED MODE: Submit answer button for non-MCQ types */}
                            {isLiveGuided && !liveAnswerSubmitted && (currentQ.type === "MULTI_CORRECT" || currentQ.type === "FILL_IN_BLANK" || currentQ.type === "INTEGER_TYPE" || currentQ.type === "DESCRIPTIVE") && (
                                <Button 
                                    onClick={() => {
                                        const value = currentQ.type === "MULTI_CORRECT" ? (answers[currentQ.id] || []) : answers[currentQ.id];
                                        if (!value || (Array.isArray(value) && value.length === 0)) {
                                            toast.error("Please select/type an answer first!");
                                            return;
                                        }
                                        handleLiveAnswerSubmit(currentQ.id, value, currentQ.type);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 px-8 text-lg h-12 gap-2 w-full sm:w-auto"
                                >
                                    <CheckCircle2 className="h-5 w-5" /> Lock Answer
                                </Button>
                            )}

                            {isLiveGuided && liveAnswerSubmitted && (
                                <div className="text-green-600 font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5" /> Answer Locked!
                                </div>
                            )}

                            {isLiveGuided && !liveAnswerSubmitted && currentQ.type === "SINGLE_CORRECT" && (
                                <div className="text-gray-500 italic text-sm font-medium">
                                    Tap an option to submit instantly
                                </div>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </main>
        </div>
    );
}