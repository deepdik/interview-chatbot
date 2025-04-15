import OpenAI from "openai"

// Initialize the OpenAI client
let openai: OpenAI | null = null

// Initialize the OpenAI client if it hasn't been initialized yet
const getOpenAIClient = () => {
  if (!openai) {
    // Check if we're in a browser environment
    if (typeof window !== "undefined") {
      throw new Error("OpenAI client cannot be initialized in the browser")
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set")
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

// Call OpenAI with the given messages and system prompt
export async function callOpenAI(
  messages: { role: string; content: string }[],
  systemPrompt = "You are a helpful assistant.",
): Promise<string> {
  try {
    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."
  } catch (error) {
    console.error("Error calling OpenAI:", error)
    throw error
  }
}
