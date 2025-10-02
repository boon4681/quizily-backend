import prisma from '../lib/prisma.js'
import { extractTextFromPdf } from '../lib/pdf.js'
import { generateQuizFromText, type GeneratedQuiz, type QuestionType } from '../lib/gemini.js'
import type { Prisma } from '@prisma/client'

type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'

export type GenerateQuizInput = {
  ownerId: string
  title?: string
  description?: string
  text?: string
  pdfBuffer?: Buffer
  questionCount?: number
  difficulty?: Difficulty
  questionType?: QuestionType
  modelId?: string
}

const quizWithQuestionsInclude = {
  questions: { include: { options: true } },
} as const

type QuizWithQuestions = Prisma.QuizGetPayload<{ include: typeof quizWithQuestionsInclude }>
type QuizOption = QuizWithQuestions['questions'][number]['options'][number]
type GeneratedQuestion = GeneratedQuiz['questions'][number]
type GeneratedOption = GeneratedQuestion['options'][number]
type OptionCreateInput = { text: string; isCorrect: boolean }
type QuestionCreateInput = {
  text: string
  type: QuizWithQuestions['questions'][number]['type']
  order: number
  options: { create: OptionCreateInput[] }
}
type SanitizedOption = { id: string; text: string }
type SanitizedQuestion = {
  id: string
  text: string
  type: QuizWithQuestions['questions'][number]['type']
  order: number
  options: SanitizedOption[]
}
type SanitizedQuiz = Omit<QuizWithQuestions, 'questions'> & { questions: SanitizedQuestion[] }
type QuizAnswer = { questionId: string; optionId: string | null; optionText: string | null }

export async function generateQuizService(input: GenerateQuizInput) {
  const {
    ownerId,
    title,
    description,
    text,
    pdfBuffer,
    questionCount = 5,
    difficulty = 'BEGINNER',
    questionType,
    modelId,
  } = input

  const sourceText = await ensureSourceText(text, pdfBuffer)

  const generatedQuiz = await generateQuizFromText({
    text: sourceText,
    title,
    description,
    questionCount,
    difficulty,
    questionType,
    modelId,
  })

  const quizData = buildQuizCreateData(ownerId, generatedQuiz)
  const createdQuiz = await prisma.quiz.create({
    data: quizData,
    include: quizWithQuestionsInclude,
  })

  return createdQuiz
}

export async function getQuizService(id: string, includeAnswers = false) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: quizWithQuestionsInclude,
  })
  if (!quiz) {
    return null
  }

  const sanitizedQuiz = sanitizeQuizForResponse(quiz)
  if (!includeAnswers) {
    return { quiz: sanitizedQuiz }
  }

  const answers = listCorrectAnswers(quiz)
  return { quiz: sanitizedQuiz, answers }
}

export async function updateQuizService(params: {
  id: string
  ownerId: string
  title?: string
  description?: string
}) {
  const { id, ownerId, title, description } = params
  const quiz = await prisma.quiz.findUnique({ where: { id } })
  if (!quiz) {
    throw new Error('Quiz not found')
  }
  if (quiz.ownerId !== ownerId) {
    throw new Error('Forbidden: not the owner')
  }

  const updates = collectUpdatableFields(title, description)
  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const updatedQuiz = await prisma.quiz.update({
    where: { id },
    data: updates,
    include: quizWithQuestionsInclude,
  })
  return updatedQuiz
}

export async function deleteQuizService(id: string, ownerId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id } })
  if (!quiz) {
    throw new Error('Quiz not found')
  }
  if (quiz.ownerId !== ownerId) {
    throw new Error('Forbidden: not the owner')
  }

  await prisma.quiz.delete({ where: { id } })
  return { deleted: true, id }
}

async function ensureSourceText(rawText?: string, pdfBuffer?: Buffer) {
  const textContent = await resolveText(rawText, pdfBuffer)
  if (textContent.trim()) {
    return textContent
  }
  throw new Error('No text content found to generate quiz')
}

async function resolveText(rawText?: string, pdfBuffer?: Buffer) {
  if (rawText && rawText.trim()) {
    return rawText
  }

  if (pdfBuffer) {
    return await extractTextFromPdf(pdfBuffer)
  }

  return rawText ?? ''
}

function buildQuizCreateData(ownerId: string, generated: GeneratedQuiz) {
  return {
    title: generated.title,
    description: generated.description,
    ownerId,
    questions: {
      create: createQuestionsData(generated.questions),
    },
  }
}

function createQuestionsData(questions: GeneratedQuiz['questions']): QuestionCreateInput[] {
  const result: QuestionCreateInput[] = []
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    result.push(createQuestionData(question, index))
  }
  return result
}

function createQuestionData(question: GeneratedQuestion, index: number): QuestionCreateInput {
  return {
    text: question.text,
    type: question.type,
    order: index + 1,
    options: {
      create: createOptionsData(question.options),
    },
  }
}

function createOptionsData(options: GeneratedQuestion['options']): OptionCreateInput[] {
  const result: OptionCreateInput[] = []
  for (const option of options) {
    result.push(createOptionData(option))
  }
  return result
}

function createOptionData(option: GeneratedOption): OptionCreateInput {
  return { text: option.text, isCorrect: option.isCorrect }
}

function sanitizeQuizForResponse(quiz: QuizWithQuestions): SanitizedQuiz {
  const { questions, ...rest } = quiz
  const sanitizedQuestions: SanitizedQuestion[] = []
  for (const question of questions) {
    sanitizedQuestions.push(formatQuestionForClient(question))
  }
  return { ...rest, questions: sanitizedQuestions }
}

function formatQuestionForClient(question: QuizWithQuestions['questions'][number]): SanitizedQuestion {
  const options: SanitizedOption[] = []
  for (const option of question.options) {
    options.push({ id: option.id, text: option.text })
  }
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    order: question.order,
    options,
  }
}

function listCorrectAnswers(quiz: QuizWithQuestions): QuizAnswer[] {
  const answers: QuizAnswer[] = []
  for (const question of quiz.questions) {
    const correctOption = findCorrectOption(question.options)
    answers.push({
      questionId: question.id,
      optionId: correctOption ? correctOption.id : null,
      optionText: correctOption ? correctOption.text : null,
    })
  }
  return answers
}

function findCorrectOption(options: QuizOption[]): QuizOption | null {
  for (const option of options) {
    if (option.isCorrect) {
      return option
    }
  }
  return null
}

function collectUpdatableFields(title?: string, description?: string) {
  const data: Record<string, string> = {}
  if (typeof title === 'string') {
    data.title = title
  }
  if (typeof description === 'string') {
    data.description = description
  }
  return data
}
