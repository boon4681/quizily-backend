import { PrismaClient } from "@prisma/client";
import type { Context } from "hono";

const prisma = new PrismaClient();

export const makeQuiz = async (c: Context) => {
  const body = await c.req.json<{ title: string; description?: string; owner: string }>();
  const { title, description, owner } = body;
  try {

    // check title or userId undefined
    if (!owner) {
        return c.json({ message: "userId are required" }, 400);
    }

    // เช็กว่าผู้ใช้มีอยู่จริง
    const user = await prisma.user.findUnique({
      where: { id: owner },
    });
    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    // create quiz
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        owner: {connect: {id: user.id}}
      }
    });

    return c.json({ message: "Quiz created", quizId: quiz.id});
  } catch (error) {
    console.error(error);
    return c.json({ message: "Internal server error" });
  }
};