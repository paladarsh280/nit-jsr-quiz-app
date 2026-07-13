import Link from "next/link";
import { getProfessorQuizzes } from "@/actions/professor";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Users, BookOpen, PlusCircle, Activity, BarChart, Copy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfessorDashboard() {
    const result = await getProfessorQuizzes();
    const quizzes = result.success ? result.quizzes : [];

    return (
        <div className="max-w-6xl mx-auto space-y-8">


            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-white/5 dark:backdrop-blur-md p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Professor Dashboard 👨‍🏫</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your quizzes, view live leaderboards, and check results.</p>
                </div>
                <Link href="/professor/create-test">
                    <Button className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto">
                        <PlusCircle className="h-4 w-4" /> Create New Test
                    </Button>
                </Link>
            </div>


            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Your Recent Quizzes</h2>

                {quizzes?.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">No quizzes created yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't created any tests. Click the button above to start.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quizzes?.map((quiz: any) => (
                            <Card key={quiz.id} className="hover:shadow-md transition-shadow relative overflow-hidden group">

                                <div className={`h-1.5 w-full absolute top-0 left-0 ${quiz.status === 'LIVE' ? 'bg-green-500' :
                                    quiz.status === 'COMPLETED' ? 'bg-gray-500' : 'bg-yellow-400'
                                    }`} />

                                <CardHeader className="pb-3 pt-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant={
                                            quiz.status === 'LIVE' ? 'default' :
                                                quiz.status === 'COMPLETED' ? 'secondary' : 'outline'
                                        } className={quiz.status === 'LIVE' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                                            {quiz.status}
                                        </Badge>

                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded text-sm font-mono font-bold text-gray-700 dark:text-gray-300 border border-transparent dark:border-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-500 transition-colors">
                                            {quiz.code}
                                        </div>
                                    </div>
                                    <CardTitle className="text-xl leading-tight truncate" title={quiz.title}>
                                        {quiz.title}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-3 pb-4">
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-2">
                                        <CalendarClock className="h-4 w-4" />
                                        <span>{new Date(quiz.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-400">
                                            <BookOpen className="h-4 w-4" />
                                            <span>{quiz._count.questions} Qs</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded text-purple-700 dark:text-purple-400">
                                            <Users className="h-4 w-4" />
                                            <span>{quiz._count.attempts} Attempts</span>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="pt-2 border-t dark:border-slate-800 bg-gray-50/50 dark:bg-white/5 dark:backdrop-blur-md/50 flex gap-2">
                                    {quiz.status === "LIVE" ? (

                                        <Link href={`/professor/history/${quiz.id}`} className="flex-1">
                                            <Button variant="outline" className="w-full border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 gap-2">
                                                <Activity className="h-4 w-4" /> Manage Live Test
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Link href={`/professor/history/${quiz.id}`} className="flex-1">
                                            <Button variant="outline" className="w-full gap-2 text-gray-600 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-800">
                                                <BarChart className="h-4 w-4" /> View Stats
                                            </Button>
                                        </Link>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
