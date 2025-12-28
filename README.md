# Accordli API

A production-ready Node.js + Express + TypeScript REST API with PostgreSQL 17, featuring JWT authentication, connection pooling, and DAO pattern.

## Features

- **TypeScript** - Full type safety
- **Express** - Fast, minimalist web framework
- **PostgreSQL 17** - Robust relational database
- **Connection Pool** - Efficient database connection management with `pg`
- **DAO Pattern** - Clean data access layer with prepared statements
- **JWT Authentication** - Secure token-based auth with refresh tokens
- **Request Validation** - Input validation with Zod
- **Error Handling** - Centralized error handling with custom error classes
- **Security** - Helmet, CORS, rate limiting
- **Logging** - Winston logger with file and console transports
- **Static File Serving** - Serve frontend applications

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL 17
- npm or yarn

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration, especially:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `JWT_SECRET` - A secure random string (min 32 chars)
   - `JWT_REFRESH_SECRET` - Another secure random string (min 32 chars)

4. Create the database and run the seed script:

```bash
npm run db:seed
```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT specified in `.env`)

## Production

Build the TypeScript code:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API Endpoints

### Public Endpoints

#### Health Check
```
GET /api/v1/health
```

#### Authentication

**Register**
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Login**
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Refresh Token**
```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

**Logout**
```
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Protected Endpoints

These endpoints require an `Authorization: Bearer <token>` header.

**Get Current User**
```
GET /api/v1/users/me
Authorization: Bearer <access-token>
```

**Get All Users**
```
GET /api/v1/users?limit=100&offset=0
Authorization: Bearer <access-token>
```

## Project Structure

```
src/
├── config/           # Configuration files
│   └── env.ts       # Environment variable validation
├── controllers/     # Request handlers
│   ├── auth.controller.ts
│   └── user.controller.ts
├── db/              # Database layer
│   ├── dao/         # Data Access Objects
│   │   ├── base.dao.ts
│   │   ├── user.dao.ts
│   │   └── refresh-token.dao.ts
│   ├── pool.ts      # Database connection pool
│   └── seed.ts      # Database schema seed script
├── middleware/      # Express middleware
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── validate.middleware.ts
├── routes/          # Route definitions
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   └── index.ts
├── services/        # Business logic
│   └── auth.service.ts
├── types/           # TypeScript types and interfaces
│   └── index.ts
├── utils/           # Utility functions
│   ├── errors.ts    # Custom error classes
│   └── logger.ts    # Winston logger configuration
├── app.ts           # Express app setup
└── index.ts         # Server entry point
```

## Database Schema

### Users Table
- `id` (UUID, primary key)
- `email` (VARCHAR, unique)
- `password` (VARCHAR, hashed)
- `first_name` (VARCHAR, optional)
- `last_name` (VARCHAR, optional)
- `is_active` (BOOLEAN, default true)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Refresh Tokens Table
- `id` (UUID, primary key)
- `token` (VARCHAR, unique)
- `user_id` (UUID, foreign key)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:seed` - Run database seed script
- `npm run lint` - Lint TypeScript files
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types

## Environment Variables

See `.env.example` for all available configuration options.

## Security Best Practices

- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens with configurable expiration
- Refresh token rotation on refresh
- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation with Zod
- Prepared statements to prevent SQL injection
- Connection pool with timeouts

## Static File Serving

Place your built frontend application in the `public/` directory. The server will:
1. Serve API routes at `/api/v1/*`
2. Serve static files from `public/`
3. Serve `public/index.html` for all other routes (SPA support)

## License

MIT
