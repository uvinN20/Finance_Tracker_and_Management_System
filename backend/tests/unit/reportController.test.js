jest.mock('../../models/Transaction');

const Transaction = require('../../models/Transaction');
const { monthlyReport, yearlyReport, categoryReport } = require('../../controllers/reportController');

const userId = 'user-1';
const fixedNow = new Date('2026-11-23T12:00:00.000Z');

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

describe('monthlyReport', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(fixedNow);
    req = { user: { _id: userId }, query: { month: '10', year: '2026' } };
    res = response();
    next = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  test('returns totals, savings, expense categories and type breakdown for selected month', async () => {
    Transaction.aggregate
      .mockResolvedValueOnce([{ _id: 'income', total: 1000 }, { _id: 'expense', total: 350 }])
      .mockResolvedValueOnce([{ _id: 'Food', total: 250 }, { _id: 'Travel', total: 100 }])
      .mockResolvedValueOnce([
        { _id: { type: 'expense', category: 'Food' }, total: 250 },
        { _id: { type: 'income', category: 'Salary' }, total: 1000 },
      ]);

    await monthlyReport(req, res, next);

    expect(Transaction.aggregate).toHaveBeenCalledTimes(3);
    expect(Transaction.aggregate.mock.calls[0][0][0].$match).toEqual({
      userId,
      date: { $gte: new Date(2026, 9, 1), $lt: new Date(2026, 10, 1) },
    });
    expect(res.body).toEqual({
      month: 10,
      year: 2026,
      totalIncome: 1000,
      totalExpense: 350,
      totalSavings: 650,
      expensesByCategory: [{ category: 'Food', total: 250 }, { category: 'Travel', total: 100 }],
      highestExpenseCategory: { category: 'Food', total: 250 },
      breakdown: [
        { type: 'expense', category: 'Food', total: 250 },
        { type: 'income', category: 'Salary', total: 1000 },
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('defaults to the current month and year', async () => {
    req.query = {};
    Transaction.aggregate.mockResolvedValue([]);

    await monthlyReport(req, res, next);

    expect(res.body.month).toBe(11);
    expect(res.body.year).toBe(2026);
    expect(res.body.totalIncome).toBe(0);
    expect(res.body.totalExpense).toBe(0);
    expect(res.body.totalSavings).toBe(0);
    expect(res.body.highestExpenseCategory).toBeNull();
    expect(res.body.expensesByCategory).toEqual([]);
    expect(res.body.breakdown).toEqual([]);
  });

  test.each([
    [{ month: '0', year: '2026' }],
    [{ month: '13', year: '2026' }],
    [{ month: 'abc', year: '2026' }],
    [{ month: '10', year: '1999' }],
    [{ month: '10', year: '2101' }],
    [{ month: '10', year: '2026.5' }],
  ])('rejects invalid month or year before aggregating', async (query) => {
    req.query = query;

    await monthlyReport(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'month must be 1-12 and year must be between 2000 and 2100' });
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  test('forwards aggregation errors to middleware', async () => {
    const error = new Error('database unavailable');
    Transaction.aggregate.mockRejectedValue(error);

    await monthlyReport(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('yearlyReport', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(fixedNow);
    req = { user: { _id: userId }, query: { year: '2025' } };
    res = response();
    next = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  test('returns all 12 months with zero-filled months and yearly summary', async () => {
    Transaction.aggregate
      .mockResolvedValueOnce([
        { _id: { month: 1, type: 'income' }, total: 1000 },
        { _id: { month: 1, type: 'expense' }, total: 300 },
        { _id: { month: 3, type: 'expense' }, total: 50 },
      ])
      .mockResolvedValueOnce([{ _id: 'income', total: 1000 }, { _id: 'expense', total: 350 }])
      .mockResolvedValueOnce([{ _id: 'Food', total: 350 }])
      .mockResolvedValueOnce([{ _id: { type: 'expense', category: 'Food' }, total: 350 }]);

    await yearlyReport(req, res, next);

    expect(Transaction.aggregate).toHaveBeenCalledTimes(4);
    expect(Transaction.aggregate.mock.calls[0][0][0].$match).toEqual({
      userId,
      date: { $gte: new Date(2025, 0, 1), $lt: new Date(2026, 0, 1) },
    });
    expect(res.body.year).toBe(2025);
    expect(res.body.months).toHaveLength(12);
    expect(res.body.months[0]).toEqual({ month: 1, income: 1000, expense: 300 });
    expect(res.body.months[1]).toEqual({ month: 2, income: 0, expense: 0 });
    expect(res.body.months[2]).toEqual({ month: 3, income: 0, expense: 50 });
    expect(res.body.totalIncome).toBe(1000);
    expect(res.body.totalExpense).toBe(350);
    expect(res.body.totalSavings).toBe(650);
    expect(res.body.highestExpenseCategory).toEqual({ category: 'Food', total: 350 });
  });

  test('defaults to current year and rejects invalid years', async () => {
    req.query = {};
    Transaction.aggregate.mockResolvedValue([]);

    await yearlyReport(req, res, next);

    expect(res.body.year).toBe(2026);
    expect(res.body.months).toEqual(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 })));

    req.query = { year: '2101' };
    res = response();
    await yearlyReport(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'year must be between 2000 and 2100' });
  });

  test('forwards aggregation errors to middleware', async () => {
    const error = new Error('database unavailable');
    Transaction.aggregate.mockRejectedValue(error);

    await yearlyReport(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('categoryReport', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId }, query: { category: 'Food', startDate: '2026-10-01', endDate: '2026-10-31' } };
    res = response();
    next = jest.fn();
  });

  test('filters by user, category and date range; sums expenses only', async () => {
    const transactions = [
      { type: 'expense', amount: 40 },
      { type: 'income', amount: 100 },
      { type: 'expense', amount: 60 },
    ];
    const query = { sort: jest.fn().mockResolvedValue(transactions) };
    Transaction.find.mockReturnValue(query);

    await categoryReport(req, res, next);

    expect(Transaction.find).toHaveBeenCalledWith({
      userId,
      category: 'Food',
      date: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-31') },
    });
    expect(query.sort).toHaveBeenCalledWith({ date: -1 });
    expect(res.body).toEqual({ category: 'Food', total: 100, count: 3, transactions });
  });

  test('allows one-sided date filters and requires a category', async () => {
    req.query = { category: 'Food', startDate: '2026-10-01' };
    Transaction.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await categoryReport(req, res, next);

    expect(Transaction.find).toHaveBeenCalledWith({ userId, category: 'Food', date: { $gte: new Date('2026-10-01') } });
    expect(res.body).toEqual({ category: 'Food', total: 0, count: 0, transactions: [] });

    req.query = {};
    res = response();
    await categoryReport(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'category is required' });
  });

  test('does not add a date condition if no dates are supplied', async () => {
    req.query = { category: 'Food' };
    Transaction.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await categoryReport(req, res, next);

    expect(Transaction.find).toHaveBeenCalledWith({ userId, category: 'Food' });
  });

  test('forwards query errors to middleware', async () => {
    const error = new Error('database unavailable');
    Transaction.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(error) });

    await categoryReport(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
