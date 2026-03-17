// src/actions/student.ts
"use server";

import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function verifyAndJoinQuiz(code: string) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "STUDENT") {
            return { success: false, error: "Only registered students can join quizzes." };
        }

        // 1. Database me Code dhoondo (Case insensitive)
        const quiz = await prisma.quiz.findUnique({
            where: { code: code.toUpperCase() },
        });

        if (!quiz) {
            return { success: false, error: "Invalid Join Code. Please check again." };
        }

        // 2. Check karo ki Quiz Live hai ya nahi
        if (quiz.status === "DRAFT") {
            return { success: false, error: "The professor hasn't started this quiz yet." };
        }
        if (quiz.status === "COMPLETED") {
            return { success: false, error: "This quiz has already ended." };
        }

        // 3. Check karo ki Student ne pehle toh attempt nahi kiya
        const existingAttempt = await prisma.studentAttempt.findUnique({
            where: {
                studentId_quizId: {
                    studentId: session.user.id,
                    quizId: quiz.id,
                },
            },
        });

        if (existingAttempt) {
            if (existingAttempt.isFinished) {
                return { success: false, error: "You have already completed this quiz." };
            }
            // Agar net chala gaya tha aur wapas aaya hai, toh resume karne do
            return { success: true, quizId: quiz.id, message: "Resuming your quiz..." };
        }

        // Sab badhiya hai, join karne do
        return { success: true, quizId: quiz.id };

    } catch (error) {
        console.error("Join Error:", error);
        return { success: false, error: "Something went wrong. Try again." };
    }
}



// src/actions/student.ts me niche add karo:

export async function getQuizForStudent(quizId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };

        // 🔥 FIX: findUnique ki jagah findFirst use kiya hai
        const quiz = await prisma.quiz.findFirst({
            where: { id: quizId, status: "LIVE" },
            include: {
                questions: {
                    select: {
                        id: true, text: true, imageUrl: true, type: true, timeLimit: true, marks: true, negative: true,
                        options: { select: { id: true, text: true } }
                    }
                }
            }
        });

        if (!quiz) return { success: false, error: "Quiz not available or ended." };
        return { success: true, quiz };
    } catch (error) {
        // Agar fir bhi error aaya toh terminal me print hoga
        console.error("Fetch Quiz Error:", error);
        return { success: false, error: "Failed to load quiz." };
    }
}

