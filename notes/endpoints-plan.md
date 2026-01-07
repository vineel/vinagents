## 2. API Endpoints

### 2.1 Launch Agent

```
POST /api/agents/:agentType/run
```

**Request Body:**
```json
{
  "input": {
    "prompt": "Analyze this text...",
    "options": {}
  }
}
```

**Response (202 Accepted):**
```json
{
  "runId": "uuid",
  "status": "pending",
  "pollUrl": "/api/agents/runs/uuid",
  "createdAt": "2025-01-06T..."
}
```

**Implementation:**
1. Validate user authentication
2. Validate agent type exists
3. Insert row into `agent_runs`
4. Enqueue job with PG-BOSS
5. Update `pgboss_job_id` in agent_runs
6. Return run_id to client

### 2.2 Get Run Status

```
GET /api/agents/runs/:runId
```

**Query Params:**
- `includeMessages=true` - Include status messages
- `messagesSince=timestamp` - Only messages after this time (for efficient polling)

**Response:**
```json
{
  "runId": "uuid",
  "agentType": "simple",
  "status": "running",
  "currentStep": 2,
  "totalSteps": 3,
  "input": {},
  "output": null,
  "error": null,
  "createdAt": "...",
  "startedAt": "...",
  "completedAt": null,
  "messages": [
    {
      "messageId": "uuid",
      "level": "info",
      "message": "Starting LLM call to GPT-4.1-nano",
      "stepNumber": 1,
      "createdAt": "..."
    }
  ]
}
```

### 2.3 Cancel Run

```
POST /api/agents/runs/:runId/cancel
```

**Response (200 OK):**
```json
{
  "runId": "uuid",
  "status": "cancel_requested",
  "message": "Cancellation requested. Run will stop after current step."
}
```

**Implementation:**
1. Check run belongs to user
2. Check run is in `pending` or `running` status
3. Update status to `cancel_requested`
4. If `pending`, also cancel the PG-BOSS job directly
5. Return acknowledgment

### 2.4 List User Runs

```
GET /api/agents/runs
```

**Query Params:**
- `status` - Filter by status
- `agentType` - Filter by agent type
- `limit` - Default 20, max 100
- `offset` - For pagination

**Response:**
```json
{
  "runs": [...],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```
