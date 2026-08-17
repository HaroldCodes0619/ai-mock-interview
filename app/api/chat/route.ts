import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
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
      3. The question should be challenging and specific to their provided context.`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.1-8b-instant', // Fast model for standard questions
      });

      return NextResponse.json({ reply: chatCompletion.choices[0]?.message?.content });
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
        content: `Based on my previous answer, ask me the NEXT logical interview question. Strict rule: Ask ONLY ONE question. Do not break character. You are embodying the persona of a ${persona}. Do not provide any preamble.`
      });

      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.1-8b-instant',
      });

      return NextResponse.json({ reply: chatCompletion.choices[0]?.message?.content });
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
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.1-70b-versatile', // Using larger model for advanced evaluation and json adherence
        response_format: { type: "json_object" }, // Enable Groq JSON mode
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
