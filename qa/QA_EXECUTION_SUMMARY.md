# Finora QA Execution Summary

Initial QA execution: 2026-11-23. Latest CI/Sonar verification: commit 9befd0a on qa/initial-setup, GitHub Actions run [45240678768](https://github.com/uvinN20/Finance_Tracker_and_Management_System/actions/runs/45240678768).

## Verified results

| Check | Result |
|---|---|
| Jest unit + Express/Supertest integration | 149 tests passed across 10 suites |
| Controller coverage | 98.21% statements, 92.74% branches, 100% functions, 99.00% lines |
| Coverage regression gates | Passed: statements ≥90%, branches ≥85%, functions ≥95%, lines ≥95% |
| MongoDB-backed API integration | 3 tests passed: financial flow, two-user isolation, budgets/goals/dashboard/reports |
| Cucumber BDD | 2 scenarios and 14 steps passed; generated scenario records are removed |
| Postman smoke collection via Newman 6.2.1 | 8 requests and 17 assertions passed |
| Selenium Edge UI smoke | Registration, transaction entry/listing, and LKR 100 dashboard balance passed |
| Manual case results | 60 cases are recorded as Pass in the results copy. Evidence references are mixed: TC-AUTH-01 has browser registration evidence; most other rows cite API or automated checks. This is not evidence that all 60 cases were exercised through the browser UI. |
| Frontend production build | Passed; page-based lazy loading reduced the main JS entry bundle from 672.10 kB to 237.43 kB (80.23 kB gzip) |
| npm dependency audit | Backend and frontend both report 0 vulnerabilities after compatible lockfile updates |
| Node performance smoke | 1, 10, 50, and 100 concurrent users; additionally 100 users × 30 requests per endpoint (6,000 samples); 0 errors |
| Apache JMeter load smoke | 1, 10, 50, and 100 users; 1,610 total samples, 0 errors; per-endpoint latency recorded in [jmeter/README.md](jmeter/README.md) |
| QA artifact validation | 39-file inventory check passed; workflow and JMeter XML parsed; 60 manual cases and 8 Postman requests counted |
| SonarQube Cloud | Latest scan completed successfully. Quality Gate passed: new-code coverage 93.6% (threshold 80%); 0 bugs, 0 vulnerabilities, 0 code smells. |

Detailed measurements: [performance/README.md](performance/README.md) and [jmeter/README.md](jmeter/README.md).

## Defects fixed

- Transfer API rejects string, non-finite, zero, and negative amounts before changing balances.
- Transaction creation/update strictly validate numeric amounts, type, category, and date.
- Transaction update checks ownership of its destination account before reversing the previous account effect.
- Registration validates email/password inputs and returns client errors for invalid values.
- Postman collection scripts use reusable declarations so all request scripts execute in Newman.
- Sonar findings in application and QA workflow code were addressed.

See [defect-log.md](defect-log.md) for reproduction and regression evidence.

## QA deliverables

- [test-plan.md](test-plan.md)
- [check-deliverables.ps1](check-deliverables.ps1) — repeatable QA artifact inventory check
- [Finora-manual-results.csv](Finora-manual-results.csv) — recorded outcomes and evidence references; browser, API, and automated checks should be interpreted according to each row's evidence
- [manual-test-cases.csv](manual-test-cases.csv) — original 60-case test design
- [requirements-traceability.md](requirements-traceability.md)
- [black-box-design.md](black-box-design.md)
- [white-box-analysis.md](white-box-analysis.md)
- [security-test-matrix.md](security-test-matrix.md)
- [jmeter/Finora API Load Test.jmx](jmeter/Finora%20API%20Load%20Test.jmx)
- [sonarqube.md](sonarqube.md) and root sonar-project.properties
- [GitHub Actions workflow](../.github/workflows/qa-pipeline.yml)
- [Postman collection](postman/Finora%20API%20Smoke%20Tests.postman_collection.json)
- [Selenium smoke test](selenium/smoke-test.cjs)

## Remaining limitations

- JMeter profiles were short local smoke runs, not a capacity benchmark. Production-like hardware/data and sustained load have not been measured.
- Transfer persistence uses sequential writes. Atomicity during concurrent transfers or database failure still needs replica-set testing and a transaction-based implementation before production assurance.
- The QA results matrix records 60 Pass outcomes, but its evidence is not 60 browser UI executions. The method and source listed per case determine what was actually verified.
- The SonarQube result is for the qa/initial-setup branch and scanned new-code scope; it does not establish production capacity or replace manual UI evidence.

The isolated finora_qa_automation database and QA server processes created for execution were removed/stopped after verification. The pre-existing MongoDB service was left running.
