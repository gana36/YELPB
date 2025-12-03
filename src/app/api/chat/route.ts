import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';

// Initialize Gemini (no Firestore access here; this route is AI-only)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Define the tools for "The Lobbyist"
const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'propose_update',
        description: 'Propose a value for one of the three room slots (budget, cuisine, or vibe). This posts a proposal to the public timeline for all participants to see. Use this when you want to advocate for a specific choice on behalf of your user.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            target: {
              type: SchemaType.STRING,
              description: 'The slot to propose for: "budget", "cuisine", or "vibe"',
            },
            value: {
              type: SchemaType.STRING,
              description: 'The specific value to propose (e.g., "Thai", "$$$", "Rooftop bar")',
            },
            reason: {
              type: SchemaType.STRING,
              description: 'A persuasive reason for this proposal that will be shown to all participants',
            },
          },
          required: ['target', 'value', 'reason'],
        },
      },
      {
        name: 'lock_slot',
        description: 'Lock a slot in the manifest when there is clear consensus or the user explicitly confirms. This finalizes a decision. Use sparingly - only when the user confirms they want to lock it.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            target: {
              type: SchemaType.STRING,
              description: 'The slot to lock: "budget", "cuisine", or "vibe"',
            },
            value: {
              type: SchemaType.STRING,
              description: 'The value to lock in',
            },
          },
          required: ['target', 'value'],
        },
      },
    ],
  },
];

// Types for the request
interface ManifestSlot {
  value: string | null;
  locked: boolean;
}

interface RoomManifest {
  budget: ManifestSlot;
  cuisine: ManifestSlot;
  vibe: ManifestSlot;
}

interface UserProfile {
  diet?: string;
  maxBudget?: string;
}

interface RoomContext {
  manifest: RoomManifest;
  participants: { name: string; isHost?: boolean }[];
}

// Build dynamic system prompt based on room state
function buildSystemPrompt(
  userName: string,
  manifest: RoomManifest,
  userProfile: UserProfile,
  participantCount: number
): string {
  const budgetStatus = manifest.budget.locked
    ? `"${manifest.budget.value}" (🔒 LOCKED)`
    : manifest.budget.value
    ? `"${manifest.budget.value}" (proposed, not locked)`
    : 'OPEN - needs a proposal';

  const cuisineStatus = manifest.cuisine.locked
    ? `"${manifest.cuisine.value}" (🔒 LOCKED)`
    : manifest.cuisine.value
    ? `"${manifest.cuisine.value}" (proposed, not locked)`
    : 'OPEN - needs a proposal';

  const vibeStatus = manifest.vibe.locked
    ? `"${manifest.vibe.value}" (🔒 LOCKED)`
    : manifest.vibe.value
    ? `"${manifest.vibe.value}" (proposed, not locked)`
    : 'OPEN - needs a proposal';

  const openSlots = [
    !manifest.budget.locked && 'Budget',
    !manifest.cuisine.locked && 'Cuisine',
    !manifest.vibe.locked && 'Vibe',
  ].filter(Boolean);

  return `You are THE LOBBYIST - a cunning private strategist working exclusively for ${userName}.

═══════════════════════════════════════════
CURRENT ROOM STATUS (${participantCount} participants)
═══════════════════════════════════════════
• Budget: ${budgetStatus}
• Cuisine: ${cuisineStatus}  
• Vibe: ${vibeStatus}

SLOTS REMAINING: ${openSlots.length > 0 ? openSlots.join(', ') : 'ALL LOCKED - GAME COMPLETE'}

═══════════════════════════════════════════
YOUR CLIENT'S PRIVATE CONSTRAINTS
═══════════════════════════════════════════
• Dietary Restrictions: ${userProfile.diet || 'None specified'}
• Budget Preference: ${userProfile.maxBudget || 'Flexible'}

═══════════════════════════════════════════
YOUR STRATEGIC DIRECTIVES
═══════════════════════════════════════════

1. **ADVOCATE**: When a slot is OPEN, propose values that align with ${userName}'s preferences. Use the \`propose_update\` tool to post persuasive proposals.

2. **PROTECT**: If another proposal conflicts with ${userName}'s dietary needs or budget, privately warn them and suggest a counter-proposal.

3. **CLOSE DEALS**: When ${userName} says "lock it", "confirm", or clearly agrees, use \`lock_slot\` to finalize.

4. **BE STRATEGIC**: Frame proposals to appeal to the whole group, not just ${userName}. "Great for sharing" beats "I want this".

5. **BE CONCISE**: No fluff. Short, punchy responses. You're a strategist, not a chatbot.

REMEMBER: This conversation is PRIVATE. The group only sees what you post via tools. Help ${userName} win.`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, roomId, roomContext, userName, userProfile } = await request.json();

    if (!message || !roomId) {
      return NextResponse.json(
        { error: 'Missing message or roomId' },
        { status: 400 }
      );
    }

    // Default manifest structure if not provided
    const manifest: RoomManifest = roomContext?.manifest || {
      budget: { value: null, locked: false },
      cuisine: { value: null, locked: false },
      vibe: { value: null, locked: false },
    };

    // Build dynamic system prompt
    const systemPrompt = buildSystemPrompt(
      userName || 'Guest',
      manifest,
      userProfile || {},
      roomContext?.participants?.length || 1
    );

    // Initialize the model with tools
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      tools,
      systemInstruction: systemPrompt,
    });

    // Send message to Gemini
    const result = await model.generateContent(message);
    const response = result.response;

    // Check for function calls
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const toolResults: string[] = [];
      const toolCalls: { name: string; args: unknown }[] = [];

      for (const call of functionCalls) {
        if (call.name === 'propose_update') {
          const { target, value, reason } = call.args as {
            target: string;
            value: string;
            reason: string;
          };

          // Defer Firestore writes to the client – just return the tool call
          toolCalls.push({
            name: 'propose_update',
            args: { target, value, reason },
          });

          toolResults.push(`📢 Proposed ${target}: "${value}"`);
        } else if (call.name === 'lock_slot') {
          const { target, value } = call.args as { target: string; value: string };

          toolCalls.push({
            name: 'lock_slot',
            args: { target, value },
          });

          toolResults.push(`🔒 Locked ${target}: "${value}"`);
        }
      }

      // Get the text response if any
      let textResponse = '';
      try {
        textResponse = response.text();
      } catch {
        // No text response, just tool calls
      }

      return NextResponse.json({
        success: true,
        message: textResponse || 'Done.',
        toolsExecuted: toolResults,
        toolCalls,
      });
    }

    // No function calls, just return the text
    const textResponse = response.text();

    return NextResponse.json({
      success: true,
      message: textResponse,
      toolsExecuted: [],
      toolCalls: [],
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: String(error) },
      { status: 500 }
    );
  }
}
