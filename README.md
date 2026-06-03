Classroom Companion
Classroom Companion is an AI-powered EdTech platform designed to streamline the interaction between teachers and students. By integrating a Telegram bot with a real-time web dashboard, it automates assignment tracking, status updates, and grading, allowing educators to focus on teaching rather than administration.

Key Features
Natural Language Assignment Creation: Teachers can assign tasks using natural language via Telegram; an AI engine parses the intent, deadline, and target student.

Real-time Student Portal: Students receive automatic notifications, submit work (text or files), and can flag tasks as "Stuck" for immediate teacher intervention.

Teacher Command Center: A centralized, filtered dashboard to triage classroom needs by priority (Stuck, Needs Grading, Pending, Finished).

Automated Feedback Loop: Teachers can provide grading feedback directly from the dashboard, which is instantly delivered to the student via Telegram.

Intelligent Triage: The dashboard automatically sorts tasks based on urgency and status to ensure no student is left behind.

Technology Stack
Framework: Next.js (App Router)

Language: TypeScript

Database: PostgreSQL (via Prisma ORM)

Messaging: Telegraf (Telegram Bot API)

AI Engine: Google Gemini API

Styling: Tailwind CSS

Architecture
Getting Started
Prerequisites
Node.js (v18+)

PostgreSQL Database

Telegram Bot Token (via BotFather)

Google Gemini API Key

Installation
Clone the repository:

Bash
git clone https://github.com/yourusername/classroom-companion.git
cd classroom-companion
Install dependencies:

Bash
npm install
Configure your environment variables in .env:

Code snippet
DATABASE_URL="your-postgresql-connection-string"
TELEGRAM_TOKEN="your-bot-token"
GEMINI_API_KEY="your-gemini-key"
Run database migrations:

Bash
npx prisma db push
Start the development server:

Bash
npm run dev
Workflow
Registration: Users initialize the bot via /start and designate themselves as TEACHER or STUDENT.

Assignment: The teacher sends a message to the bot. The AI extracts the requirements and notifies the target student.

Submission: The student submits work via the bot (text/files) or their dedicated web portal.

Triage: The teacher reviews the task on the dashboard, utilizing filter tabs to prioritize students who are "Stuck."

Grading: Upon grading, the system triggers a final notification to the student's device.