# Finora QA Defect Log

| ID | Severity | Defect | Reproduction | Resolution | Regression evidence | Status |
|---|---|---|---|---|---|---|
| FIN-QA-001 | High | Transfer accepted string amounts such as `"10"`; JavaScript addition could concatenate the destination balance instead of adding a number. | Submit transfer body with a valid account pair and `amount: "10"`. The original controller accepted the input. | Require a finite JavaScript number greater than zero before querying accounts or changing balances. | `accountController.test.js` rejects string amounts; successful-transfer test verifies total balance is unchanged. | Fixed and passing |
| FIN-QA-002 | Critical | Transaction update did not validate the new account's ownership; a transaction could be reassigned to another user's account ID. | Submit PUT for an owned transaction with another user's account ID. The original controller proceeded to reverse the old balance and apply the new effect by ID. | Validate transaction fields and verify the target account is owned by the authenticated user before reversing any balance. | `transactionLifecycleController.test.js` verifies foreign target returns 404 before balance lookup/change. | Fixed and passing |
| FIN-QA-003 | Medium | Transaction create/update accepted weakly typed financial/date/category inputs and could surface database validation as server errors or mutate balances before rejecting an update. | Try string/non-finite amounts, blank categories, unsupported update types, and invalid dates. | Add strict amount/type/category/date validation; run update validation before balance adjustment. | `transactionController.test.js` and `transactionLifecycleController.test.js`. | Fixed and passing |

## Notes

FIN-QA-001 was reproduced as a failing unit test before the fix. FIN-QA-002 and FIN-QA-003 were confirmed through source inspection and regression tests designed to fail against the original controller flow; the local database-backed hostile-user integration scenario remains unexecuted. No external GitHub issue was opened as part of this local QA work.
