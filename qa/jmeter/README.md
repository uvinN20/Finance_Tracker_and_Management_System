# Finora JMeter Load Test

`Finora API Load Test.jmx` exercises two read-only authenticated endpoints: `GET /api/dashboard` and `GET /api/transactions?limit=20`. Both requests require a valid bearer token and assert HTTP 200.

## Safe test setup

1. Install Apache JMeter and a supported Java runtime.
2. Run Finora against a disposable development/test MongoDB database.
3. Register a dummy QA account and obtain a current JWT from the login API.
4. Do not use production URLs, real credentials, or production tokens.

## Example run

From this folder, provide the host, token, and load profile as JMeter properties:

```powershell
jmeter -n -t "Finora API Load Test.jmx" `
  -Jhost=127.0.0.1 -Jport=5000 `
  -JauthToken="REPLACE_WITH_A_TEST_TOKEN" `
  -Jthreads=10 -JrampUpSeconds=30 -Jiterations=5 `
  -l finora-load-results.jtl -e -o finora-load-report
```

The plan defaults to 10 virtual users, a 30-second ramp-up, and five iterations. Each user requests both endpoints five times, giving 50 requests per endpoint. Use a separate results file and empty report folder for each run.

## Recorded local runs

Date: 2026-11-23. Apache JMeter 5.6.3, Java 21, local Finora API, and isolated `finora_qa_automation` MongoDB database. All samples returned HTTP 200. The 1-user and 100-user profiles were run in this session; the 10-user and 50-user results are from the earlier local runs documented for this project.

| Users | Endpoint | Samples | Errors | Average (ms) | p95 (ms) | Max (ms) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | `/api/dashboard` | 5 | 0 | 13.60 | 34 | 34 |
| 1 | `/api/transactions?limit=20` | 5 | 0 | 7.00 | 8 | 8 |
| 10 | `/api/dashboard` | 50 | 0 | 9.46 | 15 | 46 |
| 10 | `/api/transactions?limit=20` | 50 | 0 | 7.36 | 10 | 13 |
| 50 | `/api/dashboard` | 250 | 0 | 7.81 | 13 | 31 |
| 50 | `/api/transactions?limit=20` | 250 | 0 | 6.72 | 10 | 18 |
| 100 | `/api/dashboard` | 500 | 0 | 8.39 | 12 | 29 |
| 100 | `/api/transactions?limit=20` | 500 | 0 | 7.51 | 10 | 13 |

The 100-user JMeter run completed 1,000 samples in 30 seconds at 33.6 samples/second, with 0 errors. The 1-user profile is a baseline with only five samples per endpoint, so its throughput is not meaningful. These are short local smoke profiles, not a capacity benchmark or production SLA. Results depend on the local machine, dataset, and database state; a sustained run on representative hardware and data is required for capacity conclusions.
