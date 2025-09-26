export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'

export type IncomingGeneratePayload = {
  ownerId: string
  title?: string
  description?: string
  text?: string
  pdfBase64?: string
  questionCount?: number
  difficulty?: Difficulty
}

