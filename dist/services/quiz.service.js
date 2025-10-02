import prisma from '../lib/prisma.js';
import { extractTextFromPdf } from '../lib/pdf.js';
import { generateQuizFromText } from '../lib/gemini.js';
const quizWithQuestionsInclude = {
    questions: { include: { options: true } },
};
export async function generateQuizService(input) {
    const { ownerId, title, description, text, pdfBuffer, questionCount = 5, difficulty = 'BEGINNER', questionType, modelId, } = input;
    const sourceText = await ensureSourceText(text, pdfBuffer);
    const generatedQuiz = await generateQuizFromText({
        text: sourceText,
        title,
        description,
        questionCount,
        difficulty,
        questionType,
        modelId,
    });
    const quizData = buildQuizCreateData(ownerId, generatedQuiz);
    const createdQuiz = await prisma.quiz.create({
        data: quizData,
        include: quizWithQuestionsInclude,
    });
    return createdQuiz;
}
export async function getQuizService(id, includeAnswers = false) {
    const quiz = await prisma.quiz.findUnique({
        where: { id },
        include: quizWithQuestionsInclude,
    });
    if (!quiz) {
        return null;
    }
    const sanitizedQuiz = sanitizeQuizForResponse(quiz);
    if (!includeAnswers) {
        return { quiz: sanitizedQuiz };
    }
    const answers = listCorrectAnswers(quiz);
    return { quiz: sanitizedQuiz, answers };
}
export async function updateQuizService(params) {
    const { id, ownerId, title, description } = params;
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) {
        throw new Error('Quiz not found');
    }
    if (quiz.ownerId !== ownerId) {
        throw new Error('Forbidden: not the owner');
    }
    const updates = collectUpdatableFields(title, description);
    if (Object.keys(updates).length === 0) {
        throw new Error('No fields to update');
    }
    const updatedQuiz = await prisma.quiz.update({
        where: { id },
        data: updates,
        include: quizWithQuestionsInclude,
    });
    return updatedQuiz;
}
export async function deleteQuizService(id, ownerId) {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) {
        throw new Error('Quiz not found');
    }
    if (quiz.ownerId !== ownerId) {
        throw new Error('Forbidden: not the owner');
    }
    await prisma.quiz.delete({ where: { id } });
    return { deleted: true, id };
}
async function ensureSourceText(rawText, pdfBuffer) {
    const textContent = await resolveText(rawText, pdfBuffer);
    if (textContent.trim()) {
        return textContent;
    }
    throw new Error('No text content found to generate quiz');
}
async function resolveText(rawText, pdfBuffer) {
    if (rawText && rawText.trim()) {
        return rawText;
    }
    if (pdfBuffer) {
        return await extractTextFromPdf(pdfBuffer);
    }
    return rawText ?? '';
}
function buildQuizCreateData(ownerId, generated) {
    return {
        title: generated.title,
        description: generated.description,
        ownerId,
        questions: {
            create: createQuestionsData(generated.questions),
        },
    };
}
function createQuestionsData(questions) {
    const result = [];
    for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        result.push(createQuestionData(question, index));
    }
    return result;
}
function createQuestionData(question, index) {
    return {
        text: question.text,
        type: question.type,
        order: index + 1,
        options: {
            create: createOptionsData(question.options),
        },
    };
}
function createOptionsData(options) {
    const result = [];
    for (const option of options) {
        result.push(createOptionData(option));
    }
    return result;
}
function createOptionData(option) {
    return { text: option.text, isCorrect: option.isCorrect };
}
function sanitizeQuizForResponse(quiz) {
    const { questions, ...rest } = quiz;
    const sanitizedQuestions = [];
    for (const question of questions) {
        sanitizedQuestions.push(formatQuestionForClient(question));
    }
    return { ...rest, questions: sanitizedQuestions };
}
function formatQuestionForClient(question) {
    const options = [];
    for (const option of question.options) {
        options.push({ id: option.id, text: option.text });
    }
    return {
        id: question.id,
        text: question.text,
        type: question.type,
        order: question.order,
        options,
    };
}
function listCorrectAnswers(quiz) {
    const answers = [];
    for (const question of quiz.questions) {
        const correctOption = findCorrectOption(question.options);
        answers.push({
            questionId: question.id,
            optionId: correctOption ? correctOption.id : null,
            optionText: correctOption ? correctOption.text : null,
        });
    }
    return answers;
}
function findCorrectOption(options) {
    for (const option of options) {
        if (option.isCorrect) {
            return option;
        }
    }
    return null;
}
function collectUpdatableFields(title, description) {
    const data = {};
    if (typeof title === 'string') {
        data.title = title;
    }
    if (typeof description === 'string') {
        data.description = description;
    }
    return data;
}