// 🔥 THE BRAHMASTRA FIX: Accept simple Strings only
export async function submitExam(quizId: string, answersJson: string) {
    try {
        console.log("Backend Received QuizId:", quizId);

        if (!quizId || quizId === "undefined") return { success: false, error: "Quiz ID is missing!" };
        if (!answersJson) return { success: false, error: "Answers data is missing!" };

        // String ko wapas Object me convert karo
        const studentAnswers = JSON.parse(answersJson);

        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };
        const studentId = session.user.id;

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: { include: { options: true } } }
        });
        if (!quiz) return { success: false, error: "Quiz not found" };

        let totalScore = 0;
        const answerRecords = [];

        for (const question of quiz.questions) {
            const studentAns = studentAnswers[question.id];
            let isCorrect = false;
            let marksAwarded = 0;

            let formattedTextResponse = null;
            let formattedOptions: string[] = [];

            if (studentAns !== undefined && studentAns !== null && studentAns !== "") {
                if (question.type === "SINGLE_CORRECT") {
                    const correctOpt = question.options.find((o: any) => o.isCorrect); // eslint-disable-line @typescript-eslint/no-explicit-any
                    if (correctOpt && correctOpt.id === studentAns) isCorrect = true;
                    formattedOptions = [studentAns as string];
                }
                else if (question.type === "MULTI_CORRECT") {
                    const correctOpts = question.options.filter((o: any) => o.isCorrect).map((o: any) => o.id); // eslint-disable-line @typescript-eslint/no-explicit-any
                    const studentOpts = studentAns as string[];
                    if (studentOpts.length === correctOpts.length && studentOpts.every(id => correctOpts.includes(id))) {
                        isCorrect = true;
                    }
                    formattedOptions = studentOpts;
                }
                else if (question.type === "FILL_IN_BLANK" || question.type === "INTEGER_TYPE") {
                    const exactAnswer = (question as any).correctAnswer; // eslint-disable-line @typescript-eslint/no-explicit-any
                    if (exactAnswer) {
                        const sanitizedStudentAns = String(studentAns).trim().toUpperCase().replace(/\s+/g, ' ');
                        const sanitizedExactAns = String(exactAnswer).trim().toUpperCase().replace(/\s+/g, ' ');
                        if (sanitizedStudentAns === sanitizedExactAns) {
                            isCorrect = true;
                        }
                    }
                    formattedTextResponse = String(studentAns);
                }
                else if (question.type === "DESCRIPTIVE") {
                    formattedTextResponse = String(studentAns);
                }

                if (isCorrect) {
                    marksAwarded = question.marks;
                } else if (question.type !== "DESCRIPTIVE") {
                    marksAwarded = -Math.abs(question.negative);
                }
            }

            totalScore += marksAwarded;

            answerRecords.push({
                questionId: question.id,
                textResponse: formattedTextResponse,
                selectedOptions: formattedOptions,
                isCorrect: isCorrect,
                marksAwarded: marksAwarded
            });
        }

        const existingAttempt = await prisma.studentAttempt.findUnique({
            where: { studentId_quizId: { studentId, quizId } }
        });

        if (existingAttempt) {
            await prisma.studentAnswer.deleteMany({ where: { attemptId: existingAttempt.id } });
            await prisma.studentAttempt.update({
                where: { id: existingAttempt.id },
                data: {
                    score: totalScore,
                    isFinished: true,
                    endedAt: new Date(),
                    answers: { create: answerRecords }
                }
            });
        } else {
            await prisma.studentAttempt.create({
                data: {
                    studentId,
                    quizId,
                    score: totalScore,
                    isFinished: true,
                    endedAt: new Date(),
                    answers: { create: answerRecords }
                }
            });
        }

        return { success: true, score: totalScore };
    } catch (error) {
        console.error("Submit Error:", error);
        return { success: false, error: "Failed to submit exam." };
    }
}





// 1. Student ke saare attempts laane ke liye
export async function getStudentHistory() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };

        const attempts = await prisma.studentAttempt.findMany({
            where: { studentId: session.user.id },
            include: {
                quiz: {
                    select: { title: true, status: true, startTime: true }
                }
            },
            orderBy: { startedAt: "desc" }
        });

        return { success: true, attempts };
    } catch {
        return { success: false, error: "Failed to fetch history." };
    }
}

// 2. PDF ke liye detail data laane ke liye (Sirf tab chalega jab test COMPLETED ho)
export async function getDetailedResultForPDF(quizId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: { include: { options: true } },
                attempts: {
                    where: { studentId: session.user.id },
                    include: { answers: true }
                }
            }
        });

        if (!quiz) return { success: false, error: "Quiz not found" };

        // 🔥 SECURITY CHECK: Test khatam hone ke baad hi answer key milegi
        if (quiz.status !== "COMPLETED") {
            return { success: false, error: "Answer key will be available only after the professor ends the test." };
        }

        return { success: true, quiz, attempt: quiz.attempts[0] };
    } catch {
        return { success: false, error: "Failed to fetch PDF details." };
    }
}


