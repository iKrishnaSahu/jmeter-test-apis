# BlazeMeter Performance Testing Guide

This guide explains how to upload, configure, and execute load tests on your protected Cloud Function using **BlazeMeter** and the provided JMeter test plan (`jmeter/test-plan.jmx`).

---

## 1. Prerequisites

1. A free or enterprise account on [BlazeMeter](https://www.blazemeter.com/).
2. Your deployed Cloud Function URL (or local tunnel if testing behind a proxy).

---

## 2. Test Plan Architecture in BlazeMeter

The provided `test-plan.jmx` is designed to run out-of-the-box in BlazeMeter:

```
[ Thread Group / Virtual Users ]
       │
       ├─► Step 1: POST ${PATH_PREFIX}/auth
       │     └─► JSON PostProcessor extracts $.token -> ${JWT_TOKEN}
       │     └─► Response Assertion: HTTP 200
       │
       └─► Step 2: GET ${PATH_PREFIX}/protected
             └─► Header Manager: X-Authorization: Bearer ${JWT_TOKEN}
             └─► Response Assertion: HTTP 200 & "Access granted"
```

Each virtual user simulates an authentic user journey: authenticating to obtain a token and immediately exercising the protected endpoint.

---

## 3. Step-by-Step BlazeMeter Setup

### Step 3.1: Create a New Test
1. Log in to [BlazeMeter](https://a.blazemeter.com/).
2. Click **Create Test** (or **Performance Test**).
3. Select **JMeter Test**.

### Step 3.2: Upload the Script
1. Drag and drop `jmeter/test-plan.jmx` into the **Upload Files** section.
2. BlazeMeter will parse the `.jmx` file automatically.

### Step 3.3: Configure JMeter Properties (Overrides)
In BlazeMeter, scroll down to the **JMeter Properties** table. You can override the default parameters without editing the XML file:

| Property Name | Example Value (Cloud Function) | Description |
|---|---|---|
| `protocol` | `https` | Protocol (`https` for cloud, `http` for local) |
| `host` | `us-central1-<your-project-id>.cloudfunctions.net` | Your Cloud Function domain |
| `port` | `443` | `443` for HTTPS |
| `path_prefix` | `/api` | Base path for the Cloud Function |
| `auth_user` | `testuser` | Username for `/auth` |
| `auth_pass` | `password123` | Password for `/auth` |

### Step 3.4: Configure Load & Concurrency
Under **Load Configuration**:
- **Total Users / Concurrency**: e.g. `50` to `500` Virtual Users.
- **Ramp-up Time**: e.g. `2` minutes (gradual ramp-up gives Cloud Functions time to scale up instances).
- **Duration**: e.g. `10` minutes.
- **Locations / Engines**: Select the cloud engine location closest to your Cloud Function region (e.g., Google Cloud us-central1 / Virginia).

---

## 4. Running the Test & Analyzing Results

Click **Run Test** in the top right.

### Key Metrics to Monitor:
1. **Summary / Timeline**:
   - **Throughput (Hits/sec)**: How many requests per second the function sustains.
   - **Response Time**: Latency distribution (Avg, 90th percentile, 99th percentile). Look for cold-start spikes vs warm-instance response times (< 20ms).
   - **Error %**: Expected to be `0.00%`. If 401/403 errors appear, verify token issuance.
2. **Errors Tab**:
   - Inspect any assertion or HTTP errors if Cloud Function concurrency limits are hit.
3. **Engine Health**:
   - Ensure BlazeMeter load generators did not experience CPU/memory bottlenecks.

---

## 5. Alternative Scenario: Testing Only Protected Endpoint (Static Tokens)

If you wish to test *only* the `/protected` endpoint at massive scale without generating load on `/auth`:

1. Run the token generator locally:
   ```bash
   node scripts/generate-token.js testuser 48h
   ```
2. Copy the token.
3. In BlazeMeter (or JMeter), you can create a test plan with a single HTTP sampler targeting `/protected` with `Authorization: Bearer <your-pre-generated-token>`.
