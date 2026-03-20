"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizForStudent, submitExam, submitLiveAnswer, getLiveLeaderboardForStudent } from "@/actions/student";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, CheckCircle2, Maximize, Cloud, Hourglass, Trophy, Medal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PremiumLoader } from "@/components/ui/PremiumLoader";
import { supabase } from "@/lib/supabase";

// 🔥 Safe UTC timestamp helper: handles both Date objects (from Prisma/server actions)
// and raw strings from Supabase Realtime payloads (which often lack the 'Z' suffix).
function toUTCMs(val: Date | string | unknown): number {
    if (val instanceof Date) return val.getTime();
    const s = String(val);
    // If already has timezone info (Z or ±HH:MM), parse as-is. Otherwise append Z.
    return new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z').getTime();
}

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
    const [waitingForProfessor, setWaitingForProfessor] = useState(false); // TRUE when timer is up
    const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now());
    const [liveLeaderboard, setLiveLeaderboard] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [leaderboardAnimStage, setLeaderboardAnimStage] = useState(0);

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
                    
                    // Sync timer using the server's updatedAt timestamp (UTC-safe)
                    const elapsedSec = Math.floor((Date.now() - toUTCMs(res.quiz.updatedAt)) / 1000);
                    const calculatedTimeLeft = Math.max(0, (res.quiz.questions[(res.quiz as any).activeQuestionIndex]?.timeLimit || 30) - elapsedSec);
                    setTimeLeft(calculatedTimeLeft);
                    
                    setQuestionStartTime(Date.now());
                    const savedState = localStorage.getItem(`exam_state_${quizId}`);
                    if (savedState) {
                        try { 
                            const parsed = JSON.parse(savedState);
                            setAnswers(parsed.answers || {}); 
                            if (parsed.liveAnswerSubmitted) setLiveAnswerSubmitted(parsed.liveAnswerSubmitted);
                            if (parsed.liveAnswerResult) setLiveAnswerResult(parsed.liveAnswerResult);
                            if (parsed.questionStartTime) setQuestionStartTime(parsed.questionStartTime);
                        } catch { /* ignore */ }
                    }
                    
                    // 🔥 FIX: Don't set waitingForProfessor on initial load (student hasn't even clicked Start yet)
                    // The timer useEffect will handle this after student clicks "Join Live Quiz"
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

    // Refs for volatile values used inside Realtime callback (avoids stale closures without causing re-subscriptions)
    const currentIndexRef = useRef(currentIndex);
    const waitingForProfessorRef = useRef(waitingForProfessor);
    const timeLeftRef = useRef(timeLeft);
    const quizRef = useRef(quiz);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { waitingForProfessorRef.current = waitingForProfessor; }, [waitingForProfessor]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
    useEffect(() => { quizRef.current = quiz; }, [quiz]);

    // WebSockets via Supabase Realtime
    // 🔥 FIX: Only depend on stable values (quizId, examFinished, isLiveGuided)
    // We use refs for volatile state so the channel doesn't rebuild every second
    useEffect(() => {
        if (!quiz || !isLiveGuided || examFinished) return;
        
        const channel = supabase
            .channel(`quiz_changes_${quizId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Quiz',
                    filter: `id=eq.${quizId}`
                },
                (payload) => {
                    const newQuiz = payload.new;
                    const latestIndex = currentIndexRef.current;
                    const latestWaiting = waitingForProfessorRef.current;
                    const latestTimeLeft = timeLeftRef.current;
                    const latestQuiz = quizRef.current;
                    
                    // Check if professor advanced to next question
                    if (newQuiz.activeQuestionIndex > latestIndex) {
                        setCurrentIndex(newQuiz.activeQuestionIndex);
                        setLiveAnswerSubmitted(false);
                        setLiveAnswerResult(null);
                        setWaitingForProfessor(false);
                        setLiveLeaderboard(null);
                        setLeaderboardAnimStage(0);
                        setQuestionStartTime(Date.now());
                        
                        // Professor advanced — sync up
                        const elapsedSec = Math.floor((Date.now() - toUTCMs(newQuiz.updatedAt)) / 1000);
                        const newTimeLimit = latestQuiz?.questions[newQuiz.activeQuestionIndex]?.timeLimit || 30;
                        const calculatedTimeLeft = Math.max(1, newTimeLimit - elapsedSec);
                        setTimeLeft(calculatedTimeLeft);
                    } else if (!latestWaiting) {
                        // Tight sync for late joiners
                        const elapsedSec = Math.floor((Date.now() - toUTCMs(newQuiz.updatedAt)) / 1000);
                        const newTimeLimit = latestQuiz?.questions[newQuiz.activeQuestionIndex]?.timeLimit || 30;
                        const calculatedTimeLeft = Math.max(0, newTimeLimit - elapsedSec);
                        if (Math.abs(latestTimeLeft - calculatedTimeLeft) > 2) {
                            setTimeLeft(calculatedTimeLeft);
                        }
                    }
                    
                    // Check if quiz ended
                    if (newQuiz.status === "COMPLETED") {
                        toast.info("The Professor has ended the quiz.");
                        setExamFinished(true);
                        localStorage.removeItem(`exam_state_${quizId}`);
                        setTimeout(() => router.push("/student"), 2000);
                    }

                    setQuiz((prev: any) => ({ ...prev, ...newQuiz }));
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime connected for Quiz', quizId);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Realtime channel error for Quiz', quizId);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId, examFinished, isLiveGuided]);

    // POLLING FALLBACK: Poll every 3 seconds once the student has started the quiz.
    // This catches: professor ending quiz while timer is still running (Realtime miss)
    // and professor advancing question while student is in "waiting" state.
    useEffect(() => {
        if (!isLiveGuided || !hasStarted || examFinished) return;

        const poll = async () => {
            const res = await getQuizForStudent(quizId);
            if (!res.success || !res.quiz) {
                // Only redirect if the quiz is definitively gone (COMPLETED/not found).
                // Do NOT redirect on transient errors to avoid kicking students out.
                if (res.error === "Quiz not available or ended.") {
                    toast.info("The Professor has ended the quiz.");
                    setExamFinished(true);
                    localStorage.removeItem(`exam_state_${quizId}`);
                    setTimeout(() => router.push("/student"), 2000);
                }
                // All other errors (network, auth) are silently ignored — next poll will retry
                return;
            }
            const fetchedQuiz = res.quiz as any; // eslint-disable-line @typescript-eslint/no-explicit-any

            if (fetchedQuiz.status === "COMPLETED") {
                toast.info("The Professor has ended the quiz.");
                setExamFinished(true);
                localStorage.removeItem(`exam_state_${quizId}`);
                setTimeout(() => router.push("/student"), 2000);
                return;
            }

            if (fetchedQuiz.activeQuestionIndex > currentIndexRef.current) {
                const newIndex = fetchedQuiz.activeQuestionIndex;
                const elapsedSec = Math.floor((Date.now() - toUTCMs(fetchedQuiz.updatedAt)) / 1000);
                const newTimeLimit = fetchedQuiz.questions[newIndex]?.timeLimit || 30;
                const calculatedTimeLeft = Math.max(1, newTimeLimit - elapsedSec);

                setQuiz(fetchedQuiz);
                setCurrentIndex(newIndex);
                setLiveAnswerSubmitted(false);
                setLiveAnswerResult(null);
                setWaitingForProfessor(false);
                setLiveLeaderboard(null);
                setLeaderboardAnimStage(0);
                setQuestionStartTime(Date.now());
                setTimeLeft(calculatedTimeLeft);
                toast.success(`Question ${newIndex + 1} is live!`);
            }
        };

        const interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId, isLiveGuided, hasStarted, examFinished]);

    // Save state to LocalStorage continuously
    useEffect(() => {
        if (!loading && quiz && !examFinished && hasStarted) {
            setSaveStatus("saving");
            localStorage.setItem(`exam_state_${quizId}`, JSON.stringify({
                currentIndex,
                answers,
                timeLeft,
                liveAnswerSubmitted,
                liveAnswerResult,
                questionStartTime
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
                if (!waitingForProfessor) {
                    setWaitingForProfessor(true);
                    // Fetch leaderboard when time is up
                    getLiveLeaderboardForStudent(quizId).then(res => {
                        if (res.success) {
                            setLiveLeaderboard(res);
                            // Start staggered animation
                            setLeaderboardAnimStage(0);
                            setTimeout(() => setLeaderboardAnimStage(1), 400);   // 3rd place
                            setTimeout(() => setLeaderboardAnimStage(2), 900);   // 2nd place
                            setTimeout(() => setLeaderboardAnimStage(3), 1400);  // 1st place
                            setTimeout(() => setLeaderboardAnimStage(4), 2200);  // Full list
                        }
                    });
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
            toast.success("Answer locked successfully!");
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
            {isLiveGuided && hasStarted && waitingForProfessor && !examFinished && (
                <div className="absolute inset-0 z-[150] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                    
                    {liveAnswerResult ? (
                        <>
                            <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-6 shadow-lg ${liveAnswerResult.isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                {liveAnswerResult.isCorrect 
                                    ? <CheckCircle2 className="h-10 w-10 text-green-600" />
                                    : <span className="text-4xl">❌</span>
                                }
                            </div>
                            <h2 className="text-3xl font-bold mb-2">
                                {liveAnswerResult.isCorrect ? "Correct!" : "Wrong!"}
                            </h2>
                            <p className={`text-2xl font-bold mb-8 ${liveAnswerResult.marksAwarded >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liveAnswerResult.marksAwarded >= 0 ? '+' : ''}{liveAnswerResult.marksAwarded} Points
                            </p>
                        </>
                    ) : (
                        <>
                            <Hourglass className="h-16 w-16 text-amber-500 mb-6 animate-pulse" />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Time&apos;s Up!</h2>
                            <p className="text-gray-500 mb-8 max-w-sm">You didn&apos;t answer in time.</p>
                        </>
                    )}

                    {/* Show Leaderboard */}
                    {liveLeaderboard?.top3 && (
                        <div className="w-full max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-500 mb-8 flex flex-col items-center">
                            <h3 className="text-2xl font-black mb-8 flex items-center justify-center gap-3 text-gray-800">
                                <Trophy className="text-yellow-500 w-8 h-8" /> Live Leaderboard
                            </h3>
                            
                            {/* Top 3 Podium Animation (Same as Professor View) */}
                            <div className="flex items-end justify-center gap-4 h-48 w-full max-w-md mx-auto mb-10">
                                {/* 2nd Place */}
                                <div className={`flex flex-col items-center transition-all duration-700 ease-out flex-1 ${leaderboardAnimStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                                    <Medal className="h-8 w-8 text-gray-400 mb-2" />
                                    <p className="text-sm font-bold text-gray-700 truncate w-full px-1">{liveLeaderboard.top3[1]?.name || "—"}</p>
                                    <p className="text-xs text-gray-500">{liveLeaderboard.top3[1]?.score ?? "—"} pts</p>
                                    <div className="w-full max-w-[80px] bg-gray-300 rounded-t-lg mt-2 shadow-inner" style={{ height: '100px' }}>
                                        <div className="h-full flex items-center justify-center text-3xl font-black text-white">2</div>
                                    </div>
                                </div>
                                
                                {/* 1st Place */}
                                <div className={`flex flex-col items-center transition-all duration-700 ease-out flex-1 ${leaderboardAnimStage >= 3 ? 'opacity-100 translate-y-0 scale-110 z-10' : 'opacity-0 translate-y-10'}`}>
                                    <Trophy className="h-10 w-10 text-yellow-500 mb-2 drop-shadow-md" />
                                    <p className="text-sm font-bold text-gray-900 truncate w-full px-1">{liveLeaderboard.top3[0]?.name || "—"}</p>
                                    <p className="text-xs text-gray-500">{liveLeaderboard.top3[0]?.score ?? "—"} pts</p>
                                    <div className="w-full max-w-[90px] bg-yellow-400 rounded-t-lg mt-2 shadow-inner" style={{ height: '140px' }}>
                                        <div className="h-full flex items-center justify-center text-4xl font-black text-white drop-shadow-sm">1</div>
                                    </div>
                                </div>
                                
                                {/* 3rd Place */}
                                <div className={`flex flex-col items-center transition-all duration-700 ease-out flex-1 ${leaderboardAnimStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                                    <Medal className="h-7 w-7 text-amber-600 mb-2" />
                                    <p className="text-sm font-bold text-gray-700 truncate w-full px-1">{liveLeaderboard.top3[2]?.name || "—"}</p>
                                    <p className="text-xs text-gray-500">{liveLeaderboard.top3[2]?.score ?? "—"} pts</p>
                                    <div className="w-full max-w-[80px] bg-amber-500 rounded-t-lg mt-2 shadow-inner" style={{ height: '70px' }}>
                                        <div className="h-full flex items-center justify-center text-3xl font-black text-white">3</div>
                                    </div>
                                </div>
                            </div>

                            {/* Full Scrollable List below Top 3 */}
                            {leaderboardAnimStage >= 4 && liveLeaderboard.fullList && liveLeaderboard.fullList.length > 3 && (
                                <Card className="w-full shadow-lg border-t-4 border-t-purple-600 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <CardContent className="p-0">
                                        <div className="max-h-[250px] overflow-y-auto p-4 space-y-2 bg-gray-50 rounded-b-xl">
                                            {liveLeaderboard.fullList.slice(3).map((entry: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                                <div key={entry.studentId} className={`flex justify-between items-center p-3 rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow ${
                                                    entry.studentId === liveLeaderboard.myStats?.studentId ? "ring-2 ring-purple-400 border-transparent bg-purple-50" : "border-gray-200"
                                                }`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center shadow-inner">
                                                            #{entry.rank}
                                                        </div>
                                                        <span className="font-semibold text-gray-800 text-left">{entry.name} {entry.studentId === liveLeaderboard.myStats?.studentId && "(You)"}</span>
                                                    </div>
                                                    <span className="font-bold text-purple-700">{entry.score} pts</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Your Stats Summary if not in Top 3 but leaderboard finished animating */}
                            {leaderboardAnimStage >= 4 && liveLeaderboard.myStats && liveLeaderboard.myStats.rank > 3 && (
                                <div className="mt-4 px-6 py-3 bg-purple-100 text-purple-800 rounded-full font-bold shadow-sm animate-in zoom-in duration-300">
                                    Your Rank: #{liveLeaderboard.myStats.rank} — Score: {liveLeaderboard.myStats.score} pts
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-3 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-lg font-medium">Waiting for professor to show next question...</span>
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