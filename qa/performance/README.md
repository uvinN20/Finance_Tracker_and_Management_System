# Finora Performance QA

## Executable exploratory smoke

`load-smoke.cjs` registers one unique QA user, sends authenticated read-only requests to the dashboard and transaction-list endpoints, then removes only that user's related records. It refuses cleanup unless `MONGO_URI` names a database containing `qa`, `test`, or `ci`.

Run from the backend directory with a disposable database and healthy API:

```powershell
$env:MONGO_URI = "mongodb://127.0.0.1:27017/finora_qa"
$env:LOAD_CONCURRENCY = "10"
$env:LOAD_REQUESTS_PER_ENDPOINT = "5"
node "..\qa\performance\load-smoke.cjs"
```

This built-in Node.js smoke profile complements the Apache JMeter plan in [`../jmeter/README.md`](../jmeter/README.md). It is exploratory, not a capacity benchmark: it does not model many unique users, long-duration traffic, or production-sized data.

## Observed local run

Date: 2026-11-23, after dependency security updates. API and MongoDB ran locally against the dedicated `finora_qa_automation` database. Each row includes one sequential warm-up request followed by five requests per virtual user. All responses were HTTP 200; generated QA users were removed after each run.

| Concurrent users | Endpoint | Samples | Errors | Warm-up (ms) | Average (ms) | p95 (ms) | Max (ms) |
|---:|---|---:|---:|---:|---:|---:|---:|
| 10 | `/api/dashboard` | 50 | 0 | 10.67 | 35.11 | 53.68 | 68.48 |
| 10 | `/api/transactions?limit=20` | 50 | 0 | 6.42 | 15.78 | 22.08 | 24.41 |
| 50 | `/api/dashboard` | 250 | 0 | 10.44 | 125.05 | 174.61 | 237.91 |
| 50 | `/api/transactions?limit=20` | 250 | 0 | 7.07 | 56.27 | 73.79 | 104.99 |

The 50-user Node profile increased latency while returning zero errors. At 100 users this exploratory Node run also returned zero errors, with dashboard p95 364.74 ms and transaction-list p95 134.61 ms. Results are machine- and dataset-specific and do not establish a production SLA. Formal short JMeter profiles were run at 1, 10, 50, and 100 users; see [`../jmeter/README.md`](../jmeter/README.md) for those separate measurements.


### Additional Node smoke profiles

Date: 2026-11-23. Same isolated local API/database; five requests per endpoint per user. These exploratory measurements complement, but do not replace, the JMeter results above.

| Concurrent users | Endpoint | Samples | Errors | Warm-up (ms) | Average (ms) | p95 (ms) | Max (ms) |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | `/api/dashboard` | 5 | 0 | 9.96 | 7.89 | 9.21 | 9.21 |
| 1 | `/api/transactions?limit=20` | 5 | 0 | 8.19 | 7.91 | 8.99 | 8.99 |
| 100 | `/api/dashboard` | 500 | 0 | 9.68 | 249.88 | 364.74 | 451.05 |
| 100 | `/api/transactions?limit=20` | 500 | 0 | 6.28 | 102.28 | 134.61 | 196.70 |

### Extended 100-concurrent-user exploratory run

Date: 2026-11-23. The same isolated QA API/database handled 30 sequential requests per endpoint for each of 100 concurrent workers. This produced 3,000 samples per endpoint (6,000 total); the generated QA user and related records were removed after the run.

| Concurrent users | Endpoint | Samples | Errors | Warm-up (ms) | Average (ms) | p95 (ms) | Max (ms) |
|---:|---|---:|---:|---:|---:|---:|---:|
| 100 | `/api/dashboard` | 3,000 | 0 | 18.90 | 185.49 | 265.05 | 439.20 |
| 100 | `/api/transactions?limit=20` | 3,000 | 0 | 8.88 | 90.82 | 112.82 | 171.73 |

This remained an exploratory local smoke run. It does not establish capacity or an SLA.
