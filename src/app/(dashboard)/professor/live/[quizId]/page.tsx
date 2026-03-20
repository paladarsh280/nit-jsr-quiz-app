"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuizStats, updateActiveQuestionIndex, updateQuizStatus, getQuestionStats as fetchQuestionStats } from "@/actions/professor";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/ui/PremiumLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, PlayCircle, Users, CheckCircle2, ChevronRight, Timer, BarChart3, SkipForward, StopCircle, Trophy, Medal } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function LiveGuidedRoom() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.quizId as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState<"question" | "leaderboard" | "stats">("question");
    const [questionStats, setQuestionStats] = useState<any>(null);
    const [leaderboardAnimStage, setLeaderboardAnimStage] = useState(0); // 0=none, 1=3rd, 2=2nd, 3=1st, 4=full
    const [statusLoading, setStatusLoading] = useState(false);

    // 🔥 Refs for preventing double-advance and protecting optimistic updates from polling
    const isAdvancingRef = useRef(false);        // True during advance — blocks handleTimeUp + extra clicks
    const minExpectedIndexRef = useRef(0);        // Polling never reverts below this index

    const fetchQuiz = useCallback(async () => {
        const res = await getQuizStats(quizId);
        if (res.success) {
            setQuiz((prev: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const fetched = res.quiz as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                // 🔥 FIX: Never let polling revert activeQuestionIndex backward.
                // This protects our optimistic update when the DB hasn't committed yet.
                if (fetched.activeQuestionIndex < minExpectedIndexRef.current) {
                    return { ...fetched, activeQuestionIndex: minExpectedIndexRef.current };
                }
                // Once DB matches or exceeds, update minExpected to stay in sync
                minExpectedIndexRef.current = fetched.activeQuestionIndex;
                return fetched;
            });
        } else {
            toast.error(res.error);
            router.push("/professor");
        }
        setLoading(false);
    }, [quizId, router]);

    // Poll for updates (student submissions)
    useEffect(() => {
        fetchQuiz();
        const interval = setInterval(fetchQuiz, 2000);
        return () => clearInterval(interval);
    }, [fetchQuiz]);

    // Timer logic and phase restoration
    useEffect(() => {
        if (!quiz) return;
        const currentQ = quiz.questions[quiz.activeQuestionIndex];
        if (!currentQ) return;

        // On initial load or refresh, sync phase from localStorage if it exists for this question
        const savedState = localStorage.getItem(`prof_state_${quiz.id}`);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.activeIndex === quiz.activeQuestionIndex && parsed.phase) {
                    // Only restore phase if it's not already set to avoid infinite loops
                    if (phase === "question" && parsed.phase !== "question") {
                        setPhase(parsed.phase);
                        setLeaderboardAnimStage(parsed.leaderboardAnimStage || 0);
                        if (parsed.questionStats) setQuestionStats(parsed.questionStats);
                        return; // Let the next render handle the non-question phase
                    }
                }
            } catch (e) { /* ignore */ }
        }

        if (phase === "question") {
            const timer = setInterval(() => {
                const rawUpdatedAt = quiz.updatedAt as string;
                const updatedAtUTC = rawUpdatedAt.endsWith('Z') ? rawUpdatedAt : rawUpdatedAt + 'Z';
                const elapsedSec = Math.floor((Date.now() - new Date(updatedAtUTC).getTime()) / 1000);
                const calculatedTimeLeft = Math.max(0, currentQ.timeLimit - elapsedSec);

                setTimeLeft(calculatedTimeLeft);

                if (calculatedTimeLeft === 0) {
                    clearInterval(timer);
                    handleTimeUp();
                }
            }, 500); // 500ms for tighter accuracy
            return () => clearInterval(timer);
        }
    }, [quiz?.activeQuestionIndex, phase, quiz?.updatedAt]);

    // Save professor phase to local storage so refreshes don't reset the view
    useEffect(() => {
        if (quiz && phase !== "question") {
            localStorage.setItem(`prof_state_${quiz.id}`, JSON.stringify({
                activeIndex: quiz.activeQuestionIndex,
                phase,
                leaderboardAnimStage,
                questionStats
            }));
        }
    }, [phase, leaderboardAnimStage, questionStats, quiz]);

    const handleTimeUp = async () => {
        if (!quiz || isAdvancingRef.current) return; // 🔥 Use ref (not state) for guaranteed up-to-date check
        const currentQ = quiz.questions[quiz.activeQuestionIndex];

        // Fetch question stats
        const statsRes = await fetchQuestionStats(quizId, currentQ.id);
        if (statsRes.success) {
            setQuestionStats(statsRes);
        }

        // Show stats first, then animate leaderboard
        setPhase("stats");

        // After 3 seconds of stats, switch to leaderboard animation
        setTimeout(() => {
            setPhase("leaderboard");
            animateLeaderboard();
        }, 3000);
    };

    const animateLeaderboard = () => {
        setLeaderboardAnimStage(0);
        // Animated reveal: 3rd → 2nd → 1st → full list
        setTimeout(() => setLeaderboardAnimStage(1), 400);   // 3rd place
        setTimeout(() => setLeaderboardAnimStage(2), 900);   // 2nd place
        setTimeout(() => setLeaderboardAnimStage(3), 1400);  // 1st place
        setTimeout(() => setLeaderboardAnimStage(4), 2200);  // Full list
    };

    const handleNextQuestion = async () => {
        if (!quiz) return;
        // 🔥 Use ref for immediate lock — state update is async and could allow a second click
        if (isAdvancingRef.current) return;
        if (quiz.activeQuestionIndex >= quiz.questions.length - 1) {
            toast.info("This is the last question.");
            return;
        }

        // Lock immediately via ref (synchronous) AND state (for UI disabled styling)
        isAdvancingRef.current = true;
        setIsAdvancing(true);

        const nextIndex = quiz.activeQuestionIndex + 1;

        // Set the minimum expected index so polling can't revert below this
        minExpectedIndexRef.current = nextIndex;

        // Optimistic update: update quiz state immediately with correct index + timestamp
        // so the timer useEffect gets fresh data and doesn't fire timeLeft=0 instantly
        const nowIso = new Date().toISOString();
        setQuiz((prev: any) => ({ ...prev, activeQuestionIndex: nextIndex, updatedAt: nowIso })); // eslint-disable-line @typescript-eslint/no-explicit-any
        setPhase("question");
        setQuestionStats(null);
        setLeaderboardAnimStage(0);
        setTimeLeft(quiz.questions[nextIndex]?.timeLimit || 30);

        const res = await updateActiveQuestionIndex(quiz.id, nextIndex);
        if (res.success) {
            localStorage.removeItem(`prof_state_${quiz.id}`);
            toast.success(`Q${nextIndex + 1} is live!`);
            // Don't call fetchQuiz here — let the 2s polling sync naturally.
            // Calling it manually could race with the optimistic update.
        } else {
            toast.error("Failed to advance question.");
            // Rollback
            minExpectedIndexRef.current = nextIndex - 1;
            setQuiz((prev: any) => ({ ...prev, activeQuestionIndex: nextIndex - 1 })); // eslint-disable-line @typescript-eslint/no-explicit-any
            setPhase("leaderboard");
        }

        // Keep locked for 1 extra second to prevent accidental double-tap
        setTimeout(() => {
            isAdvancingRef.current = false;
            setIsAdvancing(false);
        }, 1000);
    };

    const handleSkipQuestion = async () => {
        // Skip = jump straight to stats bypassing the timer wait
        handleTimeUp();
    };

    const handleEndQuiz = async () => {
        if (!confirm("End the quiz? Students will be auto-submitted.")) return;
        setStatusLoading(true);
        const res = await updateQuizStatus(quizId, "COMPLETED");
        if (res.success) {
            toast.success("Quiz ended!");
            router.push(`/professor/history/${quizId}`);
        } else {
            toast.error("Failed to end quiz.");
        }
        setStatusLoading(false);
    };

    if (loading && !quiz) return <PremiumLoader text="Initializing Live Room..." />;
    if (!quiz) return <div className="text-center py-20 text-xl font-bold">Quiz error or not found.</div>;

    const activeIndex = quiz.activeQuestionIndex;
    const currentQ = quiz.questions[activeIndex];
    const isLastQuestion = activeIndex >= quiz.questions.length - 1;
    const sortedAttempts = [...quiz.attempts].sort((a: any, b: any) => b.score - a.score);
    const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/test/${quiz.id}` : '';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8 select-none">

            {/* Header */}
            <header className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl border shadow-sm mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push(`/professor/history/${quiz.id}`)} className="text-gray-500 hover:text-gray-900 px-2">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">{quiz.title} <Badge className="ml-2 bg-red-100 text-red-700 hover:bg-red-200">LIVE MENTI-STYLE</Badge></h1>
                        <p className="text-gray-500 text-sm mt-1">Join Code: <strong className="text-blue-600">{quiz.code}</strong></p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <span className="text-xs text-gray-500 font-semibold uppercase block">Students</span>
                        <span className="text-xl font-bold text-blue-700 flex items-center justify-center gap-1"><Users className="h-5 w-5" /> {quiz.attempts.length}</span>
                    </div>
                    <Button onClick={handleEndQuiz} disabled={statusLoading} variant="destructive" size="sm" className="gap-2">
                        <StopCircle className="h-4 w-4" /> End Quiz
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

                {/* Left Column: Main Stage */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                    {/* QR Code Banner */}
                    <Card className="bg-blue-600 text-white shadow-lg overflow-hidden border-none shrink-0">
                        <div className="p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="space-y-2 text-center sm:text-left">
                                <h2 className="text-3xl font-black">Scan to Join Live</h2>
                                <p className="text-blue-100 text-lg">Wait for the professor to present</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl shadow-inner">
                                <QRCodeSVG value={joinUrl} size={100} level="M" />
                            </div>
                        </div>
                    </Card>

                    {/* Main Stage Content */}
                    <Card className="flex-1 shadow-md border-t-8 border-t-blue-600 flex flex-col overflow-hidden">
                        <CardContent className="p-6 md:p-10 flex flex-col justify-center flex-1 text-center relative min-h-[400px]">

                            {/* PHASE 1: Question */}
                            {phase === "question" && currentQ && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <Badge variant="outline" className="px-4 py-1.5 text-base border-blue-200 text-blue-800 bg-blue-50">
                                        Question {activeIndex + 1} of {quiz.questions.length}
                                    </Badge>

                                    <h2 className="text-3xl md:text-5xl font-medium text-gray-900 leading-tight whitespace-pre-wrap">
                                        {currentQ.text}
                                    </h2>

                                    {currentQ.imageUrl && (
                                        <img src={currentQ.imageUrl} alt="Reference" className="mx-auto mt-8 max-h-64 object-contain rounded-xl border-2 shadow-sm" />
                                    )}

                                    {/* Options displayed for students */}
                                    {currentQ.options && currentQ.options.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-2xl mx-auto text-left">
                                            {currentQ.options.map((opt: any, idx: number) => (
                                                <div key={opt.id || idx} className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-lg font-medium text-gray-800">
                                                    <span className="text-blue-600 font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Timer */}
                                    <div className={`absolute bottom-6 right-6 flex items-center gap-3 px-6 py-3 rounded-full font-mono text-2xl font-bold border-2 shadow-sm transition-all ${timeLeft <= 5 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse scale-110' : 'bg-blue-50 text-blue-600 border-blue-200'
                                        }`}>
                                        <Timer className="h-6 w-6" /> {timeLeft}s
                                    </div>
                                </div>
                            )}

                            {/* PHASE 2: Question Stats */}
                            {phase === "stats" && questionStats && (
                                <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                                    <BarChart3 className="h-16 w-16 text-purple-600 mx-auto" />
                                    <h3 className="text-3xl font-black text-gray-800">Question Statistics</h3>
                                    <p className="text-gray-500">{questionStats.totalResponses} student(s) answered</p>

                                    {/* Bar Chart for Options */}
                                    <div className="max-w-lg mx-auto space-y-3">
                                        {questionStats.stats?.map((stat: any, idx: number) => {
                                            const maxCount = Math.max(1, ...questionStats.stats.map((s: any) => s.count));
                                            const percentage = (stat.count / maxCount) * 100;
                                            return (
                                                <div key={stat.id} className="flex items-center gap-3">
                                                    <span className="text-lg font-bold w-8 text-gray-600">{String.fromCharCode(65 + idx)}</span>
                                                    <div className="flex-1 bg-gray-100 rounded-full h-10 relative overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out flex items-center px-4 ${stat.isCorrect ? 'bg-green-500' : 'bg-blue-400'
                                                                }`}
                                                            style={{ width: `${Math.max(percentage, 8)}%` }}
                                                        >
                                                            <span className="text-white font-bold text-sm">{stat.count}</span>
                                                        </div>
                                                    </div>
                                                    {stat.isCorrect && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Correct Answer */}
                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl inline-block">
                                        <span className="text-green-800 font-bold text-lg">
                                            ✅ Correct: {questionStats.stats?.filter((s: any) => s.isCorrect).map((s: any) => s.text).join(", ") || "N/A"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* PHASE 3: Animated Leaderboard */}
                            {phase === "leaderboard" && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <Trophy className="h-16 w-16 text-yellow-500 mx-auto" />
                                    <h3 className="text-3xl font-black text-gray-800">🏆 Leaderboard</h3>

                                    {/* Top 3 Podium Animation */}
                                    <div className="flex items-end justify-center gap-4 h-48 max-w-md mx-auto mt-4">
                                        {/* 2nd Place */}
                                        <div className={`flex flex-col items-center transition-all duration-700 ease-out ${leaderboardAnimStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                                            <Medal className="h-8 w-8 text-gray-400 mb-2" />
                                            <p className="text-sm font-bold text-gray-700 truncate max-w-[100px]">{sortedAttempts[1]?.student?.name || "—"}</p>
                                            <p className="text-xs text-gray-500">{sortedAttempts[1]?.score ?? "—"} pts</p>
                                            <div className="w-20 bg-gray-300 rounded-t-lg mt-2" style={{ height: '100px' }}>
                                                <div className="h-full flex items-center justify-center text-2xl font-black text-white">2</div>
                                            </div>
                                        </div>

                                        {/* 1st Place */}
                                        <div className={`flex flex-col items-center transition-all duration-700 ease-out ${leaderboardAnimStage >= 3 ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 translate-y-10'}`}>
                                            <Trophy className="h-10 w-10 text-yellow-500 mb-2" />
                                            <p className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{sortedAttempts[0]?.student?.name || "—"}</p>
                                            <p className="text-xs text-gray-500">{sortedAttempts[0]?.score ?? "—"} pts</p>
                                            <div className="w-24 bg-yellow-400 rounded-t-lg mt-2" style={{ height: '140px' }}>
                                                <div className="h-full flex items-center justify-center text-3xl font-black text-white">1</div>
                                            </div>
                                        </div>

                                        {/* 3rd Place */}
                                        <div className={`flex flex-col items-center transition-all duration-700 ease-out ${leaderboardAnimStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                                            <Medal className="h-7 w-7 text-amber-600 mb-2" />
                                            <p className="text-sm font-bold text-gray-700 truncate max-w-[100px]">{sortedAttempts[2]?.student?.name || "—"}</p>
                                            <p className="text-xs text-gray-500">{sortedAttempts[2]?.score ?? "—"} pts</p>
                                            <div className="w-20 bg-amber-500 rounded-t-lg mt-2" style={{ height: '70px' }}>
                                                <div className="h-full flex items-center justify-center text-2xl font-black text-white">3</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Controls */}
                    <div className="flex justify-between items-center pt-2 gap-4">
                        {/* Skip Button */}
                        {phase === "question" && (
                            <Button
                                variant="outline"
                                onClick={handleSkipQuestion}
                                className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                            >
                                <SkipForward className="h-5 w-5" /> Skip Question
                            </Button>
                        )}
                        {phase !== "question" && <div />}

                        {/* Next Question */}
                        {!isLastQuestion ? (
                            <Button
                                size="lg"
                                onClick={handleNextQuestion}
                                disabled={phase === "question" || isAdvancing || phase === "stats" || (phase === "leaderboard" && leaderboardAnimStage < 4)}
                                className={`text-xl px-10 py-8 rounded-2xl gap-3 shadow-lg transition-all ${phase === "question" || phase === "stats" || (phase === "leaderboard" && leaderboardAnimStage < 4)
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : isAdvancing
                                            ? 'bg-blue-400 text-white cursor-wait'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                {phase === "stats" ? (
                                    <>{"Calculating..."} <BarChart3 className="h-6 w-6 animate-pulse" /></>
                                ) : phase === "leaderboard" && leaderboardAnimStage < 4 ? (
                                    <>{"Leaderboard..."} <Trophy className="h-6 w-6 animate-pulse" /></>
                                ) : (
                                    <>Next Question <ChevronRight className="h-6 w-6" /></>
                                )}
                            </Button>
                        ) : (
                            // 🔥 FIX: "Finish Quiz" button should ALWAYS be clickable on the last
                            // question — don't lock it behind the leaderboard animation.
                            // A professor may be in a hurry or stuck mid-animation and needs to end the quiz.
                            <Button
                                size="lg"
                                disabled={phase === "question" || phase === "stats" || statusLoading}
                                onClick={handleEndQuiz}
                                className={`text-xl px-10 py-8 rounded-2xl gap-3 shadow-lg transition-all ${
                                    phase === "question" || phase === "stats"
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                            >
                                {statusLoading
                                    ? <><span className="animate-spin mr-2">⏳</span> Ending...</>
                                    : <><StopCircle className="h-6 w-6" /> Finish Quiz</>
                                }
                            </Button>
                        )}
                    </div>
                </div>

                {/* Right Column: Live Rankings */}
                <Card className="shadow-md h-full flex flex-col">
                    <div className="p-4 border-b bg-gray-50 rounded-t-xl">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" /> Live Rankings</h3>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-3">
                        {sortedAttempts.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">No attempts yet.</div>
                        ) : (
                            sortedAttempts.map((attempt: any, idx: number) => (
                                <div key={attempt.id} className={`flex items-center gap-3 bg-white p-3 rounded-xl border hover:shadow-sm transition-all ${phase === "leaderboard" && leaderboardAnimStage >= 4 ? 'animate-in fade-in slide-in-from-right duration-300' : ''
                                    }`} style={{ animationDelay: `${idx * 80}ms` }}>
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            idx === 1 ? 'bg-gray-200 text-gray-700' :
                                                idx === 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
                                        }`}>
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{attempt.student?.name || "Student"}</p>
                                        <p className="text-xs text-gray-500 truncate">{attempt.student?.email}</p>
                                    </div>
                                    <div className="font-bold text-lg text-indigo-600">{attempt.score}</div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

            </div>
        </div>
    );
}
