# Task Management API

A REST API for a simple task management system.

## Features

- Create, read, update, and delete tasks
- Filter tasks by priority and completion status
- Start and complete tasks with timestamps
- Summary statistics (total tasks, completion %, average completion time)

## Tech Stack

- Node.js + Express
- TypeScript
- SQLite (file-backed)
- Drizzle ORM
- Zod (validation)
- Redis (for caching)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd task-management-api

# Install dependencies
npm install

# Create .env file
echo "DB_FILE_NAME=local.db" > .env

# Initialize the database
npm run db:push
```

## Running Redis

The API uses Redis for caching. Start Redis before running the server:

**Docker**

```bash
docker run -d -p 6379:6379 --name redis redis
```

**Verify Redis is running:**

```bash
redis-cli ping
# Should respond: PONG
```

## Running the Server

```bash
# Development (with hot reload)
npm run watch

# Production
npm run start
```

The server runs on `http://localhost:3000` by default.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Create a new task |
| GET | `/tasks` | Get all tasks (filterable) |
| GET | `/tasks/:id` | Get a specific task |
| PATCH | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| POST | `/tasks/:id/start` | Start a task |
| POST | `/tasks/:id/complete` | Complete a task |
| GET | `/summary` | Get summary statistics |

## Example Commands

**Create a task:**

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Pet the cat", "description": "Pet Souli, not Jeju", "priority": "HIGH"}'
```

**Get tasks:**

```bash
# Filter by priority
curl "http://localhost:3000/tasks?priority=HIGH"

# Filter by completion status
curl "http://localhost:3000/tasks?complete=true"
curl "http://localhost:3000/tasks?complete=false"
```

**Get a specific task:**

```bash
curl "http://localhost:3000/tasks/1"
```

**Delete a task:**

```bash
curl -X DELETE "http://localhost:3000/tasks/1"
```

**Update a task:**

```bash
curl -X PATCH "http://localhost:3000/tasks/1" \
  -H "Content-Type: application/json" \
  -d '{"title": "updated title", "priority": "LOW"}'
```

**Start a task:**

```bash
curl -X POST "http://localhost:3000/tasks/1/start"
```

**Complete a task:**

```bash
curl -X POST "http://localhost:3000/tasks/1/complete"
```

**Get summary statistics:**

```bash
curl "http://localhost:3000/summary"
```

---

## Challenge Description

This one is a little more API heavy, so it's fairly backend leaning. As before, you should be minimizing code- think about how you can make this as simple as possible!

Challenge: Task Management API
Build a REST API for a simple task management system with the following capabilities:

- Create a new task (requires: title, optional: description, priority)
- Retrieve all tasks with optional filtering (status, priority)
- Retrieve information about a specific task by ID
- Delete a specific task
- Update a task's priority
- Return summary statistics (total tasks, completed %, average completion time)

You will need to persist the data in a database, so that if the API goes down, the data is still there.

BONUS:
- Every 60 seconds, a task should be "started", and then after 60 seconds, "completed". The server should handle starting and completing tasks. Ordering should be based on priority and when the task was recieved (FIFO)
- Use a cache (e.g. redis, elasticache, etc) to prevent needing to query the database on every request.
- Create a frontend that will allow a user to view and interact with tasks using the API routes.