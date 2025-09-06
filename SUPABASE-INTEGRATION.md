# Supabase Database Integration Guide

## Overview

This document provides comprehensive information about the Supabase PostgreSQL database integration in the ECOS Medical Training Platform. The application uses Supabase as its primary database with a sophisticated connection management system optimized for serverless deployment.

## 🏗️ Database Architecture

### Supabase Setup

The application connects to Supabase PostgreSQL database using both REST API and direct PostgreSQL connections:

- **Primary Connection**: Supabase REST API via `@supabase/supabase-js`
- **Direct Connection**: PostgreSQL protocol for complex queries (when needed)
- **ORM Integration**: Drizzle ORM for type-safe database operations
- **Schema Management**: Version-controlled migrations and schema definitions

### Connection Strategy

The application implements a **Unified Database Service** pattern for optimal performance:

```typescript
// server/services/unified-database.service.ts
export class UnifiedDatabaseService {
  private supabase: SupabaseClient;
  private metrics: DatabaseMetrics;
  
  async initialize(): Promise<void> {
    // Single initialization point
    // Automatic URL conversion (PostgreSQL -> HTTP)
    // Health check validation
    // Connection metrics tracking
  }
}
```

## 🔧 Configuration Setup

### Environment Variables

Required environment variables for Supabase integration:

```env
# Supabase Configuration
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Service role key for admin operations
SUPABASE_ANON_KEY=eyJhbGc...          # Anonymous key for client operations

# Alternative: Direct PostgreSQL connection
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### Drizzle ORM Configuration

Database ORM configuration in `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",              # Migration files directory
  schema: "./shared/schema.ts",     # Schema definition file
  dialect: "postgresql",           # Database dialect
  dbCredentials: {
    url: process.env.DATABASE_URL!, # Connection string
  },
});
```

### Connection Pool Configuration

Optimized for serverless environments:

```typescript
// Serverless-optimized connection settings
const connectionConfig = {
  maxConnections: 5,        # Conservative limit for serverless
  idleTimeout: 30,          # 30 seconds idle timeout
  connectTimeout: 15,       # 15 seconds connection timeout
  retryAttempts: 3,         # Connection retry attempts
  retryDelay: 1000         # 1 second base retry delay
};
```

## 📊 Database Schema

### Core Tables Structure

#### User Management
```sql
-- users: User authentication and profile data
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- sessions: Session management for authentication
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
```

#### Chat System
```sql
-- exchanges: Chat conversation history
CREATE TABLE exchanges (
  id_exchange SERIAL PRIMARY KEY,
  utilisateur_email TEXT NOT NULL,
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- daily_counters: Usage tracking and limits
CREATE TABLE daily_counters (
  utilisateur_email TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  count INTEGER DEFAULT 0
);
```

#### ECOS Medical Training
```sql
-- ecos_scenarios: Medical examination scenarios
CREATE TABLE ecos_scenarios (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  patient_prompt TEXT NOT NULL,
  evaluation_criteria JSONB NOT NULL,
  pinecone_index VARCHAR(255),
  image_url VARCHAR(500),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ecos_sessions: Student examination sessions
CREATE TABLE ecos_sessions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES ecos_scenarios(id),
  student_email VARCHAR(255) NOT NULL,
  training_session_id INTEGER REFERENCES training_sessions(id),
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress'
);

-- ecos_messages: Chat messages during examinations
CREATE TABLE ecos_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ecos_evaluations: Assessment scores and feedback
CREATE TABLE ecos_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  criterion_id VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  feedback TEXT
);
```

#### Training Management
```sql
-- training_sessions: Structured training modules
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- training_session_students: Student-session associations
CREATE TABLE training_session_students (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id),
  student_email VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- training_session_scenarios: Scenario-session associations
CREATE TABLE training_session_scenarios (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id),
  scenario_id INTEGER REFERENCES ecos_scenarios(id)
);
```

## 🚀 Database Service Integration

### Primary Database Service Implementation

**File**: `server/services/supabase-client.service.ts`

The application uses a **SupabaseClientService** as the main database interface:

#### Implementation Details
```typescript
// server/services/supabase-client.service.ts
export class SupabaseClientService {
  private supabase: any = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.isConnected && this.supabase) return;

    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    // Automatic PostgreSQL URL to HTTP URL conversion
    if (supabaseUrl.startsWith('postgresql://')) {
      const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
      if (match) {
        const projectId = match[1];
        supabaseUrl = `https://${projectId}.supabase.co`;
      }
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Health check against scenarios table
    const { data, error } = await this.supabase
      .from('scenarios')
      .select('count')
      .limit(1);
      
    this.isConnected = true;
  }
}
```

#### Key Service Methods

```typescript
class SupabaseClientService {
  // Scenario Management
  async getScenarios(): Promise<any[]>
  async createScenario(scenarioData: any): Promise<any>
  async updateScenario(id: string, updates: any): Promise<any>
  async deleteScenario(id: string): Promise<void>

