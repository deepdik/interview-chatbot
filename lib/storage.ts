"use client"

import type { InterviewScript } from "./script-loader"

// Client-side storage service using localStorage
export const StorageService = {
  // Create a new interview
  createInterview: () => {
    try {
      const interviewId = `interview-${Date.now()}`
      const storedInterviews = localStorage.getItem("interviews")
      const interviews = storedInterviews ? JSON.parse(storedInterviews) : []
      localStorage.setItem("interviews", JSON.stringify([...interviews, interviewId]))
      return interviewId
    } catch (error) {
      console.error("Error creating interview:", error)
      return `interview-${Date.now()}` // Fallback
    }
  },

  // Get all interviews
  getInterviews: () => {
    try {
      const storedInterviews = localStorage.getItem("interviews")
      return storedInterviews ? JSON.parse(storedInterviews) : []
    } catch (error) {
      console.error("Error fetching interviews:", error)
      return []
    }
  },

  // Check if an interview exists
  interviewExists: (interviewId: string) => {
    try {
      const storedInterviews = localStorage.getItem("interviews")
      const interviews = storedInterviews ? JSON.parse(storedInterviews) : []
      return interviews.includes(interviewId)
    } catch (error) {
      console.error("Error checking if interview exists:", error)
      return false
    }
  },

  // Save a message
  saveMessage: (interviewId: string, message: any) => {
    try {
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)
      const conversation = savedConversation ? JSON.parse(savedConversation) : { messages: [] }
      conversation.messages.push(message)
      localStorage.setItem(`conversation-${interviewId}`, JSON.stringify(conversation))
    } catch (error) {
      console.error("Error saving message:", error)
    }
  },

  // Get all messages for an interview
  getMessages: (interviewId: string) => {
    try {
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)
      return savedConversation ? JSON.parse(savedConversation).messages : []
    } catch (error) {
      console.error("Error fetching messages:", error)
      return []
    }
  },

  // Get message count for an interview
  getMessageCount: (interviewId: string) => {
    try {
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)
      return savedConversation ? JSON.parse(savedConversation).messages.length : 0
    } catch (error) {
      console.error("Error getting message count:", error)
      return 0
    }
  },

  // Save interview state
  saveInterviewState: (interviewId: string, currentNodeId: string, userData: any, conversationEnded: boolean) => {
    try {
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)
      const conversation = savedConversation ? JSON.parse(savedConversation) : { messages: [] }
      conversation.currentNodeId = currentNodeId
      conversation.userData = userData
      conversation.conversationEnded = conversationEnded
      conversation.lastUpdated = new Date().toISOString()
      localStorage.setItem(`conversation-${interviewId}`, JSON.stringify(conversation))
    } catch (error) {
      console.error("Error saving interview state:", error)
    }
  },

  // Get interview state
  getInterviewState: (interviewId: string) => {
    try {
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)
      if (!savedConversation) return null

      const conversation = JSON.parse(savedConversation)
      return {
        currentNodeId: conversation.currentNodeId,
        userData: conversation.userData || {},
        conversationEnded: conversation.conversationEnded || false,
        updatedAt: conversation.lastUpdated,
      }
    } catch (error) {
      console.error("Error fetching interview state:", error)
      return null
    }
  },

  // Initialize or load an interview
  initializeInterview: (interviewId: string, script?: InterviewScript) => {
    try {
      // Check if interview exists in the interviews list
      if (!StorageService.interviewExists(interviewId)) {
        // Add to interviews list
        const storedInterviews = localStorage.getItem("interviews")
        const interviews = storedInterviews ? JSON.parse(storedInterviews) : []
        localStorage.setItem("interviews", JSON.stringify([...interviews, interviewId]))
      }

      // Check if conversation data exists
      const savedConversation = localStorage.getItem(`conversation-${interviewId}`)

      // If conversation exists, return it
      if (savedConversation) {
        const conversation = JSON.parse(savedConversation)
        return {
          messages: conversation.messages || [],
          currentNodeId: conversation.currentNodeId || "",
          userData: conversation.userData || {},
          conversationEnded: conversation.conversationEnded || false,
        }
      }

      // If no saved conversation, create a new one with the script
      const initialMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Hello! Welcome to the interview. Let's get started. Are you interested in our Software Engineer position?",
      }

      // Try to get the actual message from the script
      if (script && typeof script === "object" && script.startNodeId && script.nodes) {
        const startNode = script.nodes[script.startNodeId]
        if (startNode && startNode.message) {
          initialMessage.content = startNode.message
        }
      }

      // Create new conversation object
      const newConversation = {
        messages: [initialMessage],
        currentNodeId: script?.startNodeId || "",
        userData: {},
        conversationEnded: false,
        lastUpdated: new Date().toISOString(),
      }

      // Save the new conversation
      localStorage.setItem(`conversation-${interviewId}`, JSON.stringify(newConversation))

      // Return the new conversation data
      return {
        messages: [initialMessage],
        currentNodeId: script?.startNodeId || "",
        userData: {},
        conversationEnded: false,
      }
    } catch (error) {
      console.error("Error initializing interview:", error)

      // Fallback to a new conversation without accessing localStorage
      return {
        messages: [
          {
            id: Date.now().toString(),
            role: "assistant",
            content:
              "Hello! Welcome to the interview. Let's get started. Are you interested in our Software Engineer position?",
          },
        ],
        currentNodeId: "",
        userData: {},
        conversationEnded: false,
      }
    }
  },
}
