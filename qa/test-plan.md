# Finora QA Test Plan

## Purpose

Verify the core behavior and quality risks of Finora, a React/Vite finance tracker with a Node.js/Express API and MongoDB persistence. The plan covers authentication, financial data integrity, account transfers, budgeting, savings goals, dashboard calculations, reports, API security, browser flows, and performance preparation.

## Scope

In scope: authentication and profile APIs; transactions and balance updates; accounts and transfers; budgets; savings goals; dashboard and reports; API authorization and user scoping; representative UI flows; backend unit/API integration tests; Cucumber BDD scenarios; Postman smoke collection; frontend production build.

Out of scope for this local QA pass: production deployment, penetration testing against a public system, multi-currency conversion, accessibility certification, and a measured high-concurrency benchmark. Load-test assets are provided, but a JMeter run requires JMeter and a dedicated test environment.

## Test objectives

- Confirm financial totals and account balances remain consistent through transaction create, update, delete, and transfer flows.
- Reject malformed or unauthorized requests with appropriate 4xx responses.
- Prevent one user from reading or changing another user's records.
- Verify monthly/yearly aggregates and boundary rules, especially budget thresholds.
- Keep automated regression results reproducible and visible in CI.
- Record known limitations and distinguish executed tests from planned manual cases.

## Test levels and tools

| Level / technique | Tool or artifact | Coverage |
|---|---|---|
| Unit and white-box | Jest | Controllers, validation, balance rules, calculations, error paths |
| API integration | Supertest | Express routing, health, authentication rejection, 404 handling |
| BDD | Cucumber.js | Transaction visibility and account-transfer scenarios |
| API smoke | Postman collection / Newman in CI | Health, registration, accounts, transaction, transfer, balance integrity |
| UI smoke | Selenium WebDriver with Edge | Register, record income, list transaction, dashboard balance |
| Build / CI | GitHub Actions, Vite | Controller coverage gates, BDD, Postman, production frontend build |
| Performance preparation | Apache JMeter plan | Authenticated dashboard and transaction-list load profile |

## Environment and test data

- Backend: Node.js 22+, Express API on port 5000.
- Frontend: Vite on port 5173.
- Database: MongoDB; use a disposable local or CI database only.
- Automated QA identities use `@example.test` or `@example.com` addresses and should not be real user accounts.
- Cucumber cleanup removes only the users created by its own scenarios and their related finance records.
- Postman and Selenium smoke runs create disposable test records; do not point them at production data.

## Entry criteria

- Dependencies install from lockfiles.
- MongoDB is available for BDD and Postman tests.
- Backend health endpoint returns HTTP 200 before API-level suites start.
- A disposable database and dummy test credentials are configured.

## Exit criteria

- Jest unit and Supertest integration suites pass.
- Controller coverage remains above configured thresholds: 90% statements, 85% branches, 95% functions, and 95% lines.
- Cucumber BDD and Postman smoke collection pass in CI.
- Frontend production build succeeds.
- Confirmed defects are fixed or explicitly recorded as open risks.
- Manual cases remain labeled `Not Run` until a human executes and records actual results.

## Risks and constraints

- The local database and services may be unavailable in restricted sessions; CI uses a temporary MongoDB service for BDD.
- Selenium requires a browser/driver and a running backend/frontend.
- The latest frontend production build passed after route-level lazy loading; the main JavaScript entry is 237.43 kB (80.23 kB gzip).
- MongoDB standalone deployments do not provide multi-document transactions by default. Concurrent transfers and partial failures need a replica-set test environment before claiming atomic financial operations.
- Short JMeter CLI smoke profiles at 1, 10, 50, and 100 users completed against a local isolated database. They do not establish production capacity or an SLA; see [`jmeter/README.md`](jmeter/README.md).

## Current execution snapshot

See [`QA_EXECUTION_SUMMARY.md`](QA_EXECUTION_SUMMARY.md) for the latest verified test counts, coverage, build status, and known limitations. See [`manual-test-cases.csv`](manual-test-cases.csv) and [`requirements-traceability.md`](requirements-traceability.md) for manual test design and traceability.
