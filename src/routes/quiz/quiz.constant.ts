
import T from 'typebox'

export const STRUCTURED_OUTPUT_V1 = (amount: number) => T.Object({
    name: T.String({
        description: "name of the quiz"
    }),
    emoji: T.Array(
        T.Object({
            emoji: T.String({
                description: "single emoji",
            }),
            category: T.String({
                description: "one word as a name of the category"
            })
        }), {
        description: "list of emoji that represent categories of the quiz",
        minItems: 2,
        maxItems: 3
    }),
    description: T.String({
        description: "description of the quiz"
    }),
    questions: T.Array(T.Object({
        title: T.String({
            description: "question title"
        }),
        options: T.Array(T.Object({
            text: T.String(),
            is_correct: T.Boolean()
        }))
    }), {
        minItems: amount,
        maxItems: amount
    })
})

export const TEMPLATE_BINARY_QUESTION = () => {
    return String.raw`
Your task is to generate True/False questions for an exam for university students.

Requirements:

- The test must have a name.

- Questions must test conceptual understanding of the learner.

- Use clear, concise, and unambiguous language.

- Each question should have only one correct True/False answer.

- Provide the correct answer after each question.`.trim()
}