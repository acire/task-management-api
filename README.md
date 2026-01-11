Aight y'all, it's Monday- time for a new challenge!!!!

This one is a little more API heavy, so it's fairly backend leaning. As before, you should be minimizing code- think about how you can make this as simple as possible!

Challenge: Task Management API
Build a REST API for a simple task management system with the following capabilities:

Create a new task (requires: title, optional: description, priority)
Retrieve all tasks with optional filtering (status, priority)
Retrieve information about a specific task by ID
Delete a specific task
Update a task's priority
Return summary statistics (total tasks, completed %, average completion time)

You will need to persist the data in a database, so that if the API goes down, the data is still there.

BONUS:
Every 60 seconds, a task should be "started", and then after 60 seconds, "completed". The server should handle starting and completing tasks. Ordering should be based on priority and when the task was recieved (FIFO)
Use a cache (e.g. redis, elasticache, etc) to prevent needing to query the database on every request.
Create a frontend that will allow a user to view and interact with tasks using the API routes.

---

Node + Express
TypeScript
SQLite file-backed DB
Drizzle ORM

---

Create a task:
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Pet the cat", "description": "Pet Souli, not Jeju", "priority": "HIGH"}'

Get tasks
curl "http://localhost:3000/tasks?priority=HIGH"
curl "http://localhost:3000/tasks?complete=true"
curl "http://localhost:3000/tasks?complete=false"

Get information about a specific task
curl "http://localhost:3000/tasks/1

Delete a task:
curl -X DELETE "http://localhost:3000/tasks/1"

Update a task:
curl -X PATCH "http://localhost:3000/tasks/1" -H "Content-Type: application/json" -d '{"title": "updated title", "priority": "LOW"}'