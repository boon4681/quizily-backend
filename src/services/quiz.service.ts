import prisma from '../lib/prisma.js'
import { extractTextFromPdf } from '../lib/pdf.js'
import { generateQuizFromText } from '../lib/gemini.js'

type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'

export type GenerateQuizInput = {
  ownerId: string
  title?: string
  description?: string
  text?: string
  pdfBuffer?: Buffer
  questionCount?: number
  difficulty?: Difficulty
  modelId?: string
}

export async function generateQuizService(input: GenerateQuizInput) {
  const { ownerId, title, description, text: rawText, pdfBuffer, questionCount = 5, difficulty = 'BEGINNER', modelId } = input

  let text = rawText || ''
  if (!text && pdfBuffer) {
    text = await extractTextFromPdf(pdfBuffer)
  }
  if (!text || !text.trim()) {
    throw new Error('No text content found to generate quiz')
  }

  const generated = await generateQuizFromText({
    text,
    title,
    description,
    questionCount,
    difficulty,
    modelId,
  })

  const created = await prisma.quiz.create({
    data: {
      title: generated.title,
      description: generated.description,
      ownerId,
      questions: {
        create: generated.questions.map((q, idx) => ({
          text: q.text,
          type: q.type,
          order: idx + 1,
          options: {
            create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          },
        })),
      },
    },
    include: { questions: { include: { options: true } } },
  })

  return created
}

export async function getQuizService(id: string, includeAnswers = false) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: { include: { options: true } } },
  })
  if (!quiz) return null

  const sanitized = {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  }

  if (!includeAnswers) return { quiz: sanitized }

  const answers = quiz.questions.map((q) => {
    const correct = q.options.find((o) => o.isCorrect)
    return { questionId: q.id, optionId: correct?.id || null, optionText: correct?.text || null }
  })
  return { quiz: sanitized, answers }
}

export async function updateQuizService(params: { id: string; ownerId: string; title?: string; description?: string }) {
  const { id, ownerId, title, description } = params
  const quiz = await prisma.quiz.findUnique({ where: { id } })
  if (!quiz) throw new Error('Quiz not found')
  if (quiz.ownerId !== ownerId) throw new Error('Forbidden: not the owner')

  const data: Record<string, any> = {}
  if (typeof title === 'string') data.title = title
  if (typeof description === 'string') data.description = description
  if (Object.keys(data).length === 0) throw new Error('No fields to update')

  const updated = await prisma.quiz.update({
    where: { id },
    data,
    include: { questions: { include: { options: true } } },
  })
  return updated
}

export async function deleteQuizService(id: string, ownerId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id } })
  if (!quiz) throw new Error('Quiz not found')
  if (quiz.ownerId !== ownerId) throw new Error('Forbidden: not the owner')
  await prisma.quiz.delete({ where: { id } })
  return { deleted: true, id }
}

