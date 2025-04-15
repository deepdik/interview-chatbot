"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Send, User, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { softwareEngineerScript } from "@/lib/script-loader"
import { StorageService } from "@/lib/storage"
// Import the typing indicator
import { ChatTypingIndicator } from "./chat-typing-indicator"

interface ChatInterfaceProps {
  interviewId: string
}

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
}

export default function ChatInterface({ interviewId }: ChatInterfaceProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null) // Reference for the input field
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentNodeId, setCurrentNodeId] = useState<string>("")
  const [userData, setUserData] = useState<Record<string, any>>({})
  const [conversationEnded, setConversationEnded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingTimer, setThinkingTimer] = useState<NodeJS.Timeout | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [exampleAttempts, setExampleAttempts] = useState<Record<string, number>>({}) // Track example attempts per node
  const maxRetries = 3

  // Get the script
  const script = softwareEngineerScript

  // Initialize chat with the first message
  useEffect(() => {
    function loadChat() {
      try {
        setIsLoading(true)

        // Initialize or load the interview using StorageService with the script
        const data = StorageService.initializeInterview(interviewId, script)

        // Add timestamps to messages if they don't have them
        const messagesWithTimestamps = data.messages.map((msg: Message) => ({
          ...msg,
          timestamp: msg.timestamp || new Date().toISOString(),
        }))

        setMessages(messagesWithTimestamps)
        setCurrentNodeId(data.currentNodeId || script.startNodeId)
        setUserData(data.userData || {})
        setConversationEnded(data.conversationEnded || false)
      } catch (error) {
        console.error("Error loading chat:", error)
        setErrorMessage("Failed to load the interview. Please try again.")

        // Set default values in case of error
        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: script.nodes[script.startNodeId].message,
            timestamp: new Date().toISOString(),
          },
        ])
        setCurrentNodeId(script.startNodeId)
      } finally {
        setIsLoading(false)
      }
    }

    loadChat()
  }, [interviewId, script])

  // Focus the input field when the component mounts and after each message submission
  useEffect(() => {
    // Only focus if the conversation hasn't ended
    if (!conversationEnded && !isSubmitting && !isThinking && inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages, isSubmitting, isThinking, conversationEnded])

  // Cleanup thinking timer on unmount
  useEffect(() => {
    return () => {
      if (thinkingTimer) {
        clearTimeout(thinkingTimer)
      }
    }
  }, [thinkingTimer])

  // Check if we should show the scroll button
  const checkScrollPosition = () => {
    const container = messagesEndRef.current?.parentElement
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })

    // Add scroll event listener to the messages container
    const container = messagesEndRef.current?.parentElement
    if (container) {
      container.addEventListener("scroll", checkScrollPosition)
      return () => container.removeEventListener("scroll", checkScrollPosition)
    }
  }, [messages, isThinking])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const goBack = () => {
    router.push("/")
  }

  // Format timestamp
  const getMessageTime = (timestamp?: string) => {
    const date = timestamp ? new Date(timestamp) : new Date()
    return format(date, "h:mm a")
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Check if user response indicates they have no idea
  const hasNoIdeaResponse = (text: string) => {
    const noIdeaPatterns = [
      "no idea",
      "don't know",
      "dont know",
      "not sure",
      "no clue",
      "no experience",
      "haven't done",
      "havent done",
      "never done",
      "can't answer",
      "cant answer",
      "don't understand",
      "dont understand",
    ]
    return noIdeaPatterns.some((pattern) => text.toLowerCase().includes(pattern))
  }

  // Custom submit handler with error handling and retries
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() === "" || isSubmitting || conversationEnded) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const timestamp = new Date().toISOString()

      // Manually add the user message to the messages array
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp,
      }

      // Check for expressions of disinterest before making the API call
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

      // Check if the user's input contains any disinterest patterns
      const isDisinterested = disinterestPatterns.some((pattern) => input.toLowerCase().includes(pattern))

      // If the user expresses disinterest, end the conversation immediately
      if (isDisinterested) {
        // Add the assistant's response to the messages
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "I understand you're no longer interested in continuing this interview. Thank you for your time and best of luck with your job search!",
          timestamp: new Date().toISOString(),
        }

        const newMessages = [...messages, userMessage, assistantMessage]
        setMessages(newMessages)

        // Save the assistant message
        StorageService.saveMessage(interviewId, assistantMessage)

        // End the conversation
        setConversationEnded(true)
        StorageService.saveInterviewState(interviewId, "end-not-interested", userData, true)

        setIsSubmitting(false)
        setInput("")
        return
      }

      // Check if this is a "no idea" response to a question we've already tried to prompt with examples
      const isNoIdeaResponse = hasNoIdeaResponse(input)
      const currentAttempts = exampleAttempts[currentNodeId] || 0

      // If user has repeatedly said they have no idea, we'll handle it client-side
      if (isNoIdeaResponse && currentAttempts >= 1 && script.nodes[currentNodeId]?.nextNodeId) {
        console.log(`User has no idea after ${currentAttempts} attempts, moving to next question`)

        // Add the user message
        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        StorageService.saveMessage(interviewId, userMessage)

        // Get the next node
        const nextNodeId = script.nodes[currentNodeId].nextNodeId || ""

        // Create assistant response
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `I understand this isn't your area of expertise. Let's move on to the next question. ${script.nodes[nextNodeId]?.message || ""}`,
          timestamp: new Date().toISOString(),
        }

        // Add the assistant message
        setMessages([...newMessages, assistantMessage])
        StorageService.saveMessage(interviewId, assistantMessage)

        // Update state
        setCurrentNodeId(nextNodeId)
        StorageService.saveInterviewState(interviewId, nextNodeId, userData, false)

        // Reset example attempts for the new node
        setExampleAttempts({ ...exampleAttempts, [nextNodeId]: 0 })

        setIsSubmitting(false)
        setInput("")
        return
      }

      const newMessages = [...messages, userMessage]
      setMessages(newMessages)

      // Save the user message
      StorageService.saveMessage(interviewId, userMessage)

      // Clear the input
      setInput("")

      // Show thinking state with a minimum duration
      setIsThinking(true)
      const minThinkingTime = Math.random() * 1000 + 1500 // 1.5-2.5 seconds

      const timer = setTimeout(() => {
        setIsThinking(false)
      }, minThinkingTime)

      setThinkingTimer(timer)

      // Make the API call
      fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
          currentNodeId: currentNodeId,
          userData: userData,
          exampleAttempts: exampleAttempts, // Pass the example attempts to the API
        }),
      })
        .then((response) => {
          // Check if the response is ok before trying to parse JSON
          if (!response.ok) {
            return response.text().then((text) => {
              throw new Error(`API error: ${response.status} - ${text}`)
            })
          }
          return response.json()
        })
        .then((data) => {
          if (data.error) {
            console.error("API returned error:", data.error)
            setErrorMessage(`Error: ${data.error}`)
            return
          }

          // Wait for minimum thinking time to complete
          const waitForThinking = () => {
            if (!isThinking) {
              // Add the assistant's response to the messages
              const assistantMessage: Message = {
                id: data.id || Date.now().toString(),
                role: "assistant",
                content: data.content || "I apologize, but I couldn't process your request.",
                timestamp: new Date().toISOString(),
              }

              const updatedMessages = [...newMessages, assistantMessage]
              setMessages(updatedMessages)

              // Save the assistant message
              StorageService.saveMessage(interviewId, assistantMessage)

              // Update state with the new node and user data
              setCurrentNodeId(data.nextNodeId)
              setUserData(data.userData || {})

              // Update example attempts if this was an example prompt
              if (data.wasExamplePrompt) {
                const newAttempts = { ...exampleAttempts }
                newAttempts[currentNodeId] = (newAttempts[currentNodeId] || 0) + 1
                setExampleAttempts(newAttempts)
              } else if (data.nextNodeId !== currentNodeId) {
                // Reset example attempts for the new node
                setExampleAttempts({ ...exampleAttempts, [data.nextNodeId]: 0 })
              }

              // Check if conversation has ended - ENSURE THIS IS WORKING
              console.log("Checking endConversation flag:", data.endConversation)
              if (data.endConversation) {
                console.log("Ending conversation based on endConversation flag:", data.endConversation)
                setConversationEnded(true)

                // Make sure we save the conversation ended state
                StorageService.saveInterviewState(interviewId, data.nextNodeId, data.userData || {}, true)
              } else {
                // Save the interview state
                StorageService.saveInterviewState(interviewId, data.nextNodeId, data.userData || {}, false)
              }

              // Reset retry count on successful request
              setRetryCount(0)

              // Focus the input field after receiving a response
              setTimeout(() => {
                if (inputRef.current && !data.endConversation) {
                  inputRef.current.focus()
                }
              }, 100)
            } else {
              setTimeout(waitForThinking, 100)
            }
          }

          waitForThinking()
        })
        .catch((err) => {
          console.error("Error submitting message:", err)

          // Increment retry count
          const newRetryCount = retryCount + 1
          setRetryCount(newRetryCount)

          // If we haven't exceeded max retries, try again
          if (newRetryCount < maxRetries) {
            setErrorMessage(`Error connecting to server. Retrying (${newRetryCount}/${maxRetries})...`)

            // Wait a moment before retrying
            setTimeout(() => {
              handleFormSubmit(e)
            }, 1000)
            return
          }

          // Add a fallback response from the bot
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content:
              "I apologize for the technical difficulty. Let's continue with the interview. Could you please tell me more about yourself?",
            timestamp: new Date().toISOString(),
          }

          setMessages([...newMessages, fallbackMessage])
          StorageService.saveMessage(interviewId, fallbackMessage)

          setErrorMessage(
            `There was a problem with our system. We've recorded your message and will continue the interview.`,
          )

          // Focus the input field even after an error
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus()
            }
          }, 100)
        })
        .finally(() => {
          setIsSubmitting(false)
          setIsThinking(false)
          if (thinkingTimer) {
            clearTimeout(thinkingTimer)
          }
        })
    } catch (err) {
      console.error("Error in form submission:", err)
      setIsSubmitting(false)
      setIsThinking(false)
      if (thinkingTimer) {
        clearTimeout(thinkingTimer)
      }
      setErrorMessage("An unexpected error occurred. Please try again.")

      // Focus the input field after an error
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }

  // Restart the conversation
  const restartConversation = () => {
    try {
      setIsLoading(true)

      // Generate a new interview ID
      const newInterviewId = StorageService.createInterview()

      // Navigate to the new interview
      router.push(`/interview/${newInterviewId}`)
    } catch (error) {
      console.error("Error restarting conversation:", error)
      setErrorMessage("Failed to restart the interview. Please try again.")
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-3xl h-[90vh] flex flex-col shadow-lg border-0">
        <CardHeader className="flex flex-row items-center border-b bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-primary/10 text-primary">SE</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">Software Engineering Recruiter</CardTitle>
              <p className="text-xs text-muted-foreground">Interview Bot</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading interview...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-3xl h-[90vh]"
    >
      <Card className="w-full h-full flex flex-col shadow-lg border-0">
        <CardHeader className="flex flex-row items-center border-b bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src="/placeholder.svg?height=40&width=40" />
              <AvatarFallback className="bg-primary/10 text-primary">SE</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">Software Engineering Recruiter</CardTitle>
              <p className="text-xs text-muted-foreground">Interview Bot</p>
            </div>
          </div>
          {(isSubmitting || isThinking) && (
            <div className="ml-auto flex items-center text-sm text-muted-foreground">
              <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
              {isThinking ? "Thinking..." : "Typing..."}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-grow overflow-y-auto p-6 space-y-6" onScroll={checkScrollPosition}>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center">
                <span>{errorMessage}</span>
                <Button variant="outline" size="sm" onClick={restartConversation} className="ml-2">
                  <RefreshCw className="h-3 w-3 mr-1" /> Restart
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn("flex items-start gap-3", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role !== "user" && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary/10 text-primary">SE</AvatarFallback>
                  </Avatar>
                )}

                <div className={cn("flex flex-col max-w-[80%]", message.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted rounded-tl-none",
                    )}
                  >
                    {message.content}
                  </div>
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {getMessageTime(message.timestamp)}
                  </div>
                </div>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/placeholder.svg?height=40&width=40" />
                    <AvatarFallback className="bg-zinc-200">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback className="bg-primary/10 text-primary">SE</AvatarFallback>
              </Avatar>

              <div className="flex flex-col max-w-[80%] items-start">
                <div className="rounded-2xl px-6 py-3 bg-muted rounded-tl-none">
                  <ChatTypingIndicator />
                </div>
                <div className="flex items-center mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {getMessageTime()}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {showScrollButton && (
          <div className="absolute bottom-20 right-6">
            <Button size="icon" variant="secondary" className="rounded-full shadow-md" onClick={scrollToBottom}>
              <ArrowLeft className="h-4 w-4 rotate-90" />
            </Button>
          </div>
        )}

        <CardFooter className="border-t p-4">
          {conversationEnded ? (
            <div className="w-full text-center">
              <p className="text-muted-foreground mb-3">This conversation has ended.</p>
              <Button onClick={restartConversation} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Start New Interview
              </Button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="flex w-full space-x-2">
              <Input
                ref={inputRef} // Add the ref to the input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isSubmitting || isThinking}
                className="flex-grow rounded-full border-muted-foreground/20"
              />
              <Button
                type="submit"
                disabled={isSubmitting || isThinking || input.trim() === ""}
                className="rounded-full"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}
