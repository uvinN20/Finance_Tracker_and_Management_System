# Finora Requirements Traceability Matrix

The IDs below map user-visible requirements to designed manual cases and automated coverage. `Not Run` means no manual execution result is claimed. Automated checks are listed separately so that unit-test success is not mistaken for a manual pass.

| Requirement ID | Requirement / behavior | Manual cases | Automated evidence |
|---|---|---|---|
| AUTH-01 | Register, reject duplicate/malformed input, and authenticate users | TC-AUTH-01–10 | `authController.test.js`, `authMiddleware.test.js`, `app.integration.test.js` |
| TXN-01 | Record income/expense and update account balance | TC-TXN-01–08 | `transactionController.test.js`; `financeApi.integration.test.js`; Postman smoke; BDD transaction scenario |
| TXN-02 | List, search, filter, paginate, read, update, and delete transactions | TC-TXN-09–15 | `transactionController.test.js`, `transactionLifecycleController.test.js` |
| ACCT-01 | Create, list, update, and safely delete owned accounts | TC-ACCT-01–06 | `accountController.test.js` |
| XFER-01 | Transfer only positive finite amounts between distinct owned accounts, preserving total wealth | TC-ACCT-07–10 | `accountController.test.js`; `financeApi.integration.test.js`; Cucumber transfer scenarios; Postman smoke |
| BUD-01 | Create/update monthly budgets and enforce month/year input boundaries | TC-BUD-01–04 | `budgetController.test.js`; `financeApi.integration.test.js`; Postman/manual API checks |
| BUD-02 | Calculate spending and apply 80% warning / 100% exceeded thresholds | TC-BUD-05–08 | `budgetController.test.js`, `dashboardController.test.js` |
| GOAL-01 | Create, update, contribute to, and delete savings goals with safe ownership | TC-GOAL-01–07 | `goalController.test.js`; `financeApi.integration.test.js` |
| DASH-01 | Show current and historical balances, period totals, budgets, goals, and recent activity | TC-DASH-01–05 | `dashboardController.test.js`; `financeApi.integration.test.js`; Selenium balance smoke |
| REP-01 | Generate monthly, yearly, and category reports with valid date ranges | TC-REP-01–05 | `reportController.test.js`; `financeApi.integration.test.js` |
| SEC-01 | Reject missing, invalid, and expired bearer tokens | Cross-cutting: TC-AUTH-09–10, TC-TXN-08, TC-ACCT-05 | `authMiddleware.test.js`, `app.integration.test.js` |
| SEC-02 | Restrict data access and mutation to the authenticated user | Cross-cutting: TC-TXN-08, TC-ACCT-05, TC-ACCT-10, TC-GOAL-07 | Controller tests assert user-scoped queries; `financeApi.integration.test.js` exercises two real QA users |
| PERF-01 | Measure response time for dashboard and transaction-list endpoints | Performance profiles in `jmeter/README.md` | Sustained local profiles at 15, 20, 25, and 50 users. 15 users met the selected p95 ≤ 500 ms and zero-error criteria; higher-profile results include timeouts/latency failures. Local stress-style evidence only, not an SLA. |
| UI-01 | Complete registration, transaction entry, and balance verification through the browser | UI-SMOKE-01 | `qa/selenium/smoke-test.cjs` (executed successfully locally) |
| BUILD-01 | Build frontend and run regression checks on pushes/pull requests | CI checks | `.github/workflows/qa-pipeline.yml`; GitHub Actions run [45369455704](https://github.com/uvinN20/Finance_Tracker_and_Management_System/actions/runs/45369455704) completed successfully on PR #6, including artifact validation, tests, frontend build, and SonarQube analysis. |