  // Connection & Health
  private async createTables(): Promise<void>
  async connect(): Promise<void>
}
```

### Alternative Service Implementations

The project includes multiple database service strategies for different deployment scenarios:

#### Available Services in `server/services/`
- **`simple-supabase.service.ts`** - Basic Supabase connection
- **`robust-supabase.service.ts`** - Enhanced error handling and retry logic
- **`direct-supabase.service.ts`** - Direct PostgreSQL connection approach
- **`alternative-supabase.service.ts`** - Alternative connection strategy
- **`ipv6-supabase.service.ts`** - IPv6-optimized connection handling
- **`pg-ipv6-supabase.service.ts`** - PostgreSQL with IPv6 support
- **`direct-url-supabase.service.ts`** - Direct URL connection method

### Connection Management

#### Automatic URL Conversion Implementation
Implemented in the main service (`server/services/supabase-client.service.ts`):

```typescript
// lines 20-27 in supabase-client.service.ts
if (supabaseUrl.startsWith('postgresql://')) {
  const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
  if (match) {
    const projectId = match[1];
    supabaseUrl = `https://${projectId}.supabase.co`;
    console.log('🔄 Converted PostgreSQL URL to Supabase HTTP URL:', supabaseUrl);
  }
}
```

#### Table Auto-Creation
```typescript
// lines 54-74 in supabase-client.service.ts
private async createTables(): Promise<void> {
  const { error } = await this.supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS scenarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        patient_prompt TEXT,
        evaluation_criteria TEXT,
        image_url TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  }).catch(() => {
    console.log('⚠️ Cannot create table automatically');
  });
}
```

#### Health Check Implementation
```typescript
private async _performHealthCheck(): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { error } = await this.supabase
      .from('scenarios')
      .select('id')
      .limit(1);
      
    if (error && !error.message.includes('does not exist')) {
      throw error;
    }
    
    this.metrics.responseTime = Date.now() - startTime;
  } catch (error) {
    // Graceful handling of missing tables
    if (!error.message.includes('does not exist')) {
      throw error;
    }
  }
}
```

## 🔄 Migration Management

### Schema Migrations

Database migrations are managed through Drizzle Kit:

```bash
# Push schema changes to database
npm run db:push

# Generate migration files
drizzle-kit generate

# View current schema
drizzle-kit introspect
```

### Migration Files Structure
```
migrations/
├── 0001_initial_schema.sql
├── 0002_ecos_tables.sql
├── 0003_training_sessions.sql
└── meta/
    ├── _journal.json
    └── 0001_snapshot.json
```

### Example Migration
```sql
-- migrations/0002_ecos_tables.sql
CREATE TABLE IF NOT EXISTS "ecos_scenarios" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "patient_prompt" text NOT NULL,
  "evaluation_criteria" jsonb NOT NULL,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ecos_scenarios_created_by" 
ON "ecos_scenarios" ("created_by");
```

## 📡 API Integration Patterns

### REST API Usage

The application primarily uses Supabase REST API for database operations:

```typescript
// Fetch scenarios with filtering and ordering
const { data, error } = await supabase
  .from('scenarios')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);

// Insert new scenario
const { data, error } = await supabase
  .from('scenarios')
  .insert({
    title: 'New Scenario',
    description: 'Scenario description',
    patient_prompt: 'Patient background...',
    evaluation_criteria: { criteria: [] },
    created_by: 'teacher@example.com'
  })
  .select()
  .single();

// Update existing scenario
const { data, error } = await supabase
  .from('scenarios')
  .update({ title: 'Updated Title' })
  .eq('id', scenarioId)
  .select()
  .single();
