import { PrismaClient } from "@prisma/client";
import type { Context } from "hono";
import { nanoid } from 'nanoid';
import { success } from "zod";

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

export const getQuizLink = async (c: Context) => {
  const quizId = c.req.param('id');

  const shareToken = nanoid(10);

  const quiz = await prisma.quiz.update({
    where: { id: quizId },
    data: { shareToken }
  });

  const shareUrl = `http://localhost:3000/share/${shareToken}`;

  return c.json({success: true, shareUrl});
}

export const getQuiz = async (c: Context) => {

  try {
    const token = c.req.param('token');
    const quiz = await prisma.quiz.findFirst({
      where: {shareToken: token},
      select: {
        id: true,
        title: true,
        description: true,
        questions: true
      }
    })
    if (!quiz) {
      return c.json({ error: 'Invalid or expired link' }, 404)
    }

    return c.json({
      success: true,
      quiz,
    })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Server error' }, 500)
  }

}
