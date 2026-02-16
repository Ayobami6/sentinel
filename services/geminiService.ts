
import { GoogleGenAI } from "@google/genai";
import { AppLog, WebLog } from "../types";

export const analyzeLogsWithAI = async (logs: (AppLog | WebLog)[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const logSample = JSON.stringify(logs.slice(0, 15));
  
  const prompt = `You are an expert SRE (Site Reliability Engineer). 
  Analyze the following logs from our monitoring tool and identify any potential issues, 
  patterns of failure, or performance bottlenecks. 
  Keep the analysis concise, bulleted, and professional.
  
  Logs:
  ${logSample}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating AI analysis. Please check your API configuration.";
  }
};
