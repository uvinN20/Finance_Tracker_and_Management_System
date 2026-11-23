jest.mock('../../models/Budget');
jest.mock('../../models/Transaction');

const Budget = require('../../models/Budget');
const Transaction = require('../../models/Transaction');
const { getBudgets, createOrUpdateBudget, deleteBudget } = require('../../controllers/budgetController');

const userId = 'user-1';

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

describe('getBudgets', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId }, query: { month: '11', year: '2026' } };
    res = response();
    next = jest.fn();
  });

  test('calculates spent, remaining, percentage, status and totals', async () => {
    Budget.find.mockResolvedValue([
      { category: 'Food', amount: 100 },
      { category: 'Travel', amount: 100 },
      { category: 'Utilities', amount: 50 },
    ]);
    Transaction.aggregate
      .mockResolvedValueOnce([{ _id: null, total: 80 }])
      .mockResolvedValueOnce([{ _id: null, total: 101 }])
      .mockResolvedValueOnce([]);

    await getBudgets(req, res, next);

    expect(Budget.find).toHaveBeenCalledWith({ userId, month: 11, year: 2026 });
    expect(res.body.month).toBe(11);
    expect(res.body.year).toBe(2026);
    expect(res.body.budgets).toEqual([
      expect.objectContaining({ category: 'Food', spent: 80, remaining: 20, percentageUsed: 80, status: 'warning' }),
      expect.objectContaining({ category: 'Travel', spent: 101, remaining: -1, percentageUsed: 101, status: 'exceeded' }),
      expect.objectContaining({ category: 'Utilities', spent: 0, remaining: 50, percentageUsed: 0, status: 'ok' }),
    ]);
    expect(res.body.totalBudget).toBe(250);
    expect(res.body.totalSpent).toBe(181);
    expect(res.body.totalRemaining).toBe(69);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns zero totals when the user has no budgets', async () => {
    Budget.find.mockResolvedValue([]);

    await getBudgets(req, res, next);

    expect(res.body.budgets).toEqual([]);
    expect(res.body.totalBudget).toBe(0);
    expect(res.body.totalSpent).toBe(0);
    expect(res.body.totalRemaining).toBe(0);
  });

  test('forwards database errors to middleware', async () => {
    const error = new Error('database unavailable');
    Budget.find.mockRejectedValue(error);

    await getBudgets(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('createOrUpdateBudget', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: userId },
      body: { category: ' Food ', amount: 100, month: 11, year: 2026 },
    };
    res = response();
    next = jest.fn();
  });

  test('trims category and upserts with schema validators enabled', async () => {
    const budget = { _id: 'budget-1', category: 'Food', amount: 100 };
    Budget.findOneAndUpdate.mockResolvedValue(budget);

    await createOrUpdateBudget(req, res, next);

    expect(Budget.findOneAndUpdate).toHaveBeenCalledWith(
      { userId, category: 'Food', month: 11, year: 2026 },
      { $set: { amount: 100 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toBe(budget);
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    [{ category: '', amount: 100, month: 11, year: 2026 }, 400],
    [{ category: 'Food', month: 11, year: 2026 }, 400],
    [{ category: 'Food', amount: -1, month: 11, year: 2026 }, 400],
    [{ category: 'Food', amount: '100', month: 11, year: 2026 }, 400],
    [{ category: 'Food', amount: 100, month: 0, year: 2026 }, 400],
    [{ category: 'Food', amount: 100, month: 13, year: 2026 }, 400],
    [{ category: 'Food', amount: 100, month: 1.5, year: 2026 }, 400],
    [{ category: 'Food', amount: 100, month: 11, year: 0 }, 400],
    [{ category: 'Food', amount: 100, month: 11, year: 2026.5 }, 400],
  ])('rejects invalid values with HTTP %i', async (body, status) => {
    req.body = body;

    await createOrUpdateBudget(req, res, next);

    expect(res.statusCode).toBe(status);
    expect(Budget.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards persistence errors to middleware', async () => {
    const error = new Error('database unavailable');
    Budget.findOneAndUpdate.mockRejectedValue(error);

    await createOrUpdateBudget(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('deleteBudget', () => {
  let req;
  let res;
  let next;
  let budget;

  beforeEach(() => {
    jest.clearAllMocks();
    budget = { deleteOne: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, params: { id: 'budget-1' } };
    res = response();
    next = jest.fn();
    Budget.findOne.mockResolvedValue(budget);
  });

  test('deletes only the current user\'s budget', async () => {
    await deleteBudget(req, res, next);

    expect(Budget.findOne).toHaveBeenCalledWith({ _id: 'budget-1', userId });
    expect(budget.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ message: 'Budget deleted' });
  });

  test('returns 404 when the budget does not belong to the user or is missing', async () => {
    Budget.findOne.mockResolvedValue(null);

    await deleteBudget(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(budget.deleteOne).not.toHaveBeenCalled();
  });
});
