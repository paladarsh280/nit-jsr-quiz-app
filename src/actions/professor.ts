"use server";

import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Random 6 character code generator (e.g. A7X9BQ)
function generateQuizCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function createQuizAction(data: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
        const session = await getServerSession(authOptions);

        // Security check: Sirf professor hi quiz bana sakta hai
        if (!session || session.user.role !== "PROFESSOR") {
            return { success: false, error: "Unauthorized access!" };
        }

        const professorId = session.user.id;
        const uniqueCode = generateQuizCode();

        // Prisma Transaction: Quiz aur uske andar ke Questions ek sath save honge
        const newQuiz = await prisma.quiz.create({
            data: {
                title: data.title,
                description: data.description,
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                code: uniqueCode,
                professorId: professorId,
                status: "DRAFT", 
                quizMode: data.quizMode || "NORMAL",

                // Nested create: Har question ko loop karke save karenge
                questions: {
                    create: data.questions.map((q: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                        text: q.text,
                        imageUrl: q.imageUrl || null, // 🔥 Image aayegi toh theek, warna null
                        type: q.type,
                        timeLimit: q.timeLimit,
                        marks: q.marks,
                        negative: q.negative,
                        correctAnswer: (q.type === "FILL_IN_BLANK" || q.type === "INTEGER_TYPE") ? q.correctAnswer : null, // 🔥 Exact Answer save hoga

                        // Options sirf tabhi save honge jab MCQ type ho
                        options: (q.type === "SINGLE_CORRECT" || q.type === "MULTI_CORRECT")
                            ? {
                                create: q.options.map((opt: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                                    text: opt.text,
                                    isCorrect: opt.isCorrect,
                                }))
                            }
                            : undefined,
                    })),
                },
            },
        });

        return { success: true, quizId: newQuiz.id, code: uniqueCode };

    } catch (error) {
        console.error("Error creating quiz:", error);
        return { success: false, error: "Failed to create quiz. Database error." };
    }
}



// src/actions/professor.ts me niche add karo:

export async function getProfessorQuizzes() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") {
            return { success: false, error: "Unauthorized access!" };
        }

        const quizzes = await prisma.quiz.findMany({
            where: { professorId: session.user.id },
            orderBy: { createdAt: "desc" }, // Naye quizzes upar aayenge
            include: {
                _count: {
                    select: {
                        attempts: true, // Kitne bacho ne attempt kiya
                        questions: true // Kitne questions hain
                    }
                }
            },
        });

        return { success: true, quizzes };
    } catch (error) {
        console.error("Error fetching quizzes:", error);
        return { success: false, error: "Failed to fetch quizzes." };
    }
}




// src/actions/professor.ts me niche add karo:

import { revalidatePath } from "next/cache";

// 1. Ek specific Quiz ki saari details aur Results laane ke liye
export async function getQuizStats(quizId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") return { success: false, error: "Unauthorized" };

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId, professorId: session.user.id },
            include: {
                questions: true,
                attempts: {
                    include: {
                        student: {
                            select: { name: true, email: true }
                        }
                    },
                    orderBy: { score: 'desc' } // Jiske zyada marks, wo upar
                }
            }
        });

        if (!quiz) return { success: false, error: "Quiz not found" };
        return { success: true, quiz };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to fetch stats" };
    }
}

// 2. Quiz ka Status change karne ke liye (Draft -> Live -> Completed)
export async function updateQuizStatus(quizId: string, status: "DRAFT" | "LIVE" | "COMPLETED") {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") return { success: false, error: "Unauthorized" };

        await prisma.quiz.update({
            where: { id: quizId, professorId: session.user.id },
            data: { status }
        });

        // Cache clear karo taaki dashboard pe naya status dikhe
        revalidatePath("/professor");
        revalidatePath(`/professor/history/${quizId}`);

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to update status" };
    }
}

// 3. Live Guided Mode: Advance to the next question
export async function updateActiveQuestionIndex(quizId: string, index: number) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") return { success: false, error: "Unauthorized" };

        await prisma.quiz.update({
            where: { id: quizId, professorId: session.user.id },
            data: { activeQuestionIndex: index }
        });

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to update active question" };
    }
}

// 4. Get question statistics — how many chose each option
export async function getQuestionStats(quizId: string, questionId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") return { success: false, error: "Unauthorized" };

        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: { options: true }
        });
        if (!question) return { success: false, error: "Question not found" };

        const answers = await prisma.studentAnswer.findMany({
            where: { question: { id: questionId }, attempt: { quizId } }
        });

        // Count how many students chose each option
        const optionCounts: Record<string, number> = {};
        for (const opt of question.options) {
            optionCounts[opt.id] = 0;
        }
        for (const ans of answers) {
            for (const optId of ans.selectedOptions) {
                if (optionCounts[optId] !== undefined) {
                    optionCounts[optId]++;
                }
            }
        }

        const stats = question.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            count: optionCounts[opt.id] || 0
        }));

        return { success: true, stats, totalResponses: answers.length };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to get question stats" };
    }
}

// 5. Get leaderboard data for live quiz
export async function getLeaderboardData(quizId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "PROFESSOR") return { success: false, error: "Unauthorized" };

        const attempts = await prisma.studentAttempt.findMany({
            where: { quizId },
            include: {
                student: { select: { name: true, email: true } }
            },
            orderBy: { score: 'desc' }
        });

        const leaderboard = attempts.map((a, idx) => ({
            rank: idx + 1,
            name: a.student.name || "Student",
            email: a.student.email,
            score: a.score,
            isFinished: a.isFinished
        }));

        return { success: true, leaderboard };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to get leaderboard" };
    }
}