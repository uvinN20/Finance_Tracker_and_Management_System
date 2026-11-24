# Finora QA Execution Summary

Initial QA execution: 2026-11-23. Latest full regression and SonarQube PR verification: head commit `17e4190` on PR #6; GitHub Actions run [45369455704](https://github.com/uvinN20/Finance_Tracker_and_Management_System/actions/runs/45369455704) succeeded, including the artifact check, tests, frontend build, and SonarCloud Quality Gate. PR #6 was merged as `e7a2b4d`.

## Verified results

| Check | Result |
|---|---|
| Jest unit + Express/Supertest integration | 171 tests passed across 12 suites on the audited branch |
| Controller coverage | 98.01% statements, 93.96% branches, 100% functions, 98.68% lines |
| Coverage regression gates | Passed: statements ≥90%, branches ≥85%, functions ≥95%, lines ≥95% |
| MongoDB-backed API integration | 3 tests passed: financial flow, two-user isolation, budgets/goals/dashboard/reports |
| Cucumber BDD | 2 scenarios and 14 steps passed; generated scenario records are removed |
| Postman smoke collection via Newman 6.2.1 | 8 requests and 17 assertions passed |
| Selenium Edge UI smoke | Registration, transaction entry/listing, and LKR 100 dashboard balance passed |
| Manual case results | 60 cases are recorded as Pass in the results copy. Evidence references are mixed: TC-AUTH-01 has browser registration evidence; most other rows cite API or automated checks. This is not evidence that all 60 cases were exercised through the browser UI. |
| Frontend production build | Passed; page-based lazy loading reduced the main JS entry bundle from 672.10 kB to 237.43 kB (80.23 kB gzip) |
| npm dependency audit | Backend and frontend both report 0 vulnerabilities after compatible lockfile updates |
| Node performance smoke | 1, 10, 50, and 100 concurrent users; additionally 100 users × 30 requests per endpoint (6,000 samples); 0 errors |
| Apache JMeter | Earlier short profiles used 1, 10, 50, and 100 users. The 2026-11-24 sustained benchmark passed its 500 ms p95 / zero-error criteria at 15 users; 20, 25, and 50-user results are documented in [jmeter/README.md](jmeter/README.md) and [the results CSV](jmeter/results/sustained-benchmark-2026-11-24.csv). |
| QA artifact validation | 41 required files present; 60 design/result rows match by test ID and scenario; Postman collection and both JMeter plans parse successfully |
| SonarQube Cloud | PR #6 analysis passed its Quality Gate with 83.3% new-code coverage, 0 new issues, 0 accepted issues, 0 security hotspots, and 0.0% duplication. The earlier source-code analysis on `qa/initial-setup` recorded 93.6% new-code coverage, 0 bugs, 0 vulnerabilities, and 0 code smells; see [SonarQube details](sonarqube.md). |

Detailed measurements: [performance/README.md](performance/README.md) and [jmeter/README.md](jmeter/README.md).

## Defects fixed

- Transfer API rejects string, non-finite, zero, and negative amounts before changing balances.
- Transaction creation/update strictly validate numeric amounts, type, category, and date.
- Transaction update checks ownership of its destination account before reversing the previous account effect.
- Registration validates email/password inputs and returns client errors for invalid values.
- Budget warning/exceeded states now use the unrounded ratio; the 79.5%, 80%, 99.5%, and 100% boundary regression tests passed after reproducing early alerts.
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

- JMeter includes a sustained local synthetic-data run, but it is not a production capacity benchmark or SLA. Representative hardware, production-sized data, and realistic user pacing have not been measured.
- Transfer persistence uses sequential writes. Atomicity during concurrent transfers or database failure still needs replica-set testing and a transaction-based implementation before production assurance.
- The QA results matrix records 60 Pass outcomes, but its evidence is not 60 browser UI executions. The method and source listed per case determine what was actually verified.
- The earlier full source-code SonarQube result is for `qa/initial-setup` and scanned new-code scope; the latest PR analysis was documentation/test-data only. Neither establishes production capacity or replaces traceable manual UI evidence.

The isolated finora_qa_automation database and QA server processes created for execution were removed/stopped after verification. The pre-existing MongoDB service was left running.
