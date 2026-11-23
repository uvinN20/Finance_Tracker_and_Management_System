const { randomBytes, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const path = require('node:path');

const baseUrl = (process.env.FINORA_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const concurrency = Math.max(1, Number.parseInt(process.env.LOAD_CONCURRENCY || '10', 10));
const requestsPerEndpoint = Math.max(1, Number.parseInt(process.env.LOAD_REQUESTS_PER_ENDPOINT || '5', 10));
const email = 'finora-load-qa-' + randomUUID() + '@example.test';

async function send(pathname, token, expectedStatus = 200) {
  const start = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  await response.arrayBuffer();
  const elapsedMs = performance.now() - start;
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} returned HTTP ${response.status}; expected ${expectedStatus}`);
  }
  return elapsedMs;
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    requests: samples.length,
    errors: 0,
    averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2)),
    p95Ms: Number(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

async function cleanup() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required so the disposable load-test user can be removed');
  const databaseName = new URL(uri).pathname.replace(/^\//, '');
  if (!/(qa|test|ci)/i.test(databaseName)) {
    throw new Error(`Refusing cleanup against non-QA database "${databaseName}"`);
  }

  const backend = path.resolve(__dirname, '../../backend');
  const mongoose = require(path.join(backend, 'node_modules/mongoose'));
  const User = require(path.join(backend, 'models/User'));
  const Account = require(path.join(backend, 'models/Account'));
  const Transaction = require(path.join(backend, 'models/Transaction'));
  const Budget = require(path.join(backend, 'models/Budget'));
  const Goal = require(path.join(backend, 'models/Goal'));

  await mongoose.connect(uri);
  const user = await User.findOne({ email }).select('_id');
  if (user) {
    await Promise.all([
      Transaction.deleteMany({ userId: user._id }),
      Account.deleteMany({ userId: user._id }),
      Budget.deleteMany({ userId: user._id }),
      Goal.deleteMany({ userId: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
  }
  await mongoose.disconnect();
}

(async () => {
  let failure;
  try {
    const loadPassword = randomBytes(24).toString('base64url');
    const registration = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Finora Load QA', email, password: loadPassword, currency: 'LKR' }),
    });
    const auth = await registration.json();
    if (registration.status !== 201 || !auth.token) throw new Error(`QA registration failed with HTTP ${registration.status}`);

    const endpoints = ['/dashboard', '/transactions?limit=20'];
    const results = {};
    for (const endpoint of endpoints) {
      const baselineMs = await send(endpoint, auth.token);
      const batches = await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const samples = [];
          for (let i = 0; i < requestsPerEndpoint; i += 1) samples.push(await send(endpoint, auth.token));
          return samples;
        })
      );
      results[endpoint] = { baselineMs: Number(baselineMs.toFixed(2)), ...summarize(batches.flat()) };
    }

    console.log(JSON.stringify({
      result: 'PASS',
      profile: { concurrency, requestsPerEndpoint },
      endpoints: results,
      note: 'Local exploratory smoke only; use JMeter and a controlled environment for formal performance results.',
    }, null, 2));
  } catch (error) {
    failure = error;
    console.error(error.stack || error);
  } finally {
    try {
      await cleanup();
      console.log('Cleaned up the unique load-test user and related records.');
    } catch (error) {
      console.error(`QA data cleanup failed: ${error.message}`);
      failure = failure || error;
    }
  }
  if (failure) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
