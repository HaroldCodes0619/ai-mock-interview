import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
export const maxDuration = 60; // Increase Vercel timeout limit
import pdfParse from 'pdf-parse';

// Initialize the Groq Client
// Requires GROQ_API_KEY environment variable to be set
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = formData.get('action') as string;

    if (action === 'start') {
      const jobTitle = formData.get('jobTitle') as string;
      const file = formData.get('file') as File;
      const persona = formData.get('persona') as string || 'Standard Interviewer';
      
      let parsedText = '';
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (file.type === 'application/pdf') {
          const pdfData = await pdfParse(buffer);
          parsedText = pdfData.text;
        } else {
          parsedText = buffer.toString('utf-8');
        }
      }

      const prompt = `You are an expert interviewer and defense committee member. 
      Your persona is: ${persona}. You MUST strictly embody this persona in your tone and style.
      The candidate is applying for/defending: "${jobTitle}".
      Here is their background/context document:
      ---
      ${parsedText.substring(0, 5000)}
      ---
      Your objective is to ask them a rigorous, highly relevant interview question based on their document.
      RULES:
      1. ONLY ask ONE question. Do not provide a preamble. Do not answer it for them.
      2. Act completely in character as the "${persona}".
      3. The question should be challenging and specific to their provided context.
      
      You must return your response as a JSON object strictly matching this format:
      {
        "isComplete": false,
        "message": "Your question here."
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert interviewer and defense committee member. You must strictly output valid JSON.' },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.1-70b-versatile', // Use 70B for higher reliability with JSON
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.7,
      });

      const responseText = chatCompletion.choices[0]?.message?.content || '{}';
      let parsedData: any = {};
      try { parsedData = JSON.parse(responseText); } catch (e) { console.error("JSON parse error:", e); }
      const reply = parsedData.message || parsedData.reply || parsedData.question || parsedData.content || parsedData.response || "Could you tell me more about your background?";
      return NextResponse.json({ reply, isComplete: !!parsedData.isComplete });
    }

    if (action === 'chat') {
      const historyStr = formData.get('history') as string;
      const persona = formData.get('persona') as string || 'Standard Interviewer';
      const history = JSON.parse(historyStr);
      
      // Convert history to Groq format (role and content)
      const messages = history.map((msg: any) => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }));

      // Add strict instruction to the final system prompt or user message
      messages.push({
        role: 'user',
        content: `Based on my previous answer, ask me the NEXT logical interview question, OR conclude the interview if you feel we have covered enough depth based on the complexity of the topic.
        Strict rules: 
        - If asking a question, ask ONLY ONE question. Do not break character. 
        - If concluding, provide a brief concluding remark.
        
        You must return your response as a JSON object strictly matching this format:
        {
          "isComplete": boolean,
          "message": "Your question or concluding remark here."
        }`
      });

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert interviewer. You must strictly output valid JSON. Never include markdown.' },
          ...messages
        ],
        model: 'llama-3.1-70b-versatile',
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.7,
      });

      const responseText = chatCompletion.choices[0]?.message?.content || '{}';
      let parsedData: any = {};
      try { parsedData = JSON.parse(responseText); } catch (e) { console.error("JSON parse error:", e); }
      const reply = parsedData.message || parsedData.reply || parsedData.question || parsedData.content || parsedData.response || "Please continue.";
      return NextResponse.json({ reply, isComplete: !!parsedData.isComplete });
    }

    if (action === 'evaluate') {
      const historyStr = formData.get('history') as string;
      const jobTitle = formData.get('jobTitle') as string;
      const history = JSON.parse(historyStr);

      const transcript = history.map((msg: any) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
      
      const prompt = `You are an expert evaluator. Review the following interview transcript for the role/topic: "${jobTitle}".
      
      Transcript:
      ${transcript}

      You must provide a comprehensive evaluation using the following JSON structure exactly. DO NOT wrap it in markdown block quotes. Return ONLY the raw JSON object.
      {
        "grade": "A",
        "recommendation": "Overall actionable advice and next steps for the candidate to improve.",
        "metrics": {
          "clarity": 85,
          "relevance": 90,
          "completeness": 80
        },
        "feedback": [
          {
            "question": "The question asked",
            "userAnswer": "The user's answer",
            "aiCritique": "Your critique",
            "idealAnswer": "What an ideal answer would look like"
          }
        ]
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert evaluator. You must strictly output valid JSON matching the requested structure. Never include markdown block quotes or explanations.' },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.3-70b-versatile', // Use a smarter model for complex JSON evaluation
        response_format: { type: "json_object" }, // Enable Groq JSON mode
        max_tokens: 2500,
        temperature: 0.3,
      });

      const responseText = chatCompletion.choices[0]?.message?.content || '{}';
      const evaluation = JSON.parse(responseText);
      return NextResponse.json({ evaluation });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
