import { onRequest } from "firebase-functions/v2/https";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();

// Enable CORS for all incoming requests (useful for browser/BlazeMeter clients)
app.use(cors({ origin: true }));
app.use(express.json());

// Secret key for JWT signing & verification (override via environment variable JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret-change-in-production";
const TEST_USERNAME = process.env.TEST_USERNAME || "testuser";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "password123";
const DEFAULT_EXPIRATION = "2h";

// Middleware to record request start time
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).startTime = Date.now();
  next();
});

/**
 * Health check endpoint (Public)
 */
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "jmeter-performance-test-api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Authentication Endpoint (Public)
 * Generates a signed JWT Bearer token.
 * POST /auth
 * Body: { "username": "testuser", "password": "password123" }
 */
app.post("/auth", (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  // For performance testing, validate against known credentials
  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "Please provide username and password in JSON body.",
    });
  }

  // Credentials check (configurable via TEST_USERNAME and TEST_PASSWORD env vars)
  if (username === TEST_USERNAME && password === TEST_PASSWORD) {
    const payload = {
      sub: username,
      role: "performance-tester",
      iss: "firebase-cloud-functions",
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: DEFAULT_EXPIRATION });

    return res.status(200).json({
      status: "success",
      tokenType: "Bearer",
      token,
      expiresIn: 7200, // 2 hours in seconds
    });
  }

  return res.status(401).json({
    status: "error",
    message: "Invalid credentials. Use username: 'testuser' and password: 'password123'.",
  });
});

/**
 * JWT Verification Middleware for protected routes
 */
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader =
    (req.headers["x-authorization"] as string) ||
    (req.headers["authorization"] as string) ||
    (req.headers["x-auth-token"] as string);

  let token: string | undefined;

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1];
    } else if (parts.length === 1) {
      token = parts[0];
    }
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      status: "error",
      message:
        "Missing authorization credentials. Use 'X-Authorization: Bearer <token>' or 'Authorization: Bearer <token>'",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    return next();
  } catch (error: any) {
    return res.status(403).json({
      status: "error",
      message: "Token verification failed.",
      error: error.message,
    });
  }
}

/**
 * Protected Endpoint (Requires valid JWT Bearer token)
 * GET or POST /protected
 * Header: Authorization: Bearer <token>
 * Optional query param: ?delay=100 (simulates latency in ms)
 */
app.all("/protected", authenticateToken, async (req: Request, res: Response) => {
  const delayMs = parseInt(req.query.delay as string, 10);
  if (!isNaN(delayMs) && delayMs > 0 && delayMs <= 5000) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const durationMs = Date.now() - (req as any).startTime;

  return res.status(200).json({
    status: "success",
    message: "Access granted to protected endpoint!",
    user: (req as any).user,
    method: req.method,
    processingDurationMs: durationMs,
    serverTimestamp: new Date().toISOString(),
  });
});

/**
 * Fallback 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: `Route '${req.originalUrl}' not found. Available routes: /health, /auth, /protected`,
  });
});

// Export Cloud Function v2 with concurrency configuration for performance testing
export const api = onRequest(
  {
    cors: true,
    concurrency: 80, // allows high concurrent requests per instance
    maxInstances: 20, // scale up to 20 instances under load
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  app
);
