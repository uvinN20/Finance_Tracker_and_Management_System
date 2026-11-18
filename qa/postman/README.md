# Finora Postman API smoke tests

Import `Finora API Smoke Tests.postman_collection.json` into Postman (**Import → File**). The collection runs requests in order and uses the default local API URL `http://localhost:5000/api`.

## Before running

1. Start MongoDB and the Finora backend. The backend must be listening on port 5000.
2. In Postman Web, select **Desktop Agent** so the request can reach `localhost`. The Postman Desktop app can use the local API directly.
3. Open **Finora API Smoke Tests** and run the whole collection in the Collection Runner without changing the request order.

If **01 - Health check** does not return HTTP 200 with `{"status":"ok"}`, stop the run and fix the API connection first.

## What the collection checks

1. API health.
2. Registration of a disposable QA user and token capture.
3. Creation of a Savings account and retrieval of the default Cash account.
4. Creation and listing of an LKR 100 income transaction.
5. Transfer of LKR 30 from Cash to Savings.
6. Balance integrity: Cash = 70, Savings = 30, total = 100.

Each request contains Postman assertions. A passing Collection Runner result means all assertions passed for that run.

## Test data

Each run registers a new `finora-qa-<timestamp>@example.com` user and writes a QA account and transaction to the configured database. These records remain in MongoDB after the run. Use a development/test database only, and do not use a real user's credentials or a production database.
