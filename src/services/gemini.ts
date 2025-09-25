import { GoogleGenAI } from '@google/genai';
import type { Context } from 'hono'

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const genAI = async (c: Context) => {
  try {
      const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Help me generate words for city pop or synthpop album cover  ",
    });
    console.log(response.text);
    return c.json({ message: "Genmini generate", response: response.text });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Internal server error" });
  }
  
}