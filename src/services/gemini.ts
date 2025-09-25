import { GoogleGenAI, Type } from '@google/genai';
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

export const generateQuiz = async (c: Context) => {

  try {
    const pdfResp = await fetch('https://discovery.ucl.ac.uk/id/eprint/10089234/1/343019_3_art_0_py4t4l_convrt.pdf')
        .then((response) => response.arrayBuffer());

    const contents = [
        { text: "Summarize this document and make a simple (easy) quiz for 5 quiz with 4 multiple choices and give a correct anwser by return correct anwser in response type (correct) follow with config" },
        {
            inlineData: {
                mimeType: 'application/pdf',
                data: Buffer.from(pdfResp).toString("base64")
            }
        }
    ];

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: {
                  type: Type.STRING,
                },
                answers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },
                correct: {
                  type: Type.STRING,
                },
              },
              propertyOrdering: ["question", "answers", "correct"],
            },
          },
        }   
    });
    console.log(response.text);
    return c.json({ message: "Genmini generate quiz", response: response.text });

  }
  catch (error) {
    console.error(error);
    return c.json({ message: "Internal server error" });
  }
}