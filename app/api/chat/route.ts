import { processResponse, getNodeMessage, loadScript, loadJobDescription } from "@/lib/script-loader"
import { callOpenAI } from "@/lib/openai"

// Allow responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Parse the request body
    let body
    try {
      body = await req.json()
    } catch (error) {
      console.error("Failed to parse request body:", error)
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { messages, currentNodeId, userData = {}, exampleAttempts = {} } = body

    // Add debugging near the beginning of the POST function
    console.log("Processing chat request with currentNodeId:", currentNodeId)
    console.log("Example attempts:", exampleAttempts)

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid messages format:", messages)
      return new Response(JSON.stringify({ error: "Messages must be an array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Load the script and job description
    let script
    let jobDescription
    try {
      script = loadScript()
      jobDescription = loadJobDescription()
    } catch (error) {
      console.error("Error loading script or job description:", error)
      // Use the hardcoded script from script-loader
      const { softwareEngineerScript } = await import("@/lib/script-loader")
      script = softwareEngineerScript
    }

    // Get the last user message
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()

    if (!lastUserMessage) {
      // If there's no user message, return the initial greeting
      const startNode = script.nodes[script.startNodeId]
      return new Response(
        JSON.stringify({
          role: "assistant",
          content: startNode.message,
          id: Date.now().toString(),
          nextNodeId: startNode.id,
          userData: {},
          endConversation: false,
          wasExamplePrompt: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    // Get current node information
    const nodeId = currentNodeId || script.startNodeId
    const currentNode = script.nodes[nodeId]

    if (!currentNode) {
      console.error(`Node ${nodeId} not found in script`)
      return new Response(
        JSON.stringify({
          role: "assistant",
          content: "I apologize, but I encountered an error with the interview script. Let's start over.",
          id: Date.now().toString(),
          nextNodeId: script.startNodeId,
          userData: {},
          endConversation: false,
          wasExamplePrompt: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const userResponse = lastUserMessage.content

    // Check if the user is asking a question about the company or role
    const isQuestion = userResponse.trim().endsWith("?")

    if (isQuestion) {
      // Use LLM to answer the question
      const questionPrompt = `
The candidate is asking the following question during a software engineering interview:
"${userResponse}"

Please provide a concise, professional answer based on the following job information:

Company: ${jobDescription.company}
Position: ${jobDescription.position}
Location: ${jobDescription.location}
Salary range: ${jobDescription.about.salary}
Work arrangement: Hybrid (2 days in office)
Tech stack: Python, Django, AWS, React, TypeScript, Next.js
Benefits: ${jobDescription.benefits.join(", ")}

If you don't have specific information to answer the question, say so politely without making up details.
Keep your answer concise and professional.
`

      try {
        const answer = await callOpenAI(
          [{ role: "user", content: questionPrompt }],
          "You are an AI assistant for a technical recruiter.",
        )

        // Return the answer but stay on the same node
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              answer || "I don't have specific information about that, but I'd be happy to discuss the role further.",
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      } catch (error) {
        console.error("Error getting answer from LLM:", error)
        // Fallback response
        return new Response(
          JSON.stringify({
            role: "assistant",
            content: "I don't have specific information about that, but I'd be happy to discuss the role further.",
            id: Date.now().toString(),
            nextNodeId: nodeId,
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
    }

    // Special handling for role selection nodes
    if (nodeId === "role-preference" || nodeId === "suggest-roles") {
      // Check for disinterest in all roles
      const disinterestPatterns = [
        "not interested",
        "not looking",
        "none",
        "neither",
        "nothing",
        "no",
        "nope",
        "not any",
        "not for me",
        "don't want",
        "dont want",
      ]

      const userResponseLower = userResponse.toLowerCase()

      const isDisinterested = disinterestPatterns.some((pattern) => {
        // Don't count "not sure" as disinterest
        if (
          userResponseLower === "not sure" ||
          userResponseLower.includes("not sure") ||
          userResponseLower.includes("don't know") ||
          userResponseLower.includes("dont know")
        ) {
          return false
        }
        return userResponseLower.includes(pattern) || userResponseLower === pattern
      })

      if (isDisinterested) {
        console.log("User expressed disinterest in all roles, ending conversation")
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              "I understand you're not interested in these roles. Thank you for your time and best of luck with your job search!",
            id: Date.now().toString(),
            nextNodeId: "end-not-interested",
            userData: userData,
            endConversation: true,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Check if the response is too vague for role selection
      const validRoles = ["backend", "frontend", "full stack", "fullstack"]
      const userResponseLower2 = userResponse.toLowerCase()

      // Check if the response contains any of the specific roles
      const hasSpecificRole = validRoles.some((role) => userResponseLower2.includes(role))

      // If the response just contains "developer" or similar without specifying which type
      const isVagueResponse =
        (userResponseLower2.includes("developer") ||
          userResponseLower2.includes("engineer") ||
          userResponseLower2 === "dev" ||
          userResponseLower2 === "development") &&
        !hasSpecificRole

      if (isVagueResponse) {
        console.log("User provided vague role response, asking for clarification")
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              "Could you please specify which type of developer role you're interested in? We have Backend Developer (Python/Django), Frontend Developer (React), or Full Stack Engineer positions available.",
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Original code for uncertainty
      if (nodeId === "role-preference") {
        const unsurePatterns = [
          "not sure",
          "don't know",
          "dont know",
          "unsure",
          "uncertain",
          "undecided",
          "haven't decided",
          "havent decided",
          "what options",
          "what positions",
          "what roles",
          "available roles",
        ]

        const isUnsure = unsurePatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))

        if (isUnsure) {
          console.log("User is unsure about role preference, suggesting roles")
          return new Response(
            JSON.stringify({
              role: "assistant",
              content: script.nodes["suggest-roles"].message,
              id: Date.now().toString(),
              nextNodeId: "suggest-roles",
              userData: userData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }
    }

    // Check for "no experience" with React specifically
    if (nodeId === "react-rating" || nodeId === "react-project") {
      const noReactPatterns = [
        "no experience with react",
        "never used react",
        "don't know react",
        "dont know react",
        "no knowledge of react",
        "not familiar with react",
        "haven't worked with react",
        "havent worked with react",
        "no react experience",
        "zero react",
        "0 react",
      ]

      const hasNoReactExperience = noReactPatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))

      if (hasNoReactExperience) {
        console.log("User has no React experience, skipping to debugging section")

        // Find the next non-React node
        const nextNonReactNode = "debugging-approach"

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: `I understand you don't have experience with React. Let's move on to another topic. ${script.nodes[nextNonReactNode].message}`,
            id: Date.now().toString(),
            nextNodeId: nextNonReactNode,
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
    }

    // Check for "no experience" or "don't know" responses
    const noExperiencePatterns = [
      "no experience",
      "haven't done",
      "hav't done",
      "haven't worked",
      "don't know",
      "dont know",
      "no idea",
      "not sure",
      "never done",
      "never worked",
      "not familiar",
      "sorry",
      "i can't",
      "i cant",
      "i don't have",
      "i dont have",
    ]

    const isNoExperienceResponse = noExperiencePatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))

    // Get the current example attempts for this node
    const currentAttempts = exampleAttempts[nodeId] || 0

    // If user indicates no experience or uncertainty and we're not on a critical node,
    // provide an example and ask for more details, but only if we haven't tried too many times
    if (
      isNoExperienceResponse &&
      !["name", "salary", "greeting", "role-preference", "suggest-roles"].includes(nodeId) &&
      currentNode.nextNodeId
    ) {
      console.log(`Detected 'no experience' response, attempt #${currentAttempts + 1}`)

      // If we've already tried once with an example, move on
      if (currentAttempts >= 1) {
        console.log("Already tried with examples, moving to next question")
        const nextNodeId = currentNode.nextNodeId
        const nextNodeMessage = getNodeMessage(script, nextNodeId, userData)

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: `I understand this isn't your area of expertise. Let's move on to the next question. ${nextNodeMessage}`,
            id: Date.now().toString(),
            nextNodeId: nextNodeId,
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Check if we have examples for this node
      if (currentNode.examples && currentNode.examples.length > 0) {
        const example = currentNode.examples[0]
        return new Response(
          JSON.stringify({
            role: "assistant",
            content: `I understand you might not be sure about this. Let me help with an example: "${example}". Could you try to share your thoughts on this topic?`,
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node
            userData: userData,
            endConversation: false,
            wasExamplePrompt: true, // Flag that this was an example prompt
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      } else {
        // If no examples, move to next question
        console.log("No examples available, moving to next question")
        const nextNodeId = currentNode.nextNodeId
        const nextNodeMessage = getNodeMessage(script, nextNodeId, userData)

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: `I understand. Let's move on to the next question. ${nextNodeMessage}`,
            id: Date.now().toString(),
            nextNodeId: nextNodeId,
            userData: userData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
    }

    // Use LLM to analyze the user's response and extract information
    const analysisPrompt = `
You are analyzing a candidate's response during a software engineering interview.

Current question: "${currentNode.message}"
Candidate's response: "${userResponse}"
Current node ID: "${nodeId}"
Current node category: "${currentNode.category || "general"}"
Example attempts for this question: ${currentAttempts}

Based on the response, please extract the following information in JSON format:
{
"relevance": 0-10 (how relevant the response is to the question),
"clarity": 0-10 (how clear and specific the response is),
"extractedInfo": {
  ${nodeId === "name" ? '"name": "extracted name",' : ""}
  ${
    nodeId === "role-preference" || nodeId === "suggest-roles"
      ? '"position": "extracted position", "isUnsure": true/false, "isDisinterested": true/false, "isVague": true/false,'
      : ""
  }
  ${nodeId === "salary" ? '"salary": number (in USD),' : ""}
  "isYes": true/false (if this is a yes/no question),
  "hasNoExperience": ${noExperiencePatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))},
  "shouldSkipCategory": false,
  "skipToCategory": null,
  "needsFollowUp": false,
  "isDisinterested": true/false (if the user wants to end the conversation),
  "shouldMoveOn": ${currentAttempts >= 1 && isNoExperienceResponse} (if we should move on after multiple attempts)
}
}

IMPORTANT INSTRUCTIONS:
1. If the candidate clearly indicates they have no knowledge or experience with a specific technology (like React or Python), set "shouldSkipCategory" to true and "skipToCategory" to the next logical category.
2. If the candidate expresses frustration or asks to skip a topic, set "shouldSkipCategory" to true.
3. If the candidate gives a very low rating (1-3) for a technology, consider setting "shouldSkipCategory" to true.
4. For React-specific questions, if the candidate indicates no React experience, set "skipToCategory" to "debugging".
5. For Python-specific questions, if the candidate indicates no Python experience, set "skipToCategory" to "react".
6. If the candidate expresses disinterest or a desire to end the conversation at ANY point (e.g., "not interested anymore", "want to stop", "end this interview"), set "isDisinterested" to true.
7. For role selection questions, if the response is vague (e.g., just "developer" without specifying backend/frontend/full stack), set "isVague" to true.
8. If the candidate has repeatedly indicated they have no idea or experience (${currentAttempts} previous attempts), set "shouldMoveOn" to true.

IMPORTANT: Return ONLY the raw JSON object without any markdown formatting, code blocks, or additional text.
Do not include \`\`\`json or \`\`\` in your response.
`

    try {
      // Call OpenAI to analyze the response
      const analysisResponse = await callOpenAI(
        [{ role: "user", content: analysisPrompt }],
        "You are a data extraction assistant.",
      )

      let analysis
      try {
        // Clean the response to remove markdown formatting if present
        let cleanedResponse = analysisResponse

        // Remove markdown code blocks if present (\`\`\`json and \`\`\`)
        cleanedResponse = cleanedResponse.replace(/```json\s?/g, "").replace(/```\s?/g, "")

        // Trim any whitespace
        cleanedResponse = cleanedResponse.trim()

        // Parse the JSON response
        analysis = JSON.parse(cleanedResponse)
      } catch (error) {
        console.error("Failed to parse LLM analysis:", error, "Raw response:", analysisResponse)
        // If parsing fails, use a default analysis
        analysis = {
          relevance: 5,
          clarity: 5,
          extractedInfo: {
            needsFollowUp: false,
            isYes: userResponse.toLowerCase().includes("yes"),
            hasNoExperience: noExperiencePatterns.some((pattern) => userResponse.toLowerCase().includes(pattern)),
            isDisinterested: false,
            shouldSkipCategory: false,
            skipToCategory: null,
            isVague: false,
            shouldMoveOn: currentAttempts >= 1 && isNoExperienceResponse,
          },
        }
      }

      // Update userData with extracted information
      const updatedUserData = { ...userData }

      // Check for general disinterest or desire to end the conversation at any point
      const disinterestPatterns = [
        "not interested",
        "not interested anymore",
        "no longer interested",
        "don't want to continue",
        "dont want to continue",
        "want to stop",
        "please stop",
        "end this",
        "end interview",
        "stop interview",
        "quit",
        "exit",
        "goodbye",
        "bye",
        "stop this",
        "leave",
        "let me go",
        "i'm done",
        "im done",
        "i am done",
        "enough",
        "pls stop",
        "please end",
        "terminate",
        "cancel",
        "abort",
      ]

      // Check if the user's response contains any disinterest patterns
      const isDisinterested = disinterestPatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))

      // If the user expresses disinterest at any point, end the conversation
      if (isDisinterested) {
        console.log("User expressed disinterest, ending conversation")
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              "I understand you're no longer interested in continuing this interview. Thank you for your time and best of luck with your job search!",
            id: Date.now().toString(),
            nextNodeId: "end-not-interested",
            userData: updatedUserData,
            endConversation: true,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Check if LLM suggests moving on after multiple attempts
      if (analysis.extractedInfo.shouldMoveOn && currentNode.nextNodeId) {
        console.log("LLM suggests moving on after multiple attempts")
        const nextNodeId = currentNode.nextNodeId
        const nextNodeMessage = getNodeMessage(script, nextNodeId, updatedUserData)

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: `I understand this isn't your area of expertise. Let's move on to the next question. ${nextNodeMessage}`,
            id: Date.now().toString(),
            nextNodeId: nextNodeId,
            userData: updatedUserData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Special handling for vague role responses
      if ((nodeId === "role-preference" || nodeId === "suggest-roles") && analysis.extractedInfo.isVague) {
        console.log("LLM detected vague role response, asking for clarification")
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              "Could you please specify which type of developer role you're interested in? We have Backend Developer (Python/Django), Frontend Developer (React), or Full Stack Engineer positions available.",
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node
            userData: updatedUserData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (nodeId === "name" && analysis.extractedInfo.name) {
        updatedUserData.name = analysis.extractedInfo.name
      }

      if ((nodeId === "role-preference" || nodeId === "suggest-roles") && analysis.extractedInfo.position) {
        updatedUserData.position = analysis.extractedInfo.position
      }

      if (nodeId === "salary" && analysis.extractedInfo.salary) {
        updatedUserData.salary = analysis.extractedInfo.salary
      }

      // Check if LLM suggests skipping a category
      if (analysis.extractedInfo.shouldSkipCategory && analysis.extractedInfo.skipToCategory) {
        console.log(`LLM suggests skipping to category: ${analysis.extractedInfo.skipToCategory}`)

        // Find the next node in the requested category
        let targetNodeId = null

        // Simple mapping of categories to node IDs
        const categoryToNodeMap: Record<string, string> = {
          python: "python-rating",
          react: "react-rating",
          debugging: "debugging-approach",
          quality: "code-quality",
          salary: "salary",
          process: "agile-experience",
          learning: "staying-updated",
          conclusion: "candidate-questions",
        }

        targetNodeId = categoryToNodeMap[analysis.extractedInfo.skipToCategory] || "debugging-approach"

        if (targetNodeId) {
          const targetNodeMessage = getNodeMessage(script, targetNodeId, updatedUserData)

          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand. Let's move on to a different topic. ${targetNodeMessage}`,
              id: Date.now().toString(),
              nextNodeId: targetNodeId,
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // Check if user is disinterested in all roles
      if ((nodeId === "role-preference" || nodeId === "suggest-roles") && analysis.extractedInfo.isDisinterested) {
        console.log("LLM detected disinterest in all roles, ending conversation")
        return new Response(
          JSON.stringify({
            role: "assistant",
            content:
              "I understand you're not interested in these roles. Thank you for your time and best of luck with your job search!",
            id: Date.now().toString(),
            nextNodeId: "end-not-interested",
            userData: updatedUserData,
            endConversation: true,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Special handling for role uncertainty
      if (nodeId === "role-preference" && analysis.extractedInfo.isUnsure) {
        // If the user is unsure about the role, move to the suggest-roles node
        return new Response(
          JSON.stringify({
            role: "assistant",
            content: script.nodes["suggest-roles"].message,
            id: Date.now().toString(),
            nextNodeId: "suggest-roles",
            userData: updatedUserData,
            endConversation: false,
            wasExamplePrompt: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Special handling for salary verification
      if (nodeId === "salary" && analysis.extractedInfo.salary) {
        const salary = analysis.extractedInfo.salary
        const maxSalary = currentNode.validationRules?.max || 100000

        if (salary > maxSalary) {
          // If salary is above range, move to negotiate-salary node
          return new Response(
            JSON.stringify({
              role: "assistant",
              content: script.nodes["negotiate-salary"].message,
              id: Date.now().toString(),
              nextNodeId: "negotiate-salary",
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // If the user indicates they have no experience or are uncertain with the topic and we're not on a critical node,
      // provide an example and ask for more details instead of moving to the next question
      if (
        analysis.extractedInfo.hasNoExperience &&
        !["name", "salary", "greeting", "role-preference", "suggest-roles"].includes(nodeId) &&
        currentNode.nextNodeId &&
        currentAttempts < 1 // Only try once with examples
      ) {
        console.log("LLM detected 'no experience' or uncertain response")

        // Check if we have examples for this node
        if (currentNode.examples && currentNode.examples.length > 0) {
          const example = currentNode.examples[0]
          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand you might not be sure about this. Let me help with an example: "${example}". Could you try to share your thoughts on this topic?`,
              id: Date.now().toString(),
              nextNodeId: nodeId, // Stay on the same node
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: true, // Flag that this was an example prompt
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        } else {
          // If no examples, move to next question
          console.log("No examples available, moving to next question")
          const nextNodeId = currentNode.nextNodeId
          const nextNodeMessage = getNodeMessage(script, nextNodeId, updatedUserData)

          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand. Let's move on to the next question. ${nextNodeMessage}`,
              id: Date.now().toString(),
              nextNodeId: nextNodeId,
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // Only follow up if absolutely necessary (very low relevance or clarity)
      // AND the user hasn't indicated they have no experience
      const needsFollowUp = (analysis.relevance < 2 || analysis.clarity < 2) && !analysis.extractedInfo.hasNoExperience

      // If the response is completely irrelevant, ask for clarification
      if (needsFollowUp) {
        // Generate a simple follow-up question
        let followUpMessage = `I need a bit more information about ${currentNode.message
          .toLowerCase()
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()}. `

        if (currentNode.examples && currentNode.examples.length > 0) {
          followUpMessage += `For example: "${currentNode.examples[0]}"`
        }

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: followUpMessage,
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node for follow-up
            userData: updatedUserData,
            endConversation: false,
            wasExamplePrompt: true, // This is a kind of example prompt
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Process the response using our script logic
      const result = processResponse(script, nodeId, userResponse, updatedUserData)

      // Add debugging after processing the response
      console.log("Process response result:", result)
      console.log("End conversation flag:", result.endConversation)

      // If the script logic indicates we need a follow-up, use that
      if (result.needsFollowUp) {
        return new Response(
          JSON.stringify({
            role: "assistant",
            content: result.followUpMessage,
            id: Date.now().toString(),
            nextNodeId: nodeId, // Stay on the same node for follow-up
            userData: updatedUserData,
            endConversation: false,
            wasExamplePrompt: true, // This is a kind of example prompt
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      // Special handling for the ending node - always set endConversation to true
      if (result.nextNodeId === "ending") {
        console.log("Reached ending node, setting endConversation to true")
        result.endConversation = true
      }

      // Get the message for the next node
      const nextNodeMessage = getNodeMessage(script, result.nextNodeId, updatedUserData)

      // Return the next message in the script
      return new Response(
        JSON.stringify({
          role: "assistant",
          content: nextNodeMessage,
          id: Date.now().toString(),
          nextNodeId: result.nextNodeId,
          userData: updatedUserData,
          endConversation: result.endConversation,
          wasExamplePrompt: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    } catch (error) {
      console.error("Error processing with LLM:", error)

      // Fallback to basic script logic without LLM
      const updatedUserData = { ...userData }

      // For name node, try to extract the name
      if (nodeId === "name") {
        const nameMatch = userResponse.match(/(?:(?:my|the|this|that|our)\s+name\s+is\s+)?([a-zA-Z]+)/i)
        if (nameMatch) {
          updatedUserData.name = nameMatch[1]
        } else {
          updatedUserData.name = userResponse.trim()
        }
      }

      // Check for disinterest in all roles at the role selection stage
      if (nodeId === "role-preference" || nodeId === "suggest-roles") {
        const disinterestPatterns = [
          "not interested",
          "not looking",
          "none",
          "neither",
          "nothing",
          "no",
          "nope",
          "not any",
          "not for me",
          "don't want",
          "dont want",
        ]

        const isDisinterested = disinterestPatterns.some(
          (pattern) => userResponse.toLowerCase().includes(pattern) || userResponse.toLowerCase() === pattern,
        )

        if (isDisinterested) {
          console.log("Fallback detected disinterest in all roles, ending conversation")
          return new Response(
            JSON.stringify({
              role: "assistant",
              content:
                "I understand you're not interested in these roles. Thank you for your time and best of luck with your job search!",
              id: Date.now().toString(),
              nextNodeId: "end-not-interested",
              userData: updatedUserData,
              endConversation: true,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }

        // Check for vague role responses in fallback mode
        const validRoles = ["backend", "frontend", "full stack", "fullstack"]
        const userResponseLowerFallback = userResponse.toLowerCase()

        // Check if the response contains any of the specific roles
        const hasSpecificRole = validRoles.some((role) => userResponseLowerFallback.includes(role))

        // If the response just contains "developer" or similar without specifying which type
        const isVagueResponse =
          (userResponseLowerFallback.includes("developer") ||
            userResponseLowerFallback.includes("engineer") ||
            userResponseLowerFallback === "dev" ||
            userResponseLowerFallback === "development") &&
          !hasSpecificRole

        if (isVagueResponse) {
          console.log("Fallback detected vague role response, asking for clarification")
          return new Response(
            JSON.stringify({
              role: "assistant",
              content:
                "Could you please specify which type of developer role you're interested in? We have Backend Developer (Python/Django), Frontend Developer (React), or Full Stack Engineer positions available.",
              id: Date.now().toString(),
              nextNodeId: nodeId, // Stay on the same node
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // Check for "no experience" with React specifically
      if (nodeId === "react-rating" || nodeId === "react-project") {
        const noReactPatterns = [
          "no experience with react",
          "never used react",
          "don't know react",
          "dont know react",
          "no knowledge of react",
          "not familiar with react",
          "haven't worked with react",
          "havent worked with react",
          "no react experience",
        ]

        const hasNoReactExperience = noReactPatterns.some((pattern) => userResponse.toLowerCase().includes(pattern))

        if (hasNoReactExperience) {
          console.log("Fallback detected no React experience, skipping to debugging section")

          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand you don't have experience with React. Let's move on to another topic. ${script.nodes["debugging-approach"].message}`,
              id: Date.now().toString(),
              nextNodeId: "debugging-approach",
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // Check for "no experience" responses in fallback mode
      if (
        isNoExperienceResponse &&
        !["name", "salary", "greeting", "role-preference", "suggest-roles"].includes(nodeId) &&
        currentNode.nextNodeId
      ) {
        // If we've already tried with examples, move on
        if (currentAttempts >= 1) {
          console.log("Fallback already tried with examples, moving to next question")
          const nextNodeId = currentNode.nextNodeId
          const nextNodeMessage = getNodeMessage(script, nextNodeId, updatedUserData)

          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand this isn't your area of expertise. Let's move on to the next question. ${nextNodeMessage}`,
              id: Date.now().toString(),
              nextNodeId: nextNodeId,
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }

        // Check if we have examples for this node
        if (currentNode.examples && currentNode.examples.length > 0) {
          const example = currentNode.examples[0]
          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand you might not be sure about this. Let me help with an example: "${example}". Could you try to share your thoughts on this topic?`,
              id: Date.now().toString(),
              nextNodeId: nodeId, // Stay on the same node
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: true, // Flag that this was an example prompt
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        } else {
          // If no examples, move to next question
          const nextNodeId = currentNode.nextNodeId
          const nextNodeMessage = getNodeMessage(script, nextNodeId, updatedUserData)

          return new Response(
            JSON.stringify({
              role: "assistant",
              content: `I understand. Let's move on to the next question. ${nextNodeMessage}`,
              id: Date.now().toString(),
              nextNodeId: nextNodeId,
              userData: updatedUserData,
              endConversation: false,
              wasExamplePrompt: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }
      }

      // Process the response using our script logic
      const result = processResponse(script, nodeId, userResponse, updatedUserData)

      // Special handling for the ending node - always set endConversation to true
      if (result.nextNodeId === "ending") {
        console.log("Fallback reached ending node, setting endConversation to true")
        result.endConversation = true
      }

      // Get the message for the next node
      const nextNodeMessage = getNodeMessage(script, result.nextNodeId, updatedUserData)

      // Return the next message in the script
      return new Response(
        JSON.stringify({
          role: "assistant",
          content: result.needsFollowUp ? result.followUpMessage : nextNodeMessage,
          id: Date.now().toString(),
          nextNodeId: result.needsFollowUp ? nodeId : result.nextNodeId,
          userData: updatedUserData,
          endConversation: result.endConversation,
          wasExamplePrompt: result.needsFollowUp, // This is a kind of example prompt if we're following up
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }
  } catch (error) {
    console.error("Unhandled error in chat API:", error)

    return new Response(
      JSON.stringify({
        role: "assistant",
        content: "I apologize, but I encountered an error processing your message. Let's start over.",
        id: Date.now().toString(),
        nextNodeId: "greeting",
        userData: {},
        endConversation: false,
        wasExamplePrompt: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
}
