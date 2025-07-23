# LearnWorlds RAG Assistant

## Overview

This is a sophisticated AI-powered educational assistant designed for integration with LearnWorlds LMS. The application provides intelligent chatbot capabilities for course content, along with ECOS (Examen Clinique Objectif Structuré) simulation features for medical education. Built with React/TypeScript frontend and Express.js backend, it leverages vector search technology and OpenAI for conversational AI.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Build System**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based authentication with connect-pg-simple
- **File Processing**: Multer for PDF uploads and processing
- **API Design**: RESTful API with structured error handling

### Key Components

#### 1. RAG (Retrieval-Augmented Generation) System
- **Vector Database**: Pinecone for document embeddings and similarity search
- **AI Model**: OpenAI GPT-4o for response generation
- **Document Processing**: PDF parsing and text chunking for knowledge base
- **Context Retrieval**: Semantic search to find relevant content for user queries

#### 2. ECOS Simulation Platform
- **Patient Simulation**: AI-powered virtual patients for medical training
- **Scenario Management**: Teachers can create, edit, and manage clinical scenarios
- **Evaluation System**: Automated assessment of student-patient interactions
- **Training Sessions**: Organized learning sessions with multiple scenarios

#### 3. User Management System
- **Role-based Access**: Admin, Teacher, and Student roles with different permissions
- **Daily Limits**: Rate limiting for chatbot usage (20 questions per day per user)
- **Session Tracking**: Persistent session management across interactions

## Data Flow

1. **User Authentication**: Email-based identification with session persistence
2. **Query Processing**: User questions are processed through the RAG pipeline
3. **Vector Search**: Pinecone retrieves relevant document chunks based on semantic similarity
4. **AI Response**: OpenAI generates contextual responses using retrieved information
5. **Usage Tracking**: Daily question limits are enforced and tracked in the database
6. **ECOS Simulation**: Real-time patient simulation with conversation history and evaluation

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4o for natural language processing and response generation
- **Pinecone**: Vector database for document embeddings and similarity search
- **Neon Database**: PostgreSQL hosting with serverless scaling

### Development Tools
- **Replit Environment**: Development and deployment platform
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Production build optimization

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library for consistent iconography

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Hot Reload**: Vite development server with HMR
- **Database**: PostgreSQL 16 module with automatic provisioning
- **Port Configuration**: Port 5000 for development server

### Production Deployment
- **Build Process**: Vite frontend build + ESBuild backend bundling
- **Autoscale**: Replit's autoscale deployment target
- **Static Assets**: Served from dist/public directory
- **Environment Variables**: Secure configuration for API keys and database URLs

### Database Schema
- **Users**: Authentication and profile management
- **Sessions**: Persistent session storage
- **Exchanges**: Chat history and conversation tracking
- **Daily Counters**: Usage limits and rate limiting
- **ECOS Tables**: Scenarios, sessions, messages, and evaluations

## Changelog

- June 13, 2025. Initial setup
- July 21, 2025. Supabase integration completed:
  - Migrated from Firebase to Supabase PostgreSQL database
  - Created comprehensive database schema for ECOS scenarios
  - Implemented scenario synchronization from Pinecone to Supabase
  - Added fallback scenarios service for demonstration
  - Updated all backend routes to use Drizzle ORM
  - Teacher and student interfaces now display scenarios from database/fallback

## Current Technical Status

- Database: Supabase PostgreSQL with successful HTTP connection (https://zateicubgktisdtnihiu.supabase.co)
- Connection: Direct connection using URL conversion from PostgreSQL to HTTP format
- Scenarios: Successfully serving 3 real scenarios from Supabase database (no fallback systems)
- Authentication: In-memory user storage with working Supabase integration
- API: All endpoints functional - admin/indexes returns 5 Pinecone indexes, scenarios endpoints serve real data
- Frontend: React application fully operational with real database integration
- Pinecone: 5 working indexes available (arthrologie-du-membre-superieur, urgences, psychiatrie, n8n, pbve)

## User Preferences

Preferred communication style: Simple, everyday language.
Database preference: Supabase PostgreSQL for production deployment.