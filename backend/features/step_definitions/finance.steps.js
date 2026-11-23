const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config();
const mongoose = require('mongoose');
const { Before, BeforeAll, After, AfterAll, Given, When, Then, setWorldConstructor } = require('@cucumber/cucumber');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');

const baseUrl = process.env.FINORA_API_URL || 'http://127.0.0.1:5000/api';

class FinoraWorld {
  constructor() {
    this.token = '';
    this.testEmail = '';
    this.cash = null;
    this.savings = null;
    this.transaction = null;
  }

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const response = await fetch(baseUrl + path, { ...options, headers });
    const body = await response.json();
    assert.equal(response.ok, true, (options.method || 'GET') + ' ' + path + ' returned ' + response.status + ': ' + (body.message || ''));
    return body;
  }
}

setWorldConstructor(FinoraWorld);

BeforeAll(async function () {
  await mongoose.connect(process.env.MONGO_URI);
});

Before(async function () {
  const unique = randomUUID();
  this.testEmail = 'cucumber-' + unique + '@example.test';
  const auth = await this.request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Cucumber QA',
      email: this.testEmail,
      password: 'Dummy-Cucumber-' + unique + '!',
      currency: 'LKR',
    }),
  });
  this.token = auth.token;
  const accounts = await this.request('/accounts');
  this.cash = accounts.accounts.find((account) => account.name === 'Cash');
  assert.ok(this.cash, 'Registration should create a Cash account');
});

After(async function () {
  if (!this.testEmail) return;
  const user = await User.findOne({ email: this.testEmail });
  if (!user) return;

  await Promise.all([
    Transaction.deleteMany({ userId: user._id }),
    Account.deleteMany({ userId: user._id }),
    Budget.deleteMany({ userId: user._id }),
    Goal.deleteMany({ userId: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });
});

AfterAll(async function () {
  await mongoose.disconnect();
});

Given('a new LKR user with a Cash account', function () {
  assert.equal(this.cash.balance, 0);
});

Given('a Savings account with LKR {int}', async function (balance) {
  this.savings = await this.request('/accounts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Savings', type: 'savings', balance }),
  });
});

When('the user records LKR {int} of Salary income', async function (amount) {
  this.transaction = await this.request('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      accountId: this.cash._id,
      type: 'income',
      amount,
      category: 'Salary',
      description: 'Cucumber salary',
    }),
  });
});

When('the user transfers LKR {int} from Cash to Savings', async function (amount) {
  await this.request('/accounts/transfer', {
    method: 'POST',
    body: JSON.stringify({
      fromAccountId: this.cash._id,
      toAccountId: this.savings._id,
      amount,
    }),
  });
});

Then('the transaction list contains the Salary income', async function () {
  const result = await this.request('/transactions?type=income&category=Salary');
  assert.ok(result.transactions.some((transaction) => transaction._id === this.transaction._id));
});

Then('the dashboard balance is LKR {int}', async function (expectedBalance) {
  const dashboard = await this.request('/dashboard');
  assert.equal(dashboard.balance, expectedBalance);
});

Then('Cash has LKR {int} and Savings has LKR {int}', async function (cashBalance, savingsBalance) {
  const accounts = await this.request('/accounts');
  const cash = accounts.accounts.find((account) => account._id === this.cash._id);
  const savings = accounts.accounts.find((account) => account._id === this.savings._id);
  assert.equal(cash.balance, cashBalance);
  assert.equal(savings.balance, savingsBalance);
  assert.equal(accounts.total, cashBalance + savingsBalance);
});

Then('the dashboard balance and income are both LKR {int}', async function (expectedAmount) {
  const dashboard = await this.request('/dashboard');
  assert.equal(dashboard.balance, expectedAmount);
  assert.equal(dashboard.monthlyIncome, expectedAmount);
});
