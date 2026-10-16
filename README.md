# Cloud Functions Performance Testing with JMeter & BlazeMeter

A production-ready solution for performance and load testing protected serverless endpoints deployed as Google Cloud Functions (Firebase Functions v2), complete with automated token generation, JMeter test plans, and BlazeMeter integration.

---

## 📁 Repository Structure

```
.
├── firebase.json              # Firebase configuration for Functions & Emulator
├── .firebaserc                # Active Firebase project mapping (<YOUR_FIREBASE_PROJECT_ID>)
├── functions/                 # TypeScript Cloud Functions codebase
│   ├── src/
│   │   └── index.ts           # Express app (/health, /auth, /protected)
│   ├── .env.example           # Environment variables template
│   ├── package.json
│   └── tsconfig.json
├── jmeter/
│   └── test-plan.jmx          # JMeter 5.x & BlazeMeter parameterized Test Plan
├── jmeter-manual/
│   └── jmeter-manual.jmx      # Minimal single-endpoint test plan for BlazeMeter
├── scripts/
│   └── generate-token.js      # Offline CLI utility to generate signed JWT tokens
├── BLAZEMETER_GUIDE.md        # Step-by-step instructions for running in BlazeMeter
└── README.md
```

---

## 🔒 Security & Environment Setup

Before running or deploying, copy the environment template:
```bash
cp functions/.env.example functions/.env
```
And set your own secure secrets:
- `JWT_SECRET`: A high-entropy secret string used to sign and verify JWT tokens.
- `TEST_USERNAME`: Username for load testing authentication.
- `TEST_PASSWORD`: Password for load testing authentication.

> [!WARNING]
> **Never commit your `.env` file or actual JWT tokens to version control.**  
> Keep `functions/.env` in `.gitignore`.

---

## 📖 API Reference & Usage Guide

When deployed, the function is accessible at:  
`https://<REGION>-<YOUR_FIREBASE_PROJECT_ID>.cloudfunctions.net/api`

### 1. Health Check (`GET /health`)
Verifies service uptime and availability. Requires no authentication.

- **URL:** `https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/health`
- **Method:** `GET`
- **Headers:** None required

#### Example Request (cURL):
```bash
curl -s "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/health"
```

#### Example Response (200 OK):
```json
{
  "status": "ok",
  "service": "jmeter-performance-test-api",
  "timestamp": "2026-10-16T17:38:11.125Z"
}
```

---

### 2. Generate Authentication Token (`POST /auth`)
Authenticates credentials and issues a signed JSON Web Token (JWT) Bearer token for protected route access.

- **URL:** `https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/auth`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Default Test Credentials:**
  - `username`: `testuser` (or value of `TEST_USERNAME`)
  - `password`: `password123` (or value of `TEST_PASSWORD`)

#### Example Request (cURL):
```bash
curl -s -X POST "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/auth" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

#### Example Response (200 OK):
```json
{
  "status": "success",
  "tokenType": "Bearer",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 7200
}
```

#### Error Response (401 Unauthorized):
```json
{
  "status": "error",
  "message": "Invalid credentials. Use username: 'testuser' and password: 'password123'."
}
```

---

### 3. Access Protected Endpoint (`GET` / `POST` `/protected`)
Executes business logic and measures server execution time. Requires a valid JWT token.

- **URL:** `https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/protected`
- **Method:** `GET` or `POST`
- **Required Header:**
  - `X-Authorization: Bearer <token>` *(Recommended for Google Cloud Functions / Cloud Run)*
  - Or `Authorization: Bearer <token>` *(When testing locally with Emulator)*
  - Or `X-Auth-Token: <token>`
  - Or Query param: `?token=<token>`

> [!NOTE]
> **Why `X-Authorization` on Cloud Functions?**  
> Google Cloud Run / Cloud Functions edge proxies inspect standard `Authorization: Bearer` headers to check for Google Cloud IAM identity tokens. Passing `X-Authorization: Bearer <token>` bypasses the GCP IAM proxy and delivers your custom application JWT directly to the Express handler.

- **Optional Query Parameter:**
  - `?delay=<ms>`: Artificially injects latency (1 to 5000 ms) to simulate database or downstream I/O latency for realistic stress testing.

#### Example Request - GET (cURL):
```bash
curl -s -X GET "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/protected" \
  -H "X-Authorization: Bearer <YOUR_JWT_TOKEN>"
