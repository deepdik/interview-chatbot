"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ChatInterface from "@/components/chat-interface"
import { StorageService } from "@/lib/storage"
import { softwareEngineerScript } from "@/lib/script-loader"

export default function InterviewPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    function checkInterview() {
      try {
        setIsLoading(true)

        // Check if the interview exists in localStorage
        const storedInterviews = localStorage.getItem("interviews")
        const interviews = storedInterviews ? JSON.parse(storedInterviews) : []

        // Select the script
        const script = softwareEngineerScript

        if (!interviews.includes(id)) {
          // If it doesn't exist, add it
          localStorage.setItem("interviews", JSON.stringify([...interviews, id]))

          // Initialize the interview with the script
          StorageService.initializeInterview(id, script)
        }
      } catch (error) {
        console.error("Error checking interview:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkInterview()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <ChatInterface interviewId={id} />
    </div>
  )
}
