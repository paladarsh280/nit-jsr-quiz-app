"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getNormalQuizLeaderboard } from "@/actions/student";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/ui/PremiumLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, ArrowLeft, Clock } from "lucide-react";

export default function LeaderboardPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = (params.quizId || params.quizid) as string;

    const [leaderboard, setLeaderboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            const res = await getNormalQuizLeaderboard(quizId);
            if (res.success) {
                setLeaderboard(res);
            } else {
                toast.error(res.error);
            }
            setLoading(false);
        };
        fetchLeaderboard();
    }, [quizId]);

    const formatTimeMs = (ms: number) => {
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const remMs = ms % 1000;
        
        let out = "";
        if (m > 0) out += `${m}m `;
        out += `${s}s ${remMs}ms`;
        return out;
    };

    if (loading) return <PremiumLoader text="Loading Leaderboard..." />;

    if (!leaderboard || !leaderboard.fullList || leaderboard.fullList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Trophy className="h-20 w-20 text-gray-300 dark:text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">No attempts yet</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Be the first to complete this quiz!</p>
                <Button onClick={() => router.push("/student/history")} variant="outline" className="dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800">
                    Back to History
                </Button>
            </div>
        );
    }

    const top3 = leaderboard.fullList.slice(0, 3);
    const restList = leaderboard.fullList.slice(3);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <Button 
                variant="ghost" 
                onClick={() => router.push("/student/history")}
                className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
            </Button>

            <div className="text-center mb-12">
                <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 flex items-center justify-center gap-3">
                    <Trophy className="text-yellow-500 h-10 w-10" /> Quiz Leaderboard
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Rankings based on Score, then Speed (Fastest completion time)</p>
            </div>

            {/* Top 3 Podium */}
            {top3.length > 0 && (
                <div className="flex items-end justify-center gap-4 h-64 w-full max-w-2xl mx-auto mb-16 pt-8">
                    {/* Rank 2 */}
                    {top3[1] && (
                        <div className="flex flex-col items-center flex-1 animate-in slide-in-from-bottom-8 duration-700 delay-150">
                            <Medal className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2 drop-shadow-sm" />
                            <p className="text-base font-bold text-gray-800 dark:text-gray-200 truncate w-full px-1 text-center">{top3[1].name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold">{top3[1].score} pts</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3"/> {formatTimeMs(top3[1].timeTakenMs)}</p>
                            <div className="w-full max-w-[100px] bg-gray-300 dark:bg-slate-700 rounded-t-xl mt-3 shadow-inner" style={{ height: '120px' }}>
                                <div className="h-full flex items-center justify-center text-4xl font-black text-white drop-shadow-sm">2</div>
                            </div>
                        </div>
                    )}

                    {/* Rank 1 */}
                    <div className="flex flex-col items-center flex-1 z-10 animate-in slide-in-from-bottom-12 duration-700">
                        <Trophy className="h-14 w-14 text-yellow-500 mb-2 drop-shadow-md" />
                        <p className="text-lg font-black text-gray-900 dark:text-gray-100 truncate w-full px-1 text-center">{top3[0].name}</p>
                        <p className="text-base text-gray-700 dark:text-gray-300 font-bold">{top3[0].score} pts</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium"><Clock className="h-3 w-3"/> {formatTimeMs(top3[0].timeTakenMs)}</p>
                        <div className="w-full max-w-[120px] bg-yellow-400 dark:bg-yellow-500 rounded-t-xl mt-3 shadow-inner" style={{ height: '170px' }}>
                            <div className="h-full flex items-center justify-center text-5xl font-black text-white drop-shadow-sm">1</div>
                        </div>
                    </div>

                    {/* Rank 3 */}
                    {top3[2] && (
                        <div className="flex flex-col items-center flex-1 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                            <Medal className="h-9 w-9 text-amber-600 dark:text-amber-500 mb-2 drop-shadow-sm" />
                            <p className="text-base font-bold text-gray-800 dark:text-gray-200 truncate w-full px-1 text-center">{top3[2].name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold">{top3[2].score} pts</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3"/> {formatTimeMs(top3[2].timeTakenMs)}</p>
                            <div className="w-full max-w-[100px] bg-amber-500 dark:bg-amber-600 rounded-t-xl mt-3 shadow-inner" style={{ height: '90px' }}>
                                <div className="h-full flex items-center justify-center text-4xl font-black text-white drop-shadow-sm">3</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Full List */}
            {restList.length > 0 && (
                <Card className="w-full shadow-lg border-t-4 border-t-blue-600 dark:bg-white/5 dark:backdrop-blur-md dark:border-x-slate-800 dark:border-b-slate-800 dark:border-t-blue-600">
                    <CardContent className="p-0">
                        <div className="divide-y dark:divide-slate-800">
                            {restList.map((entry: any) => (
                                <div key={entry.studentId} className={`flex items-center p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${entry.studentId === leaderboard.myStats?.studentId ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}>
                                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold flex items-center justify-center mr-4">
                                        #{entry.rank}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                                            {entry.name} {entry.studentId === leaderboard.myStats?.studentId && "(You)"}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <Clock className="h-4 w-4" /> {formatTimeMs(entry.timeTakenMs)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-blue-600 dark:text-blue-400 text-xl">{entry.score} pts</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {leaderboard.myStats && leaderboard.myStats.rank > 3 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-6 py-4 bg-blue-600 text-white rounded-full font-bold shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-10 z-50">
                    <span>Your Rank: #{leaderboard.myStats.rank}</span>
                    <span>{leaderboard.myStats.score} pts</span>
                </div>
            )}
        </div>
    );
}
