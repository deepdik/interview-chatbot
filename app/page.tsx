"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, MessageSquare, Clock } from "lucide-react"
import { motion } from "framer-motion"
import { StorageService } from "@/lib/storage"

export default function Home() {
  const router = useRouter()
  const [interviews, setInterviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use a regular function instead of async
    function loadInterviews() {
      try {
        const interviewList = StorageService.getInterviews()
        setInterviews(interviewList)
      } catch (error) {
        console.error("Error loading interviews:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInterviews()
  }, [])

  const startNewInterview = () => {
    try {
      // Create a new interview using client storage
      const interviewId = StorageService.createInterview()

      // Navigate to the new interview
      router.push(`/interview/${interviewId}`)
    } catch (error) {
      console.error("Error starting new interview:", error)
    }
  }

  const viewPastInterviews = () => {
    router.push("/past-interviews")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <Card className="w-full shadow-lg border-0">
          <CardHeader className="text-center space-y-2 pb-2">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Interview Bot</CardTitle>
            <p className="text-muted-foreground text-sm">AI-powered interview assistant</p>
          </CardHeader>
          <CardContent className="text-center space-y-6 pt-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p>
                Our automated software engineering interview will ask you questions about your experience, technical
                skills, and salary expectations for both backend Python and frontend React positions.
              </p>
            </div>

            <div className="flex flex-col space-y-3">
              <Button onClick={startNewInterview} size="lg" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Start New Interview
              </Button>

              <Button
                variant="outline"
                onClick={viewPastInterviews}
                disabled={isLoading || interviews.length === 0}
                size="lg"
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                {isLoading ? (
                  <span>Loading interviews...</span>
                ) : (
                  <span>View Past Interviews ({interviews.length})</span>
                )}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="text-center text-xs text-muted-foreground pt-2 pb-6">Powered by Next.js</CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
