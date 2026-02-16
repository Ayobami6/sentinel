
import { GoogleGenAI } from "@google/genai";
import { AppLog, WebLog } from "../types";

export const analyzeLogsWithAI = async (logs: (AppLog | WebLog)[], context: string) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const logSample = JSON.stringify(logs.slice(0, 20));

  const prompt = `You are an expert SRE (Site Reliability Engineer) monitoring a system called "Sentinel". 
  Analyze the following logs for the context: "${context}".
  Identify potential issues, performance bottlenecks, or security patterns. 
  
  Keep the analysis professional, using bullet points for key findings.
  If the logs are for a specific server, focus on that server's health.
  If the logs are for "All Servers", look for cross-fleet patterns.

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
    return "Error generating AI analysis. Please check your API configuration or network connection.";
  }
};