// 3. LIVE GUIDED MODE: Submit a single answer for one question with speed-based scoring
export async function submitLiveAnswer(
    quizId: string,
    questionId: string,
    answer: string, // optionId for MCQ, text for others
    answerType: string, // SINGLE_CORRECT, MULTI_CORRECT, etc.
    timeTaken: number // seconds taken to answer
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };
        const studentId = session.user.id;

        // Get the question details for evaluation
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: { options: true }
        });
        if (!question) return { success: false, error: "Question not found" };

        // Evaluate correctness
        let isCorrect = false;
        let formattedTextResponse: string | null = null;
        let formattedOptions: string[] = [];

        if (answerType === "SINGLE_CORRECT") {
            const correctOpt = question.options.find(o => o.isCorrect);
            if (correctOpt && correctOpt.id === answer) isCorrect = true;
            formattedOptions = [answer];
        } else if (answerType === "MULTI_CORRECT") {
            const selectedOpts = JSON.parse(answer) as string[];
            const correctOpts = question.options.filter(o => o.isCorrect).map(o => o.id);
            if (selectedOpts.length === correctOpts.length && selectedOpts.every(id => correctOpts.includes(id))) {
                isCorrect = true;
            }
            formattedOptions = selectedOpts;
        } else if (answerType === "FILL_IN_BLANK" || answerType === "INTEGER_TYPE") {
            const exactAnswer = (question as any).correctAnswer; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (exactAnswer) {
                const s1 = String(answer).trim().toUpperCase().replace(/\s+/g, ' ');
                const s2 = String(exactAnswer).trim().toUpperCase().replace(/\s+/g, ' ');
                if (s1 === s2) isCorrect = true;
            }
            formattedTextResponse = String(answer);
        } else if (answerType === "DESCRIPTIVE") {
            formattedTextResponse = String(answer);
        }

        // Speed-based scoring: bonus up to 50% of marks based on speed
        let marksAwarded = 0;
        if (isCorrect) {
            const speedBonus = Math.floor((Math.max(0, question.timeLimit - timeTaken) / question.timeLimit) * question.marks * 0.5);
            marksAwarded = question.marks + speedBonus;
        } else if (answerType !== "DESCRIPTIVE") {
            marksAwarded = -Math.abs(question.negative);
        }

        // Ensure StudentAttempt exists (create if first answer)
        let attempt = await prisma.studentAttempt.findUnique({
            where: { studentId_quizId: { studentId, quizId } }
        });

        if (!attempt) {
            attempt = await prisma.studentAttempt.create({
                data: { studentId, quizId, score: 0, isFinished: false }
            });
        }

        // Upsert the answer (handles re-submission)
        const existingAnswer = await prisma.studentAnswer.findUnique({
            where: { attemptId_questionId: { attemptId: attempt.id, questionId } }
        });

        if (existingAnswer) {
            // Update existing answer
            await prisma.studentAnswer.update({
                where: { id: existingAnswer.id },
                data: {
                    selectedOptions: formattedOptions,
                    textResponse: formattedTextResponse,
                    isCorrect,
                    marksAwarded,
                    timeTaken
                }
            });
            // Recalculate total score
            const allAnswers = await prisma.studentAnswer.findMany({
                where: { attemptId: attempt.id }
            });
            const newTotal = allAnswers.reduce((sum, a) => sum + a.marksAwarded, 0);
            await prisma.studentAttempt.update({
                where: { id: attempt.id },
                data: { score: newTotal }
            });
        } else {
            // Create new answer
            await prisma.studentAnswer.create({
                data: {
                    attemptId: attempt.id,
                    questionId,
                    selectedOptions: formattedOptions,
                    textResponse: formattedTextResponse,
                    isCorrect,
                    marksAwarded,
                    timeTaken
                }
            });
            // Update total score
            await prisma.studentAttempt.update({
                where: { id: attempt.id },
                data: { score: { increment: marksAwarded } }
            });
        }

        return { success: true, isCorrect, marksAwarded };
    } catch {
        // console.error("Live Answer Error:", error);
        return { success: false, error: "Failed to submit answer." };
    }
}

// 4. LIVE GUIDED MODE: Get Top 5 Leaderboard + Current Student Rank
export async function getLiveLeaderboardForStudent(quizId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") return { success: false, error: "Unauthorized" };
        const studentId = session.user.id;

        const attempts = await prisma.studentAttempt.findMany({
            where: { quizId },
            include: {
                student: { select: { name: true, id: true } }
            },
            orderBy: { score: 'desc' }
        });

        const leaderboard = attempts.map((a, idx) => ({
            rank: idx + 1,
            name: a.student.name || "Student",
            studentId: a.student.id,
            score: a.score
        }));

        // Top 3 for podium display
        const top3 = leaderboard.slice(0, 3);
        
        // Find current student's stats
        const myStats = leaderboard.find(l => l.studentId === studentId);

        return { success: true, top3, fullList: leaderboard, myStats };
    } catch {
        return { success: false, error: "Failed to fetch leaderboard" };
    }
}