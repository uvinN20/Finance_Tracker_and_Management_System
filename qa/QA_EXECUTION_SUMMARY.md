# Finora QA Execution Summary

Execution date: 2026-11-23. This summary reports checks run locally and the completed remote GitHub Actions run. A SonarQube scan has not occurred.

## Verified results

| Check | Result |
|---|---|
| Jest unit + Express/Supertest integration | 149 tests passed across 10 suites |
| Controller coverage | 98.21% statements, 92.74% branches, 100% functions, 99.00% lines |
| Coverage regression gates | Passed: statements ≥90%, branches ≥85%, functions ≥95%, lines ≥95% |
| MongoDB-backed API integration | 3 tests passed: financial flow, two-user isolation, budgets/goals/dashboard/reports |
| Cucumber BDD | 2 scenarios and 14 steps passed; each scenario's generated records are removed |
| Postman smoke collection via Newman 6.2.1 | 8 requests and 17 assertions passed |
| Selenium Edge UI smoke | Registration, transaction entry/listing, and LKR 100 dashboard balance passed |
| Manual case execution copy | TC-AUTH-01 passed in the browser; the other 59 cases passed API-level checks and are labeled `Pass (API)` in the results copy |
| Frontend production build | Passed; page-based lazy loading reduced the main JS entry bundle from 672.10 kB to 237.43 kB (80.23 kB gzip) |
| npm dependency audit | Backend and frontend both report 0 vulnerabilities after compatible lockfile updates |
| Node performance smoke | 1, 10, 50, and 100 concurrent users; additionally 100 users × 30 requests per endpoint (6,000 samples); 0 errors |
| Apache JMeter load smoke | 1, 10, 50, and 100 users; 1,610 total samples, 0 errors; per-endpoint latency recorded in [`jmeter/README.md`](jmeter/README.md) |
| QA artifact validation | 39-file inventory check passed; workflow and JMeter XML parsed; 60 manual cases and 8 Postman requests counted |

Detailed measurements: [`performance/README.md`](performance/README.md) and [`jmeter/README.md`](jmeter/README.md).

## Defects fixed

- Transfer API now rejects string, non-finite, zero, and negative amounts before changing balances.
- Transaction creation/update now strictly validate numeric amounts, type, category, and date.
- Transaction update now checks ownership of its destination account before reversing the previous account effect.
- Postman collection scripts now use reusable declarations so all request scripts execute in Newman.

See [`defect-log.md`](defect-log.md) for reproduction and regression evidence.

## QA deliverables

- [`test-plan.md`](test-plan.md)
- [`check-deliverables.ps1`](check-deliverables.ps1) — repeatable QA artifact inventory check
- [`Finora-manual-results.csv`](Finora-manual-results.csv) — recorded results; 1 browser-executed case and 59 API-verified cases, clearly labeled by method
- [`manual-test-cases.csv`](manual-test-cases.csv) — original 60-case test design, kept unchanged
- [`requirements-traceability.md`](requirements-traceability.md)
- [`black-box-design.md`](black-box-design.md)
- [`white-box-analysis.md`](white-box-analysis.md)
- [`security-test-matrix.md`](security-test-matrix.md)
- [`jmeter/Finora API Load Test.jmx`](jmeter/Finora%20API%20Load%20Test.jmx)
- [`sonarqube.md`](sonarqube.md) and root `sonar-project.properties`
- [GitHub Actions workflow](../.github/workflows/qa-pipeline.yml)
- [Postman collection](postman/Finora%20API%20Smoke%20Tests.postman_collection.json)
- [Selenium smoke test](selenium/smoke-test.cjs)

## Remaining external verification

- GitHub Actions run [45153054231](https://github.com/uvinN20/Finance_Tracker_and_Management_System/actions/runs/45153054231) completed successfully on commit `7e64705`. Backend unit/API integration, MongoDB-backed integration, Cucumber, Postman, and frontend production build steps passed. The optional SonarQube Cloud step was skipped because the repository credentials/settings are not configured.
- SonarQube workflow configuration is ready, but no scan result is available until a Sonar project is configured and its secrets/variables are added to the repository.
- All four proposed JMeter user profiles ran as short local smoke tests; they are not a capacity benchmark, and production-like data/hardware plus a sustained load were not tested.
- The original 60-case design file remains unchanged. In the results copy, TC-AUTH-01 was executed in the browser; the remaining 59 are API-automated checks rather than hands-on manual UI tests.
- Transfer persistence uses sequential writes. Atomicity under concurrent transfers or mid-write database failure still requires a MongoDB replica-set test and a transaction-based implementation before production assurance.

The isolated `finora_qa_automation` database and QA server processes created for this run were removed/stopped after verification. The pre-existing MongoDB service was left running.
