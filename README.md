# Interview Chatbot

An AI-powered interview chatbot that simulates a software engineering interview. The chatbot follows a predefined script but uses AI to understand and respond to user inputs intelligently.

## Features

- Structured interview flow with branching logic
- AI-powered response analysis using OpenAI's GPT models
- Ability to skip questions based on user experience
- Conversation history storage
- Responsive UI with typing indicators
- Fallback mechanisms when AI is unavailable

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- OpenAI API key

## Installation

1. Clone the repository:

\`\`\`bash
git clone https://github.com/yourusername/interview-chatbot.git
cd interview-chatbot
\`\`\`

2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

3. Create a `.env.local` file in the root directory with your OpenAI API key:

\`\`\`
OPENAI_API_KEY=your_openai_api_key_here
\`\`\`

## Running the Application

### Development Mode

Run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Production Build

Build the application for production:

\`\`\`bash
npm run build
\`\`\`

Start the production server:

\`\`\`bash
npm start
\`\`\`

## How It Works

### Architecture

- **Frontend**: React components with Next.js App Router
- **Backend**: Next.js API routes
- **AI Integration**: OpenAI GPT models via server-side API calls
- **Storage**: Client-side localStorage for interview data

### Interview Flow

1. The chatbot follows a script defined in `lib/script-loader.ts`
2. User responses are analyzed using pattern matching and AI
3. The chatbot can adapt the interview flow based on user responses
4. Interview history is saved in localStorage

### AI Integration

The application uses OpenAI's GPT models for two main purposes:

1. **Response Analysis**: Understanding user responses to determine the next question
2. **Question Answering**: Providing informative answers when users ask questions

All AI calls are made server-side through the Next.js API route to keep your API key secure.

## Customization

### Modifying the Interview Script

The interview script is defined in `lib/script-loader.ts`. You can modify the `softwareEngineerScript` object to change questions, add new branches, or create entirely new interview flows.

### Changing the Job Description

Update the job description in `data/jobs/software-engineer.json` to match your specific job requirements.

## Troubleshooting

### OpenAI API Issues

If you encounter errors related to the OpenAI API:

1. Verify your API key is correct in `.env.local`
2. Check if you have sufficient credits in your OpenAI account
3. Look for rate limiting messages in the console

### Browser Storage Issues

If interview history isn't saving correctly:

1. Check if localStorage is enabled in your browser
2. Clear browser storage and try again
3. Verify there are no console errors related to storage