```

### Error Handling Patterns

```typescript
// Comprehensive error handling
try {
  const scenarios = await unifiedDb.getScenarios();
  return { success: true, data: scenarios };
} catch (error: any) {
  if (error.message.includes('does not exist')) {
    // Table doesn't exist - return empty array
    return { success: true, data: [] };
  } else if (error.code === 'PGRST116') {
    // No rows returned - expected for some queries
    return { success: true, data: null };
  } else {
    // Actual error - log and throw
    console.error('Database error:', error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
```

## 🔒 Security Configuration

### Row Level Security (RLS)

Supabase RLS policies for data protection:

```sql
-- Enable RLS on scenarios table
ALTER TABLE ecos_scenarios ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read scenarios they created or are assigned to
CREATE POLICY "scenarios_read_policy" ON ecos_scenarios
  FOR SELECT USING (
    created_by = auth.email() OR 
    id IN (
      SELECT scenario_id FROM training_session_scenarios tss
      JOIN training_session_students tst ON tss.training_session_id = tst.training_session_id
      WHERE tst.student_email = auth.email()
    )
  );

-- Policy: Only authenticated users can create scenarios
CREATE POLICY "scenarios_create_policy" ON ecos_scenarios
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### API Key Management

```typescript
// Service role key for admin operations (server-side only)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Anonymous key for client operations
const anonKey = process.env.SUPABASE_ANON_KEY;

// Create client with appropriate key based on context
const supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  isServerSide ? serviceRoleKey : anonKey
);
```

## 📊 Performance Optimization

### Query Optimization

```typescript
// Optimized scenario fetching with selective fields
const { data } = await supabase
  .from('scenarios')
  .select(`
    id,
    title,
    description,
    image_url,
    created_at,
    ecos_sessions!inner(
      id,
      status,
      student_email
    )
  `)
  .eq('ecos_sessions.status', 'completed')
  .order('created_at', { ascending: false });
```

### Caching Strategy

```typescript
// In-memory caching for frequently accessed data
class DatabaseCache {
  private cache = new Map();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async getScenarios(): Promise<Scenario[]> {
    const cacheKey = 'scenarios';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const scenarios = await unifiedDb.getScenarios();
    this.cache.set(cacheKey, {
      data: scenarios,
      timestamp: Date.now()
    });
    
    return scenarios;
  }
}
```

## 🔍 Monitoring & Debugging

### Database Metrics

The service tracks comprehensive metrics:

```typescript
interface DatabaseMetrics {
  connectionAttempts: number;      # Total connection attempts
  successfulConnections: number;  # Successful connections
  failedConnections: number;       # Failed connections
  lastConnectionTime: Date;        # Last successful connection
  isHealthy: boolean;             # Current health status
  responseTime: number;           # Last query response time (ms)
}
```

### Health Check Endpoints

```typescript
// GET /api/health
{
  "status": "healthy",
  "timestamp": "2025-09-06T10:30:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 150,
      "connectionPool": {
        "active": 2,
        "idle": 3,
        "total": 5
      }
    }
  }
}
```

### Debug Tools

#### Available Testing Scripts
```bash
# Test Supabase connection directly
node test-supabase-connection.js

# Test direct Supabase connection
node test-supabase-direct.js

# Validate database schema
npm run db:push

# Check migration status
drizzle-kit check

# Database health check
curl https://your-app.vercel.app/api/health
```

#### Connection Test Files
The project includes multiple connection test files:
- **`test-supabase-connection.js`** - Basic connection testing
- **`test-supabase-direct.js`** - Direct connection testing

These files test various connection strategies and provide debugging information for troubleshooting database connectivity issues.

## 🚨 Error Recovery & Resilience

### Circuit Breaker Pattern

```typescript
class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private threshold = 5;          // Max failures before opening
  private timeout = 30000;        // 30 seconds timeout
  private state = 'CLOSED';       // CLOSED | OPEN | HALF_OPEN

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

## 📝 Best Practices

### Connection Management
1. **Single Service Instance**: Use UnifiedDatabaseService singleton
2. **Connection Reuse**: Reuse Supabase client across requests
3. **Graceful Degradation**: Handle missing tables gracefully
4. **Health Monitoring**: Continuous health check monitoring
5. **Error Logging**: Comprehensive error logging with context

### Query Optimization
1. **Selective Fields**: Only select needed fields
2. **Proper Indexing**: Index frequently queried columns
3. **Batch Operations**: Group related operations
4. **Connection Limits**: Respect serverless connection limits
5. **Query Caching**: Cache frequently accessed data

### Security
1. **RLS Policies**: Implement row-level security
2. **Key Management**: Secure API key handling
3. **Input Validation**: Validate all inputs
4. **Audit Logging**: Track database operations
5. **Access Control**: Proper role-based access

## 🔧 Maintenance & Operations

### Regular Maintenance Tasks

```bash
# Weekly: Check database health
npm run health:check

# Monthly: Analyze query performance
npm run db:analyze

# As needed: Update dependencies
npm update @supabase/supabase-js

# Schema changes: Generate and apply migrations
npm run db:push
```

### Backup & Recovery

```sql
-- Manual backup (if needed)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

-- Restore from backup
psql $DATABASE_URL < backup_file.sql
```

### Performance Monitoring

```typescript
// Monitor slow queries
const slowQueryThreshold = 1000; // 1 second

if (queryTime > slowQueryThreshold) {
  console.warn(`Slow query detected: ${queryTime}ms`, {
    query: queryName,
    params: queryParams,
    timestamp: new Date().toISOString()
  });
}
```

---

**Last Updated**: September 2025  
**Version**: 2.0.0  
**Status**: Production Ready