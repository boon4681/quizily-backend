import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import './env.js'

// Schemas
export const QuizOptionSchema = z.object({ text: z.string().min(1), isCorrect: z.boolean() })
export const QuizQuestionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE']).default('MULTIPLE_CHOICE'),
  options: z.array(QuizOptionSchema).min(2),
})
export const GeneratedQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(QuizQuestionSchema).min(1),
})
export type GeneratedQuiz = z.infer<typeof GeneratedQuizSchema>
export type QuestionType = z.infer<typeof QuizQuestionSchema>['type']

type GeneratedQuestion = GeneratedQuiz['questions'][number]

// Helpers
function getApiKey() {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('Missing GEMINI_API_KEY environment variable')
  return k
}
function extractFirstJson(text: string): string {
  const fence = text.match(/```(?:json)?\n([\s\S]*?)\n```/i)
  if (fence) return fence[1]
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  return s !== -1 && e !== -1 && e > s ? text.slice(s, e + 1) : text
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const retriable = (m: string) => /503|429|overloaded|rate|quota/i.test(m)

async function generateWithRetry(genAI: GoogleGenerativeAI, models: string[], prompt: string) {
  let last: any
  for (const model of models) {
    for (let i = 0; i < 2; i++) {
      try {
        return await genAI.getGenerativeModel({ model }).generateContent(prompt)
      } catch (e: any) {
        last = e
        if (!retriable(String(e?.message || '')) || i === 1) break
        await sleep(700 * (i + 1))
      }
    }
  }
  throw last
}

function chunk(text: string, size = 8000, overlap = 500) {
  if (text.length <= size) return [text]
  const out: string[] = []
  let p = 0
  while (p < text.length) {
    const end = Math.min(p + size, text.length)
    out.push(text.slice(p, end))
    if (end === text.length) break
    p = Math.max(0, end - overlap)
  }
  return out
}

async function summarizeIfLarge(genAI: GoogleGenerativeAI, models: string[], text: string) {
  const MAX_DIRECT = 20000
  if (text.length <= MAX_DIRECT) return text
  const bullets: string[] = []
  const Notes = z.array(z.string().min(3))
  for (const [i, ch] of chunk(text).entries()) {
    const prompt = [
      'Summarize key facts/definitions/takeaways for quiz creation.',
      'Return ONLY a JSON array of 6-10 short strings (<=160 chars).',
      `Chunk ${i + 1}.`,
      'Content:',
      ch,
    ].join('\n')
    const res = await generateWithRetry(genAI, models, prompt)
    const arr = Notes.parse(JSON.parse(extractFirstJson(res.response.text())))
    for (const n of arr) if (!bullets.includes(n)) bullets.push(n)
    if (bullets.length >= 80) break
  }
  return 'Key points for quiz generation:\n' + bullets.slice(0, 80).map((b) => `- ${b}`).join('\n')
}

function buildQuestionTypeInstructions(questionType?: QuestionType) {
  if (questionType === 'TRUE_FALSE') {
    return [
      'Every question must be TRUE_FALSE.',
      'Each TRUE_FALSE question must present the statement with exactly two options: "True" and "False".',
    ]
  }
  if (questionType === 'MULTIPLE_CHOICE') {
    return [
      'Every question must be MULTIPLE_CHOICE.',
      'Each MULTIPLE_CHOICE question must have 3-5 answer options with exactly one correct answer.',
    ]
  }
  return [
    'Prefer MULTIPLE_CHOICE; TRUE_FALSE only when fitting.',
    'Each MULTIPLE_CHOICE question must have 3-5 options with exactly one correct answer.',
  ]
}

function normalizeQuestion(question: GeneratedQuestion, forcedType?: QuestionType): GeneratedQuestion {
  const base =
    question.type === 'TRUE_FALSE'
      ? normalizeTrueFalseQuestion(question)
      : normalizeMultipleChoiceQuestion(question)
  if (!forcedType || forcedType === base.type) {
    return base
  }
  return forcedType === 'TRUE_FALSE'
    ? normalizeTrueFalseQuestion(base)
    : normalizeMultipleChoiceQuestion(base)
}

function normalizeMultipleChoiceQuestion(question: GeneratedQuestion): GeneratedQuestion {
  const options =
    question.options.length > 0
      ? question.options
      : [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ]
  let correctIndex = options.findIndex((o) => o.isCorrect)
  if (correctIndex < 0) correctIndex = 0
  const normalizedOptions = options.map((o, idx) => ({ text: o.text, isCorrect: idx === correctIndex }))
  return {
    ...question,
    type: 'MULTIPLE_CHOICE',
    options: normalizedOptions,
  }
}

function normalizeTrueFalseQuestion(question: GeneratedQuestion): GeneratedQuestion {
  const correct = question.options.find((o) => o.isCorrect)
  const trueIsCorrect = correct ? /true/i.test(correct.text) : true
  return {
    ...question,
    type: 'TRUE_FALSE',
    options: [
      { text: 'True', isCorrect: trueIsCorrect },
      { text: 'False', isCorrect: !trueIsCorrect },
    ],
  }
}

// Main
export async function generateQuizFromText(params: {
  text: string
  title?: string
  description?: string
  questionCount?: number
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'
  modelId?: string
  questionType?: QuestionType
}): Promise<GeneratedQuiz> {
  const {
    text,
    title,
    description,
    questionCount = 5,
    difficulty = 'BEGINNER',
    modelId,
    questionType,
  } = params
  const genAI = new GoogleGenerativeAI(getApiKey())
  const models = [
    modelId?.trim(),
    process.env.GEMINI_MODEL_ID?.trim(),
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ].filter(Boolean) as string[]

  const baseText = await summarizeIfLarge(genAI, models, text)
  const prompt = [
    'You are a quiz generator. Output ONLY JSON.',
    `Generate ${questionCount} questions. Difficulty: ${difficulty}.`,
    ...buildQuestionTypeInstructions(questionType),
    '{',
    '  "title": string,',
    '  "description": string (optional),',
    '  "questions": [',
    '    { "text": string, "type": "MULTIPLE_CHOICE" | "TRUE_FALSE", "options": [ { "text": string, "isCorrect": boolean } ] }',
    '  ]',
    '}',
    title ? `Use this title if it fits: ${title}` : '',
    description ? `Use/adjust this description: ${description}` : '',
    'Content to base the quiz on:',
    baseText,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await generateWithRetry(genAI, models, prompt)
  const jsonStr = extractFirstJson(res.response.text())
  const data = GeneratedQuizSchema.parse(JSON.parse(jsonStr))

  const normalized: GeneratedQuiz = {
    ...data,
    questions: data.questions.map((q) => normalizeQuestion(q, questionType)),
  }
  return normalized
}

