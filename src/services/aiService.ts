import { GoogleGenAI, Type } from "@google/genai";

let currentApiKey = '';
try {
  currentApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
} catch (e) {
  // Ignore error if import.meta is undefined
}

// Try to load from localStorage if available (client-side)
if (typeof window !== 'undefined') {
  const savedKey = localStorage.getItem('GEMINI_CUSTOM_API_KEY');
  if (savedKey) currentApiKey = savedKey;
}

let ai: GoogleGenAI | null = currentApiKey ? new GoogleGenAI({ apiKey: currentApiKey }) : null;

export const updateApiKey = (newKey: string) => {
  currentApiKey = newKey;
  ai = new GoogleGenAI({ apiKey: newKey });
  if (typeof window !== 'undefined') {
    localStorage.setItem('GEMINI_CUSTOM_API_KEY', newKey);
  }
};

export const getApiKey = () => currentApiKey;

export interface ComicScene {
  id: number;
  description: string;
  dialogue: string;
  imagePrompt: string;
}

export interface ComicData {
  title: string;
  characterDesign: string;
  scenes: ComicScene[];
}

export type EducationLevel = 'preschool' | 'elementary' | 'middle' | 'high' | 'general';

export const generateComicScript = async (userInput: string, panelCount: number, educationLevel: EducationLevel = 'general'): Promise<ComicData> => {
  const levelInstructions = {
    preschool: "For Preschoolers: Use very simple language, highly visual content, focus on shapes/colors/feelings, and use friendly characters.",
    elementary: "For Elementary Students: Use clear storytelling, basic vocabulary, and focus on fundamental concepts with relatable child characters.",
    middle: "For Middle Schoolers: Focus on logic, science, history, or teenage social dynamics. Use slightly more complex vocabulary and engaging narrative arcs.",
    high: "For High Schoolers: Deep dives into complex theories, historical events, or nuanced literature. Can use more mature/cool art styles and advanced vocabulary.",
    general: "General audience: Engaging and balanced comic style."
  }[educationLevel];

  if (!ai || !currentApiKey) throw new Error("API Key is not configured.");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ text: userInput }] }],
    config: {
      systemInstruction: `You are a professional comic book script writer and educational content designer. 
      Generate a JSON response for a comic book with exactly ${panelCount} panels (scenes).
      Target Audience: ${levelInstructions}
      
      The goal is to transform the provided lesson/lecture content into an engaging comic series that makes learning fun.
      
      - title: A catchy title in Vietnamese related to the lesson.
      - characterDesign: A detailed English description of the main character's appearance for image generation consistency. If educational, maybe a mascot or a student.
      - scenes: An array of scene objects.
        - id: Number 1 to ${panelCount}.
        - description: Scene description in Vietnamese, incorporating key educational points.
        - dialogue: Character dialogue in Vietnamese, explaining a concept or reacting to the lesson.
        - imagePrompt: A concise English prompt for image generation, focusing on action and background.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          characterDesign: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                description: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
              },
              required: ["id", "description", "dialogue", "imagePrompt"],
            },
          },
        },
        required: ["title", "characterDesign", "scenes"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const generatePanelImage = async (scenePrompt: string, characterDesign: string, retries = 3): Promise<string> => {
  const fullPrompt = `Comic book art style, professional coloring, vibrant, dynamic. Character design: ${characterDesign}. Scene: ${scenePrompt}`;
  
  if (!ai || !currentApiKey) throw new Error("API Key is not configured.");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        imageConfig: { aspectRatio: "1:1" },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data in response");
  } catch (err: any) {
    // Robust check for Rate Limit (429 / RESOURCE_EXHAUSTED)
    const isRateLimit = 
      err?.status === "RESOURCE_EXHAUSTED" || 
      err?.code === 429 || 
      JSON.stringify(err).includes("RESOURCE_EXHAUSTED") ||
      JSON.stringify(err).includes("429");

    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit (429), cooling down for 5 seconds... (${retries} retries left)`);
      // Exponential-ish backoff
      await new Promise(r => setTimeout(r, 5000));
      return generatePanelImage(scenePrompt, characterDesign, retries - 1);
    }
    throw err;
  }
};
