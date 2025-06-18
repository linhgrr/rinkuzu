# RinKuzu App

A modern web application built with Next.js 14 that allows teachers to create interactive quizzes from PDF files with an admin approval workflow.

## 🚀 Features

- **PDF to Quiz Conversion**: Upload PDF files and let AI extract multiple-choice questions automatically
- **Admin Approval System**: All quizzes go through an admin review process before publication
- **User Authentication**: Secure login/registration with role-based access control
- **Quiz Management**: Users can track their quiz submissions and manage published quizzes
- **Interactive Quiz Player**: Clean, user-friendly interface for taking quizzes
- **Score Tracking**: Automatic scoring and result display
- **Real-time Status Updates**: Track quiz approval status in real-time
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router, Server Actions)
- **Language**: TypeScript (ES2022)
- **Database**: MongoDB Atlas via Mongoose
- **Authentication**: NextAuth.js with JWT
- **State Management**: Zustand
- **Styling**: TailwindCSS
- **AI Integration**: Google Gemini 2.0 Flash
- **PDF Processing**: Base64 encoding (≤20MB) with react-dropzone
- **Deployment**: Vercel optimized

## Features

- 📄 PDF upload and automatic quiz generation using Gemini AI
- 👥 User authentication with role-based access (admin/user)
- ✅ Admin approval workflow for quizzes
- 🎯 Interactive quiz taking experience
- 📊 Score tracking and attempt history
- 🔄 Key rotation for Gemini API with automatic retry
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- MongoDB Atlas account
- Google Gemini API keys

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd quiz-app
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in your environment variables:
```env
MONGO_URL=***REMOVED***
NEXTAUTH_SECRET=your-secret-key
GEMINI_KEYS=key1,key2,key3
JWT_EXPIRES_IN=30m
```

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment on Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `MONGO_URL`
   - `NEXTAUTH_SECRET` 
   - `GEMINI_KEYS`
   - `JWT_EXPIRES_IN`
4. Deploy!

## Project Structure

```
src/
├── app/                 # Next.js 14 App Router
│   ├── api/            # API routes
│   └── (pages)/        # Page components
├── components/         # Reusable components
├── lib/               # Utility libraries
├── models/            # MongoDB models
├── store/             # Zustand store
└── types/             # TypeScript types
```

## Usage

### For Teachers:
1. Register/Login to the platform
2. Upload PDF files containing quiz content
3. Wait for admin approval
4. Share quiz links with students

### For Admins:
1. Review submitted quizzes in admin queue
2. Approve or reject quiz submissions
3. Monitor user activity and quiz attempts

### For Students:
1. Access quiz via shared link
2. Complete quiz and submit answers
3. View results and attempt history

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/quizzes` - List quizzes (filtered by status)
- `POST /api/quizzes` - Create quiz from PDF
- `PUT /api/quizzes/[id]` - Edit quiz
- `POST /api/quizzes/[id]/approve` - Admin approve quiz
- `POST /api/quizzes/[id]/reject` - Admin reject quiz
- `GET /api/quiz/[slug]/play` - Get quiz for playing
- `POST /api/quiz/[slug]/attempt` - Submit quiz attempt

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License. 