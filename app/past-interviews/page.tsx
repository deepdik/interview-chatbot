"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, MessageSquare, Clock, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { StorageService } from "@/lib/storage"

export default function PastInterviews() {
  const router = useRouter()
  const [interviews, setInterviews] = useState<string[]>([])
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    function loadInterviews() {
      try {
        setIsLoading(true)
        const interviewList = StorageService.getInterviews()
        setInterviews(interviewList)

        // Get message counts for all interviews
        const counts: Record<string, number> = {}
        for (const id of interviewList) {
          counts[id] = StorageService.getMessageCount(id)
        }
        setMessageCounts(counts)
      } catch (error) {
        console.error("Error loading interviews:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInterviews()
  }, [])

  const goToInterview = (id: string) => {
    router.push(`/interview/${id}`)
  }

  const goHome = () => {
    router.push("/")
  }

  // Extract timestamp from interview ID and format it
  const formatInterviewTime = (id: string) => {
    const timestamp = id.split("-")[1]
    if (timestamp) {
      return formatDistanceToNow(new Date(Number.parseInt(timestamp)), { addSuffix: true })
    }
    return "Unknown time"
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
          <CardHeader className="flex flex-row items-center border-b pb-4">
            <Button variant="ghost" size="icon" onClick={goHome} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Past Interviews</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading interviews...</p>
              </div>
            ) : interviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No past interviews found.</p>
                <Button variant="outline" onClick={goHome} className="mt-4">
                  Back to Home
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {interviews.map((id, index) => (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => goToInterview(id)}
                    >
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="bg-primary/10 p-2 rounded-full mr-3">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Software Engineer Interview</p>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatInterviewTime(id)}
                              <span className="mx-2">•</span>
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {messageCounts[id] || 0} messages
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={goHome} className="w-full">
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