```

#### Example Request - POST with Payload (cURL):
```bash
curl -s -X POST "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/protected" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"orderId": "1001", "items": ["itemA", "itemB"]}'
```

#### Example Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Access granted to protected endpoint!",
  "user": {
    "sub": "testuser",
    "role": "performance-tester"
  },
  "method": "GET",
  "processingDurationMs": 2,
  "serverTimestamp": "2026-10-16T17:42:21.098Z"
}
```

---

## ⚡ Complete One-Liner Test (cURL)

Fetch token and trigger the protected endpoint in a single pipeline:

```bash
TOKEN=$(curl -s -X POST "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4) && \
curl -s "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api/protected" \
  -H "X-Authorization: Bearer $TOKEN"
```

---

## 💻 Code Examples

### Node.js (fetch)
```javascript
const BASE_URL = "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api";

async function run() {
  // 1. Authenticate
  const authRes = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser", password: "password123" }),
  });
  const { token } = await authRes.json();

  // 2. Access protected endpoint
  const protectedRes = await fetch(`${BASE_URL}/protected`, {
    method: "GET",
    headers: { "X-Authorization": `Bearer ${token}` },
  });
  const data = await protectedRes.json();
  console.log("Protected API Response:", data);
}

run().catch(console.error);
```

### Python (requests)
```python
import requests

BASE_URL = "https://<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/api"

# 1. Authenticate
auth_res = requests.post(
    f"{BASE_URL}/auth",
    json={"username": "testuser", "password": "password123"}
)
token = auth_res.json()["token"]

# 2. Access protected endpoint
protected_res = requests.get(
    f"{BASE_URL}/protected",
    headers={"X-Authorization": f"Bearer {token}"}
)
print("Protected API Response:", protected_res.json())
```

---

## 🔑 Offline Token Generator

Generate signed JWT tokens locally without invoking `/auth`:

```bash
# Generate a token valid for 24 hours
node scripts/generate-token.js testuser 24h

# Generate a token valid for 7 days
node scripts/generate-token.js load-tester 7d
```

---

## 🛠 Local Emulator Development

To test the function locally with the Firebase Emulator (no billing or Google Cloud project required):

```bash
# 1. Start the emulator
npx -y firebase-tools@latest emulators:start --only functions

# 2. Test locally
TOKEN=$(curl -s -X POST "http://127.0.0.1:5001/<YOUR_PROJECT_ID>/<REGION>/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

curl -s "http://127.0.0.1:5001/<YOUR_PROJECT_ID>/<REGION>/api/protected" \
  -H "X-Authorization: Bearer $TOKEN"
```

---

## 📊 Running Load Tests with Apache JMeter

### Test Plan Workflow (`jmeter/test-plan.jmx`):
1. `01 - Generate JWT Token (/auth)`: Sends credentials, extracts `token` into variable `${JWT_TOKEN}` via JSON PostProcessor.
2. `02 - Trigger Protected Endpoint (/protected)`: Sends request with `X-Authorization: Bearer ${JWT_TOKEN}` and validates response code `200` and body content.

### Command Line Execution:

#### Against Deployed Cloud Function:
```bash
jmeter -n -t jmeter/test-plan.jmx \
  -Jprotocol=https \
  -Jhost=<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net \
  -Jport=443 \
  -Jpath_prefix=/api \
  -Jthreads=25 \
  -Jduration=60 \
  -Jramp_time=5 \
  -l jmeter/results.jtl \
  -e -o jmeter/html-report
```

#### Against Local Emulator:
```bash
jmeter -n -t jmeter/test-plan.jmx \
  -Jprotocol=http \
  -Jhost=127.0.0.1 \
  -Jport=5001 \
  -Jpath_prefix=/<YOUR_PROJECT_ID>/<REGION>/api \
  -Jthreads=10 \
  -Jduration=30 \
  -Jramp_time=2
```

---

## ⚡ Running in BlazeMeter

1. Log in to [BlazeMeter](https://a.blazemeter.com/) and create a **JMeter Test**.
2. Upload `jmeter/test-plan.jmx` (or `jmeter-manual/jmeter-manual.jmx`).
3. In the **JMeter Properties** table, configure:
   - `protocol`: `https`
   - `host`: `<REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net`
   - `port`: `443`
   - `path_prefix`: `/api`
   - `API_TOKEN`: `<your_pre_generated_token>` *(if using `jmeter-manual.jmx`)*
4. Set desired concurrency and click **Run Test**.

For detailed setup instructions and screenshots, see **[BLAZEMETER_GUIDE.md](file:///Users/krishnasahu/Documents/Projects/jmeter-test/BLAZEMETER_GUIDE.md)**.
