# Finora Black-Box Test Design

The test cases use only observable inputs and responses; they do not depend on implementation details. The full manual case inventory is [`manual-test-cases.csv`](manual-test-cases.csv).

## Equivalence partitioning

| Input | Valid class | Invalid classes | Representative test cases |
|---|---|---|---|
| Password | Six or more characters | Fewer than six; missing | TC-AUTH-01, 02, 05, 06 |
| Transaction amount | Finite numeric value greater than zero | Zero, negative, string, non-finite, missing | TC-TXN-01–05 |
| Transaction type | `income` or `expense` | Any other value; missing | TC-TXN-01, 02, 06 |
| Transfer | Distinct owned accounts and amount within source balance | Missing IDs, same account, foreign account, invalid amount, insufficient funds | TC-ACCT-08–10 |
| Budget month | Integer 1 through 12 | 0, 13, fractional, non-numeric | TC-BUD-03 |
| Budget amount | Finite number at least zero | Negative, string, non-finite, missing | TC-BUD-04 |

## Boundary value analysis

### Budget state boundaries

For a LKR 1,000 budget, the intended status rules are OK below 80%, warning from 80% through 99%, and exceeded from 100% onward.

| Usage | Amount | Expected |
|---:|---:|---|
| 79% | LKR 790 | OK |
| 80% | LKR 800 | Warning |
| 81% | LKR 810 | Warning |
| 99% | LKR 990 | Warning |
| 100% | LKR 1,000 | Exceeded |
| 101% | LKR 1,010 | Exceeded |

The budget controller compares the unrounded usage ratio with the 80% and 100% thresholds and reports the display percentage to one decimal place. Automated boundary tests cover 79.5%, 80%, 99.5%, 100%, and 101%, including the early-warning and early-exceeded defect fixed during the final audit.

### Other numeric boundaries

| Field | Below boundary | Boundary | Above boundary |
|---|---|---|---|
| Password minimum | 5 characters: reject | 6: accept | 7: accept |
| Report month | 0: reject | 1 and 12: accept | 13: reject |
| Year range | 1999: reject | 2000 and 2100: accept | 2101: reject |
| Transfer amount | 0: reject | Positive finite value: accept when funded | More than available funds: reject |

## Decision table — money transfer

| Rule | Required input valid | Different accounts | Both accounts owned | Sufficient funds | Expected result |
|---|---|---|---|---|---|
| R1 | No | — | — | — | HTTP 400; no balance change |
| R2 | Yes | No | — | — | HTTP 400; no balance change |
| R3 | Yes | Yes | No | — | HTTP 404; no balance change |
| R4 | Yes | Yes | Yes | No | HTTP 400; no balance change |
| R5 | Yes | Yes | Yes | Yes | HTTP 200; transfer applied; combined balance unchanged |

Each rejection rule has a corresponding automated unit test. Successful transfer behavior is also covered by Cucumber and the Postman smoke collection.
