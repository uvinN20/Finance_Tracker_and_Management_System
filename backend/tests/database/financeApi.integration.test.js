const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');

const databaseUri = process.env.MONGO_URI;
const testEmails = [];

function testEmail() {
  const email = `finora-db-qa-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  testEmails.push(email);
  return email;
}

async function registerUser(email = testEmail()) {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Finora Database QA',
    email,
    password: 'FinoraQA!123',
    currency: 'LKR',
  });
  expect(response.status).toBe(201);
  return { token: response.body.token, user: response.body.user };
}

function authenticated(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Finora API with MongoDB', () => {
  beforeAll(async () => {
    if (!databaseUri) throw new Error('MONGO_URI must point to a disposable QA database');
    const databaseName = new URL(databaseUri).pathname.replace(/^\//, '');
    if (!/(qa|test|ci)/i.test(databaseName)) {
      throw new Error(`Refusing to run destructive integration cleanup against database "${databaseName}"`);
    }
    await mongoose.connect(databaseUri);
  }, 30000);

  afterAll(async () => {
    for (const email of testEmails) {
      const user = await User.findOne({ email }).select('_id');
      if (!user) continue;
      await Promise.all([
        Transaction.deleteMany({ userId: user._id }),
        Account.deleteMany({ userId: user._id }),
        Budget.deleteMany({ userId: user._id }),
        Goal.deleteMany({ userId: user._id }),
      ]);
      await User.deleteOne({ _id: user._id });
    }
    await mongoose.disconnect();
  }, 30000);

  test('registers, records income, transfers funds, and keeps dashboard wealth correct', async () => {
    const { token } = await registerUser();
    const auth = authenticated(token);

    const accountResponse = await request(app).get('/api/accounts').set(auth).expect(200);
    const cash = accountResponse.body.accounts.find((account) => account.name === 'Cash');
    expect(cash).toBeDefined();
    expect(cash.balance).toBe(0);

    const savingsResponse = await request(app)
      .post('/api/accounts')
      .set(auth)
      .send({ name: 'QA Savings', type: 'savings', balance: 0 })
      .expect(201);

    await request(app)
      .post('/api/transactions')
      .set(auth)
      .send({ accountId: cash._id, type: 'income', amount: 100, category: 'Salary', description: 'API integration income' })
      .expect(201);

    await request(app)
      .post('/api/transactions')
      .set(auth)
      .send({ accountId: cash._id, type: 'income', amount: '10', category: 'Salary' })
      .expect(400);

    const transferResponse = await request(app)
      .post('/api/accounts/transfer')
      .set(auth)
      .send({ fromAccountId: cash._id, toAccountId: savingsResponse.body._id, amount: 30 })
      .expect(200);
    expect(transferResponse.body.fromAccount.balance).toBe(70);
    expect(transferResponse.body.toAccount.balance).toBe(30);

    const accounts = await request(app).get('/api/accounts').set(auth).expect(200);
    expect(accounts.body.total).toBe(100);

    const dashboard = await request(app).get('/api/dashboard').set(auth).expect(200);
    expect(dashboard.body.balance).toBe(100);
    expect(dashboard.body.monthlyIncome).toBe(100);
    expect(dashboard.body.monthlyExpense).toBe(0);
  });

  test('does not let one authenticated user access another user\'s account or transaction', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    const userAAccounts = await request(app).get('/api/accounts').set(authenticated(userA.token)).expect(200);
    const userBAccounts = await request(app).get('/api/accounts').set(authenticated(userB.token)).expect(200);
    const userAAccountId = userAAccounts.body.accounts[0]._id;
    const userBAccountId = userBAccounts.body.accounts[0]._id;

    await request(app)
      .post('/api/transactions')
      .set(authenticated(userA.token))
      .send({ accountId: userBAccountId, type: 'income', amount: 50, category: 'Salary' })
      .expect(404);

    await request(app)
      .post('/api/accounts/transfer')
      .set(authenticated(userA.token))
      .send({ fromAccountId: userAAccountId, toAccountId: userBAccountId, amount: 1 })
      .expect(404);

    const transaction = await request(app)
      .post('/api/transactions')
      .set(authenticated(userA.token))
      .send({ accountId: userAAccountId, type: 'income', amount: 50, category: 'Salary' })
      .expect(201);

    await request(app)
      .put(`/api/transactions/${transaction.body._id}`)
      .set(authenticated(userA.token))
      .send({ accountId: userBAccountId })
      .expect(404);

    await request(app)
      .get(`/api/transactions/${transaction.body._id}`)
      .set(authenticated(userB.token))
      .expect(404);
    await request(app)
      .put(`/api/transactions/${transaction.body._id}`)
      .set(authenticated(userB.token))
      .send({ amount: 75 })
      .expect(404);
    await request(app)
      .delete(`/api/transactions/${transaction.body._id}`)
      .set(authenticated(userB.token))
      .expect(404);

    const unchangedAccountsA = await request(app).get('/api/accounts').set(authenticated(userA.token)).expect(200);
    const unchangedAccountsB = await request(app).get('/api/accounts').set(authenticated(userB.token)).expect(200);
    expect(unchangedAccountsA.body.total).toBe(50);
    expect(unchangedAccountsB.body.total).toBe(0);
  });

  test('serves consistent budget, savings-goal, dashboard, and report data', async () => {
    const { token } = await registerUser();
    const auth = authenticated(token);
    const accounts = await request(app).get('/api/accounts').set(auth).expect(200);
    const cash = accounts.body.accounts[0];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await request(app)
      .post('/api/transactions')
      .set(auth)
      .send({ accountId: cash._id, type: 'income', amount: 1000, category: 'Salary' })
      .expect(201);
    await request(app)
      .post('/api/transactions')
      .set(auth)
      .send({ accountId: cash._id, type: 'expense', amount: 800, category: 'Food' })
      .expect(201);

    await request(app)
      .post('/api/budgets')
      .set(auth)
      .send({ category: 'Food', amount: 1000, month, year })
      .expect(201);
    const budgets = await request(app).get(`/api/budgets?month=${month}&year=${year}`).set(auth).expect(200);
    expect(budgets.body.budgets).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'Food', amount: 1000, spent: 800, percentageUsed: 80, status: 'warning' }),
    ]));

    const goal = await request(app)
      .post('/api/goals')
      .set(auth)
      .send({ name: 'QA goal', targetAmount: 1000 })
      .expect(201);
    const contribution = await request(app)
      .post(`/api/goals/${goal.body._id}/contribute`)
      .set(auth)
      .send({ amount: 250 })
      .expect(200);
    expect(contribution.body.progress).toBe(25);

    const dashboard = await request(app).get(`/api/dashboard?month=${month}&year=${year}`).set(auth).expect(200);
    expect(dashboard.body.balance).toBe(200);
    expect(dashboard.body.monthlyIncome).toBe(1000);
    expect(dashboard.body.monthlyExpense).toBe(800);
    expect(dashboard.body.totalBudgetSpent).toBe(800);
    expect(dashboard.body.goalProgress[0].progress).toBe(25);

    const monthly = await request(app).get(`/api/reports/monthly?month=${month}&year=${year}`).set(auth).expect(200);
    expect(monthly.body.totalIncome).toBe(1000);
    expect(monthly.body.totalExpense).toBe(800);
    expect(monthly.body.totalSavings).toBe(200);

    const yearly = await request(app).get(`/api/reports/yearly?year=${year}`).set(auth).expect(200);
    expect(yearly.body.months).toHaveLength(12);
    expect(yearly.body.months[month - 1]).toEqual({ month, income: 1000, expense: 800 });

    const category = await request(app).get('/api/reports/category?category=Food').set(auth).expect(200);
    expect(category.body).toMatchObject({ category: 'Food', total: 800, count: 1 });
  });
});
