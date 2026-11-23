jest.mock('../../models/Transaction');
jest.mock('../../models/Account');
jest.mock('../../models/Goal');
jest.mock('../../models/Budget');

const Transaction = require('../../models/Transaction');
const Account = require('../../models/Account');
const Goal = require('../../models/Goal');
const Budget = require('../../models/Budget');
const { getDashboard } = require('../../controllers/dashboardController');

const userId = 'user-1';
const now = new Date('2026-11-23T12:00:00.000Z');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function setupRecentTransactions(transactions = []) {
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(transactions),
  };
  Transaction.find.mockReturnValue(query);
  return query;
}

describe('getDashboard', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    req = { user: { _id: userId }, query: {} };
    res = response();
    next = jest.fn();
    Account.find.mockResolvedValue([{ name: 'Cash', balance: 700 }, { name: 'Savings', balance: 300 }]);
    Budget.find.mockResolvedValue([{ category: 'Food', amount: 200 }, { category: 'Travel', amount: 100 }]);
    Goal.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([
      { name: 'Trip', targetAmount: 1000, currentAmount: 250 },
      { name: 'Emergency fund', targetAmount: 2000, currentAmount: 2500 },
    ]) }) });
    setupRecentTransactions([{ _id: 'transaction-1' }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('summarizes a past month, including balance, categories, budgets and goals', async () => {
    req.query = { month: '10', year: '2026' };
    Transaction.aggregate
      .mockResolvedValueOnce([{ _id: 'income', total: 500 }])
      .mockResolvedValueOnce([{ _id: 'income', total: 100 }, { _id: 'expense', total: 20 }])
      .mockResolvedValueOnce([{ _id: 'income', total: 5000 }, { _id: 'expense', total: 1500 }])
      .mockResolvedValueOnce([
        { _id: 'Food', total: 80 },
        { _id: 'Travel', total: 50 },
        { _id: 'Unbudgeted', total: 25 },
      ]);
    const recentQuery = setupRecentTransactions([{ _id: 'transaction-1' }]);

    await getDashboard(req, res, next);

    expect(Account.find).toHaveBeenCalledWith({ userId });
    expect(Budget.find).toHaveBeenCalledWith({ userId, month: 10, year: 2026 });
    expect(Goal.find).toHaveBeenCalledWith({ userId });
    expect(Goal.find.mock.results[0].value.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(Goal.find.mock.results[0].value.sort.mock.results[0].value.limit).toHaveBeenCalledWith(3);
    expect(Transaction.find).toHaveBeenCalledWith({
      userId,
      date: { $gte: new Date(2026, 9, 1), $lt: new Date(2026, 10, 1) },
    });
    expect(recentQuery.sort).toHaveBeenCalledWith({ date: -1, createdAt: -1 });
    expect(recentQuery.limit).toHaveBeenCalledWith(8);
    expect(recentQuery.populate).toHaveBeenCalledWith('accountId', 'name');
    expect(res.body).toEqual({
      month: 10,
      year: 2026,
      isCurrentMonth: false,
      balance: 920,
      totalIncome: 5000,
      totalExpense: 1500,
      monthlyIncome: 500,
      monthlyExpense: 0,
      monthlySavings: 500,
      savingsRate: 100,
      expensesByCategory: { Food: 80, Travel: 50, Unbudgeted: 25 },
      totalBudget: 300,
      totalBudgetSpent: 130,
      goalProgress: [
        { name: 'Trip', progress: 25, currentAmount: 250, targetAmount: 1000 },
        { name: 'Emergency fund', progress: 100, currentAmount: 2500, targetAmount: 2000 },
      ],
      recentTransactions: [{ _id: 'transaction-1' }],
      accounts: [{ name: 'Cash', balance: 700 }, { name: 'Savings', balance: 300 }],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('defaults to current month and year, and skips the future-activity query', async () => {
    Transaction.aggregate
      .mockResolvedValueOnce([{ _id: 'income', total: 1200 }, { _id: 'expense', total: 300 }])
      .mockResolvedValueOnce([{ _id: 'income', total: 3000 }, { _id: 'expense', total: 1000 }])
      .mockResolvedValueOnce([]);
    Budget.find.mockResolvedValue([]);
    Goal.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) });
    setupRecentTransactions([]);

    await getDashboard(req, res, next);

    expect(res.body.month).toBe(11);
    expect(res.body.year).toBe(2026);
    expect(res.body.isCurrentMonth).toBe(true);
    expect(res.body.balance).toBe(1000);
    expect(res.body.monthlyIncome).toBe(1200);
    expect(res.body.monthlyExpense).toBe(300);
    expect(res.body.monthlySavings).toBe(900);
    expect(res.body.savingsRate).toBe(75);
    expect(Transaction.aggregate).toHaveBeenCalledTimes(3);
  });

  test('uses zero for missing totals and returns zero savings rate with no income', async () => {
    req.query = { month: '11', year: '2026' };
    Transaction.aggregate.mockResolvedValue([]);
    Budget.find.mockResolvedValue([]);
    Goal.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) });

    await getDashboard(req, res, next);

    expect(res.body.totalIncome).toBe(0);
    expect(res.body.totalExpense).toBe(0);
    expect(res.body.monthlySavings).toBe(0);
    expect(res.body.savingsRate).toBe(0);
    expect(res.body.expensesByCategory).toEqual({});
    expect(res.body.totalBudget).toBe(0);
    expect(res.body.totalBudgetSpent).toBe(0);
    expect(res.body.goalProgress).toEqual([]);
  });

  test.each([
    [{ month: '0', year: '2026' }],
    [{ month: '13', year: '2026' }],
    [{ month: 'abc', year: '2026' }],
    [{ month: '11', year: '1999' }],
    [{ month: '11', year: '2101' }],
    [{ month: '11', year: 'nope' }],
  ])('rejects invalid month or year before querying data', async (query) => {
    req.query = query;

    await getDashboard(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'month must be 1-12 and year must be between 2000 and 2100' });
    expect(Account.find).not.toHaveBeenCalled();
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  test('forwards query errors to middleware', async () => {
    const error = new Error('database unavailable');
    Account.find.mockRejectedValue(error);

    await getDashboard(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
