# Finora Security Test Matrix

Run these checks only against a disposable local or CI environment.

| ID | Security check | Expected result | Current evidence | Status |
|---|---|---|---|---|
| SEC-01 | Call a protected route without Authorization | HTTP 401; no protected data | Supertest `app.integration.test.js` | Pass |
| SEC-02 | Call a protected route with malformed/invalid JWT | HTTP 401 | Supertest and `authMiddleware.test.js` | Pass |
| SEC-03 | Call a protected route with expired JWT | HTTP 401 | `authMiddleware.test.js` | Pass |
| SEC-04 | Use a valid JWT for a deleted user | HTTP 401 | `authMiddleware.test.js` | Pass |
| SEC-05 | Create a transaction against another user's account | HTTP 404; no balance change | Transaction controller tests and ownership query | Pass in automated controller test |
| SEC-06 | Update a transaction to another user's account | HTTP 404 before balance reversal | Regression test in `transactionLifecycleController.test.js` | Pass in automated controller test |
| SEC-07 | Read/update/delete another user's transaction | No foreign record returned or mutated | User-scoped query assertions in unit tests | Pass in automated controller test |
| SEC-08 | Update/delete another user's account, budget, or goal | HTTP 404; foreign record unchanged | Unit tests assert user-scoped queries | Pass in automated controller test |
| SEC-09 | Transfer to another user's account | HTTP 404; both balances unchanged | `accountController.test.js` | Pass in automated controller test |
| SEC-10 | Send string, zero, negative, NaN, or infinite financial amounts | HTTP 400; no financial mutation | Account/transaction validation tests | Pass in automated controller test |

## Security limitations

- These are automated regression checks and source-level ownership checks, not a third-party penetration test.
- A live MongoDB-backed two-user integration test covers foreign-account transaction creation, transfers to another user's account, transaction reassignment, and foreign transaction read/update/delete. This is representative regression coverage, not a third-party penetration test or exhaustive attack assessment of every endpoint.
- Transfer writes are sequential. Multi-document atomicity and concurrent requests require a MongoDB replica-set test environment and dedicated race tests before production assurance.
- Do not use production credentials, production tokens, or production data in these checks.
