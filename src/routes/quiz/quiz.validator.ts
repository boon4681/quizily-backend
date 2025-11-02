import z, { string } from 'zod';

const FILE_VALIDATOR = z.instanceof(File).refine((file) => [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/svg+xml",
    "text/plain"
].includes(file.type), { message: "Invalid document file type" })

export const CREATE_QUIZ_BODY = z.union([
    z.object({
        type: z.literal(["binary", "multiple"]),
        amount: z.coerce.number().int().nonnegative().min(1).max(30),
        resource_type: z.literal("text"),
        content: z.string()
    }),
    z.object({
        type: z.literal(["binary", "multiple"]),
        amount: z.coerce.number().int().nonnegative().min(1).max(30),
        resource_type: z.literal("document"),
        files: z.union([
            FILE_VALIDATOR,
            z.array(FILE_VALIDATOR).min(1, "At least one file is required")
        ])
    })
])
export type CREATE_QUIZ_BODY = z.infer<typeof CREATE_QUIZ_BODY>

export const PATCH_QUIZ_SHARE_BODY = z.object({
    share: z.boolean()
})
export type PATCH_QUIZ_SHARE_BODY = z.infer<typeof PATCH_QUIZ_SHARE_BODY>


const QUESTION_OPTION_V1 = z.object({
    id: z.string(),
    text: z.string(),
})

const QUESTION_BODY_V1 = z.object({
    id: z.string(),
    type: z.literal(["multiple","binary"]),
    title: z.string(),
    choices: z.array(QUESTION_OPTION_V1),
    correct: z.string()
})

export const POST_QUIZ_SAVE_BODY = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    questions: z.array(QUESTION_BODY_V1).optional()
})
export type POST_QUIZ_SAVE_BODY = z.infer<typeof POST_QUIZ_SAVE_BODY>