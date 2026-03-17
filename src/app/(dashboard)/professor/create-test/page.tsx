"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createQuizAction } from "@/actions/professor";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Save, Clock, HelpCircle, Upload, X, FileJson } from "lucide-react";

type QuestionType = "SINGLE_CORRECT" | "MULTI_CORRECT" | "FILL_IN_BLANK" | "INTEGER_TYPE" | "DESCRIPTIVE";

interface Option {
    text: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    text: string;
    imageUrl?: string;
    type: QuestionType;
    timeLimit: number; // Value input by professor
    timeUnit: "SECONDS" | "MINUTES"; // Added unit selector
    marks: number;
    negative: number;
    correctAnswer?: string;
    options: Option[];
}

export default function CreateTestPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [quizMode, setQuizMode] = useState<"NORMAL" | "LIVE_GUIDED">("LIVE_GUIDED");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    // Initial Hydration from Setup Draft
    useEffect(() => {
        setIsMounted(true);
        const savedDraft = localStorage.getItem("quiz_draft_state");
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.title) setTitle(parsed.title);
                if (parsed.description) setDescription(parsed.description);
                if (parsed.startTime) setStartTime(parsed.startTime);
                if (parsed.endTime) setEndTime(parsed.endTime);
                if (parsed.quizMode) setQuizMode(parsed.quizMode);
                if (parsed.questions && Array.isArray(parsed.questions)) setQuestions(parsed.questions);
                // Optionally notify that draft was loaded
                toast.success("Draft restored automatically!");
            } catch (error) {
                console.error("Failed to parse draft state:", error);
            }
        }
    }, []);

    // Continuous Autosave
    useEffect(() => {
        if (isMounted) {
            const draftData = { title, description, startTime, endTime, quizMode, questions };
            localStorage.setItem("quiz_draft_state", JSON.stringify(draftData));
        }
    }, [title, description, startTime, endTime, quizMode, questions, isMounted]);

    const addQuestion = () => {
        const newQuestion: Question = {
            id: Math.random().toString(36).substr(2, 9),
            text: "",
            type: "SINGLE_CORRECT",
            timeLimit: 60,
            timeUnit: "SECONDS",
            marks: 4,
            negative: 1,
            options: [
                { text: "", isCorrect: true },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
            ],
        };
        setQuestions([...questions, newQuestion]);
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter((q) => q.id !== id));
    };

    const updateQuestion = (id: string, field: keyof Question, value: any) => {
        setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
    };

    // 🔥 IMAGE UPLOAD LOGIC (Local Device to Base64)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (optional, limit to ~2MB to save DB space)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("File size is too large! Please upload under 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                updateQuestion(questionId, "imageUrl", reader.result as string); // Base64 string set kar rahe hain
            };
            reader.readAsDataURL(file);
        }
    };

    const addOption = (questionId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return { ...q, options: [...q.options, { text: "", isCorrect: false }] };
            }
            return q;
        }));
    };

    const removeOption = (questionId: string, optionIndex: number) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) };
            }
            return q;
        }));
    };

    // 🔥 JSON IMPORT LOGIC
    const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                // Validate structure
                if (!json.questions || !Array.isArray(json.questions) || json.questions.length === 0) {
                    toast.error("Invalid JSON: 'questions' array is required and must not be empty.");
                    return;
                }

                // Auto-fill title/description if present
                if (json.title && !title) setTitle(json.title);
                if (json.description && !description) setDescription(json.description);

                // Parse questions
                const importedQuestions: Question[] = json.questions.map((q: any) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    text: q.text || "",
                    imageUrl: q.imageUrl || undefined,
                    type: q.type || "SINGLE_CORRECT",
                    timeLimit: q.timeLimit || 60,
                    timeUnit: (q.timeUnit as "SECONDS" | "MINUTES") || "SECONDS",
                    marks: q.marks ?? 4,
                    negative: q.negative ?? 1,
                    correctAnswer: q.correctAnswer || undefined,
                    options: q.options?.map((opt: any) => ({
                        text: opt.text || "",
                        isCorrect: opt.isCorrect || false
                    })) || [
                            { text: "", isCorrect: true },
                            { text: "", isCorrect: false },
                            { text: "", isCorrect: false },
                            { text: "", isCorrect: false },
                        ]
                }));

                // Merge or replace?
                if (questions.length > 0) {
                    const shouldReplace = confirm(
                        `You already have ${questions.length} question(s). Replace them with ${importedQuestions.length} imported questions?\n\nClick OK to Replace, Cancel to Merge (append).`
                    );
                    if (shouldReplace) {
                        setQuestions(importedQuestions);
                    } else {
                        setQuestions([...questions, ...importedQuestions]);
                    }
                } else {
                    setQuestions(importedQuestions);
                }

                toast.success(`✅ Imported ${importedQuestions.length} questions successfully!`);
            } catch (err) {
                toast.error("Failed to parse JSON file. Please check the format.");
                console.error("JSON Parse Error:", err);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be imported again
        e.target.value = "";
    };

    const handleSubmit = async () => {
        if (!title || !startTime || !endTime) return toast.error("Please fill title and timings!");
        if (questions.length === 0) return toast.error("Please add at least one question!");
        if (new Date(endTime) <= new Date(startTime)) return toast.error("End time must be after start time!");

        // Anti-Mistake: Prevent 0 time limit
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].timeLimit || questions[i].timeLimit <= 0) {
                return toast.error(`Question ${i + 1} cannot have a time limit of 0!`);
            }
        }

        setIsSubmitting(true);

        // Convert to strictly seconds for backend purely
        const processedQuestions = questions.map((q) => ({
            ...q,
            timeLimit: q.timeUnit === "MINUTES" ? q.timeLimit * 60 : q.timeLimit,
        }));

        const quizData = { title, description, startTime, endTime, quizMode, questions: processedQuestions };

        const result = await createQuizAction(quizData);

        if (result.success) {
            localStorage.removeItem("quiz_draft_state"); // Clean draft on success
            toast.success(`Quiz Created! Join Code: ${result.code}`);
            setTimeout(() => router.push("/professor"), 2000);
        } else {
            toast.error(result.error);
        }
        setIsSubmitting(false);
    };

    return (
        <div className="max-w-4xl mx-auto pb-20 px-4 md:px-0 mt-4 md:mt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create New Test</h1>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* JSON Import Button */}
                    <div className="relative">
                        <input
                            type="file"
                            accept=".json,application/json"
                            id="json-import-input"
                            className="hidden"
                            onChange={handleJsonImport}
                        />
                        <label htmlFor="json-import-input">
                            <Button type="button" variant="outline" className="gap-2 cursor-pointer w-full border-purple-200 text-purple-700 hover:bg-purple-50" asChild>
                                <span><FileJson className="h-4 w-4" /> Import JSON</span>
                            </Button>
                        </label>
                    </div>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 gap-2">
                        {isSubmitting ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
                        {isSubmitting ? "Saving..." : "Save & Generate Code"}
                    </Button>
                </div>
            </div>

            <div className="space-y-6 md:space-y-8">

                <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm space-y-4">
                    <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-500" /> Basic Details
                    </h2>
                    <Separator />
                    <div className="space-y-2">
                        <Label>Quiz Title <span className="text-red-500">*</span></Label>
                        <Input placeholder="e.g. Mid-Sem Data Structures" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Start Time <span className="text-red-500">*</span></Label>
                            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time <span className="text-red-500">*</span></Label>
                            <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Quiz Mode</Label>
                            <Select value={quizMode} onValueChange={(val: any) => setQuizMode(val)}>
                                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LIVE_GUIDED">Live Guided (Menti-style)</SelectItem>
                                    <SelectItem value="NORMAL">Standard Exam</SelectItem>

                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-500" /> Questions ({questions.length})
                    </h2>

                    {questions.map((q, index) => (
                        <div key={q.id} className="bg-white p-4 md:p-6 rounded-xl border shadow-sm relative">

                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2 md:border-none md:pb-0 gap-4">
                                <Label className="text-base md:text-lg font-semibold text-gray-800">Question {index + 1}</Label>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 w-full md:w-auto" onClick={() => removeQuestion(q.id)}>
                                    <Trash2 className="h-4 w-4 md:mr-2" />
                                    <span className="hidden md:inline">Delete</span>
                                </Button>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 mb-4">
                                <div className="flex-1 space-y-4">
                                    <Textarea
                                        placeholder="Write your question here..."
                                        value={q.text}
                                        onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                                        className="min-h-[100px] text-base"
                                    />

                                    {/* 🔥 NEW IMAGE UPLOAD SECTION */}
                                    <div>
                                        {!q.imageUrl ? (
                                            <div>
                                                {/* Hidden file input, clicked via label */}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    id={`image-upload-${q.id}`}
                                                    className="hidden"
                                                    onChange={(e) => handleImageUpload(e, q.id)}
                                                />
                                                <Label
                                                    htmlFor={`image-upload-${q.id}`}
                                                    className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors"
                                                >
                                                    <Upload className="h-4 w-4" /> Upload Image
                                                </Label>
                                            </div>
                                        ) : (
                                            <div className="relative inline-block mt-2 border rounded-md p-1 bg-gray-50">
                                                {/* Image Preview */}
                                                <img src={q.imageUrl} alt="Question Diagram" className="h-32 object-contain rounded-sm" />
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute -top-3 -right-3 h-6 w-6 rounded-full shadow-md"
                                                    onClick={() => updateQuestion(q.id, "imageUrl", undefined)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className="w-full md:w-64 space-y-4 bg-gray-50 p-4 rounded-lg md:bg-transparent md:p-0 border md:border-none">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase font-bold">Type</Label>
                                        <Select value={q.type} onValueChange={(val) => updateQuestion(q.id, "type", val)}>
                                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SINGLE_CORRECT">Single Correct</SelectItem>
                                                <SelectItem value="MULTI_CORRECT">Multi Correct</SelectItem>
                                                <SelectItem value="FILL_IN_BLANK">Fill in the Blank</SelectItem>
                                                <SelectItem value="INTEGER_TYPE">Integer Type</SelectItem>
                                                <SelectItem value="DESCRIPTIVE">Descriptive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2 col-span-2">
                                            <Label className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Time Limit</Label>
                                            <div className="flex gap-2">
                                                <Input type="number" className="bg-white flex-1" value={q.timeLimit} onChange={(e) => updateQuestion(q.id, "timeLimit", parseInt(e.target.value) || 0)} />
                                                <Select value={q.timeUnit || "SECONDS"} onValueChange={(val) => updateQuestion(q.id, "timeUnit", val)}>
                                                    <SelectTrigger className="w-[120px] bg-white text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SECONDS">Seconds</SelectItem>
                                                        <SelectItem value="MINUTES">Minutes</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-gray-500 uppercase font-bold">Marks (+)</Label>
                                            <Input type="number" min="0" className="bg-white" value={q.marks} onChange={(e) => updateQuestion(q.id, "marks", Math.abs(parseInt(e.target.value) || 0))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-gray-500 uppercase font-bold">Negative (-)</Label>
                                            <Input type="number" min="0" className="bg-white" value={q.negative} onChange={(e) => updateQuestion(q.id, "negative", Math.abs(parseInt(e.target.value) || 0))} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Options... */}
                            {(q.type === "SINGLE_CORRECT" || q.type === "MULTI_CORRECT") && (
                                <div className="space-y-3 mt-4 bg-gray-50 p-4 rounded-lg border">
                                    <Label className="text-sm font-medium text-gray-700">Options (Tick correct ones)</Label>
                                    <div className="space-y-2">
                                        {q.options.map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-center gap-3 bg-white p-2 rounded-md border focus-within:border-blue-400 transition-all group">
                                                <input
                                                    type={q.type === "SINGLE_CORRECT" ? "radio" : "checkbox"}
                                                    name={`correct-${q.id}`}
                                                    checked={opt.isCorrect}
                                                    onChange={() => {
                                                        const newOptions = [...q.options];
                                                        if (q.type === "SINGLE_CORRECT") newOptions.forEach(o => o.isCorrect = false);
                                                        newOptions[optIdx].isCorrect = !newOptions[optIdx].isCorrect;
                                                        updateQuestion(q.id, "options", newOptions);
                                                    }}
                                                    className="h-4 w-4 ml-1 cursor-pointer accent-blue-600 shrink-0"
                                                />
                                                <Input
                                                    placeholder={`Option ${optIdx + 1}`}
                                                    value={opt.text}
                                                    onChange={(e) => {
                                                        const newOptions = [...q.options];
                                                        newOptions[optIdx].text = e.target.value;
                                                        updateQuestion(q.id, "options", newOptions);
                                                    }}
                                                    className="border-none shadow-none focus-visible:ring-0 flex-1 h-8"
                                                />
                                                {q.options.length > 2 && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => removeOption(q.id, optIdx)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {q.options.length < 6 && (
                                        <Button variant="ghost" size="sm" onClick={() => addOption(q.id)} className="text-blue-600 hover:bg-blue-50 mt-2 text-xs">
                                            + Add Option
                                        </Button>
                                    )}
                                </div>
                            )}

                            {(q.type === "FILL_IN_BLANK" || q.type === "INTEGER_TYPE") && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg space-y-2">
                                    <Label className="text-sm font-semibold text-green-800">Correct Answer (For Auto-Evaluation)</Label>
                                    <Input
                                        type={q.type === "INTEGER_TYPE" ? "number" : "text"}
                                        placeholder={q.type === "INTEGER_TYPE" ? "e.g. 42" : "e.g. O(n log n)"}
                                        value={q.correctAnswer || ""}
                                        onChange={(e) => updateQuestion(q.id, "correctAnswer", e.target.value)}
                                        className="bg-white border-green-200 focus-visible:ring-green-400"
                                    />
                                </div>
                            )}
                        </div>
                    ))}

                    <Button onClick={addQuestion} variant="outline" className="w-full py-6 md:py-8 border-dashed border-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 gap-2 transition-all text-gray-500">
                        <PlusCircle className="h-5 w-5" /> Add New Question
                    </Button>
                </div>
            </div>
        </div>
    );
}