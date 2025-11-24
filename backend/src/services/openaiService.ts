import OpenAI from 'openai';

// Initialize OpenAI client (will be null if API key not provided)
let openaiClient: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI service initialized');
} else {
  console.log('OpenAI API key not provided. Dialogue analysis will be unavailable.');
}

export interface DialogueAnalysis {
  translation: string;
  breakdown: {
    word: string;
    reading: string;
    meaning: string;
  }[];
  grammar_notes: string;
  context_notes: string;
}

interface PreviousDialogue {
  dialogue_text: string;
  translation: string;
}

/**
 * Analyze a Japanese dialogue using OpenAI API
 */
export async function analyzeDialogue(dialogueText: string, previousDialogues: PreviousDialogue[] = []): Promise<DialogueAnalysis> {
  if (!openaiClient) {
    throw new Error('OpenAI API is not configured. Please set OPENAI_API_KEY environment variable.');
  }

  let previousContext = '';
  if (previousDialogues.length > 0) {
    previousContext = '\n\n**PREVIOUS DIALOGUE CONTEXT:**\nThis dialogue continues from previous screenshots. Here is what was said before:\n\n';
    previousDialogues.forEach((prev, idx) => {
      previousContext += `[${idx + 1}] Japanese: ${prev.dialogue_text}\n    English: ${prev.translation}\n\n`;
    });
    previousContext += 'Use this context to understand references, pronouns, and the flow of conversation.\n';
  }

  const systemPrompt = `You are a Japanese language expert helping learners understand Japanese text from video games and visual novels.
${previousContext}
When given Japanese text, provide:
1. A natural English translation (considering the previous dialogue context if provided)
2. A word-by-word breakdown with readings (hiragana/katakana) and meanings
3. Grammar notes explaining any important grammar patterns
4. Context notes about formality, cultural nuances, or common usage, AND how this relates to previous dialogue if applicable

Respond in JSON format with this structure:
{
  "translation": "Full English translation",
  "breakdown": [
    {"word": "始めまして", "reading": "はじめまして", "meaning": "Nice to meet you (greeting)"},
    {"word": "性別", "reading": "せいべつ", "meaning": "gender, sex"},
    {"word": "は", "reading": "は", "meaning": "topic particle"},
    {"word": "どちら", "reading": "どちら", "meaning": "which (polite)"},
    {"word": "です", "reading": "です", "meaning": "to be (polite)"},
    {"word": "か", "reading": "か", "meaning": "question particle"}
  ],
  "grammar_notes": "Explanation of grammar patterns used",
  "context_notes": "Notes about formality, cultural context, and how this relates to previous dialogue"
}`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this Japanese text:\n\n${dialogueText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI API');
    }

    const analysis: DialogueAnalysis = JSON.parse(content);
    return analysis;
  } catch (error: any) {
    console.error('[OpenAI] Error analyzing dialogue:', error);
    throw new Error(`Failed to analyze dialogue: ${error.message}`);
  }
}

/**
 * Ask a follow-up question about a dialogue using context from the analysis
 */
export async function askAboutDialogue(
  dialogueText: string,
  translation: string,
  breakdown: any[],
  grammarNotes: string,
  contextNotes: string,
  question: string,
  chatHistory: { role: string; content: string }[]
): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API is not configured.');
  }

  const systemPrompt = `You are a Japanese language expert helping learners understand Japanese dialogue.

You have analyzed the following Japanese text:

**Original Text:** ${dialogueText}
**Translation:** ${translation}
**Word Breakdown:** ${JSON.stringify(breakdown, null, 2)}
**Grammar Notes:** ${grammarNotes}
**Context Notes:** ${contextNotes}

The user may ask you follow-up questions about this dialogue. Answer their questions based on this context. Be concise but thorough, and explain things in a way that helps them learn Japanese better.`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: question },
    ];

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content;
    if (!answer) {
      throw new Error('No response from OpenAI API');
    }

    return answer;
  } catch (error: any) {
    console.error('[OpenAI] Error answering question:', error);
    throw new Error(`Failed to answer question: ${error.message}`);
  }
}

/**
 * Check if OpenAI service is available
 */
export function isOpenAIAvailable(): boolean {
  return openaiClient !== null;
}

