import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const openAIClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export class LLMService {
  static async parseIntent(message: string, provider: string = 'gemini'): Promise<any> {
   const systemPrompt = `You are a strict data extraction assistant. 
    Analyze the user's message and return a JSON object with a "type" key (ASSIGN_WORK, STATUS_UPDATE, SUBMIT_WORK, or UNKNOWN).
    
    IF the type is ASSIGN_WORK:
    - "studentName": The name of the student.
    - "description": The actual task.
    - "deadlineDays": Integer of days from today.
    
    IF the type is STATUS_UPDATE:
    - "status": MUST be either "COMPLETED" or "STUCK".

    IF the type is SUBMIT_WORK:
    - "submissionText": The actual text the user is submitting for their assignment.
    
    Return ONLY valid JSON.`;
    
    if (provider === 'openai' && openAIClient) {
      const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content || '{}');
    } 
    
    if (provider === 'gemini' && geminiClient) {
      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: message,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
        }
      });
      return JSON.parse(response.text || '{}');
    }

    return { type: 'UNKNOWN' };
  }
}