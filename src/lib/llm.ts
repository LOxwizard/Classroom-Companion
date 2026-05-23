import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

export class LLMService {
  provider: string;
  openAIClient: OpenAI | null = null;
  geminiClient: GoogleGenAI | null = null;

  constructor(provider: string = 'openai') {
    this.provider = provider;
    if (provider === 'openai') {
      this.openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else if (provider === 'gemini') {
      this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  async parseIntent(message: string): Promise<any> {
   const systemPrompt = `You are a strict data extraction assistant. 
    Analyze the user's message and return a JSON object with a "type" key (ASSIGN_WORK, STATUS_UPDATE, or UNKNOWN).
    
    IF the type is ASSIGN_WORK:
    - "studentName": The name of the student.
    - "description": The actual task.
    - "deadlineDays": Integer of days from today.

    IF the type is STATUS_UPDATE:
    - "status": MUST be either "COMPLETED" or "STUCK".
    
    Return ONLY valid JSON.`;
    if (this.provider === 'openai' && this.openAIClient) {
      const response = await this.openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content || '{}');
    } 
    
    if (this.provider === 'gemini' && this.geminiClient) {
      const response = await this.geminiClient.models.generateContent({
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