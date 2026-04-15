"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BookOpen, Clock, FileWarning, EyeOff, ShieldAlert, BadgePlus, PlayCircle, BarChart3, Settings } from "lucide-react";

export default function InstructionsPage() {
    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">

            <div className="text-center space-y-3 pb-6 border-b">
                <h1 className="text-3xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">
                    Platform Guidelines
                </h1>
                <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                    Comprehensive instructions and anti-cheat policies for both Professors and Students using the NIT JSR Quiz App.
                </p>
            </div>

            <Tabs defaultValue="student" className="w-full">
                <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 mb-8 h-12 bg-gray-100 rounded-full p-1">
                    <TabsTrigger value="student" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-base font-medium">For Students</TabsTrigger>
                    <TabsTrigger value="professor" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm text-base font-medium">For Professors</TabsTrigger>
                </TabsList>

                <TabsContent value="student" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                        <Card className="border-t-4 border-t-blue-500 shadow-lg hover:shadow-xl transition-shadow bg-white/50 backdrop-blur-sm">
                            <CardContent className="p-6 md:p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <BookOpen className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800">Attempting Quizzes</h2>
                                </div>
                                <ul className="space-y-4 text-gray-600">
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
                                        <p>Click "Join Quiz" on the Dashboard to access your active exams.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">2</div>
                                        <p>Every single question is strictly timed. You must click <strong>Save & Next</strong> before the timer reaches zero.</p>
                                    </li>
                                    <li className="flex gap-3 flex-col sm:flex-row">
                                        <div className="flex gap-3">
                                            <div className="mt-1 flex-shrink-0 h-6 w-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">3</div>
                                            <p><strong>Auto-Save:</strong> If the timer runs out, whatever options you have selected or typed will be automatically saved, and you will be moved to the next question.</p>
                                        </div>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">4</div>
                                        <p>You cannot navigate backward. Once a question is submitted or times out, it is locked permanently.</p>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>


                    </div>
                </TabsContent>


                <TabsContent value="professor" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                        <Card className="border-t-4 border-t-indigo-500 shadow-lg hover:shadow-xl transition-shadow bg-indigo-50/30">
                            <CardContent className="p-6 md:p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <BadgePlus className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800">Creating a New Test</h2>
                                </div>
                                <ul className="space-y-4 text-gray-600">
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">1</div>
                                        <p>Navigate to <strong>Create Test</strong> from your dashboard panel.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">2</div>
                                        <p>Fill out the quiz metadata: Title, Description, and an Image Header (optional URL).</p>
                                    </li>
                                    <li className="flex gap-3 flex-col sm:flex-row">
                                        <div className="flex gap-3">
                                            <div className="mt-1 flex-shrink-0 h-6 w-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">3</div>
                                            <p>Add questions dynamically using the selector. Supported types include: <strong>Single Correct, Multi-Correct, Descriptive, Fill in blanks, and Integer types.</strong></p>
                                        </div>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">4</div>
                                        <p>Assign <strong>Time Limits (in seconds)</strong> and marks strictly corresponding to the difficulty of each question.</p>
                                    </li>
                                    <li className="flex gap-3 pt-2">
                                        <div className="p-3 bg-white shadow-sm border rounded-lg text-sm w-full">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 inline mr-2" />
                                            Hit "Create Quiz Form" to securely save. Initially, tests are set to <strong>DRAFT</strong> mode and remain invisible to students.
                                        </div>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>


                        <Card className="border-t-4 border-t-emerald-500 shadow-lg hover:shadow-xl transition-shadow bg-emerald-50/30">
                            <CardContent className="p-6 md:p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <BarChart3 className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800">Hosting & Analytics</h2>
                                </div>
                                <ul className="space-y-4 text-gray-600">
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm"><PlayCircle className="h-3 w-3" /></div>
                                        <p><strong>Make it Live:</strong> Go to Past Quizzes/Dashboard and open a test. Toggle the status to `LIVE` via the dashboard switcher. Students will immediately gain access to join via the Quiz ID.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm"><Settings className="h-3 w-3" /></div>
                                        <p><strong>Conclude Exam:</strong> Once time expires globally, toggle the test Status to `COMPLETED`. This locks endpoints and prevents late submissions.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0 h-6 w-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">📊</div>
                                        <p><strong>Deep Analytics:</strong> View individual automated scoring sheets, leaderboards, student completion times, and download bulk Excel sheets directly from the detailed history pane.</p>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
