jest.mock('../../models/Transaction');
jest.mock('../../models/Account');

const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const Account = require('../../models/Account');
const { createTransaction, getTransactions, getTransactionById } = require('../../controllers/transactionController');

const userId = 'user-1';
const accountId = '000000000000000000000001';

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

describe('createTransaction', () => {
  let req;
  let res;
  let next;
  let account;

  beforeEach(() => {
    jest.clearAllMocks();
    account = { _id: accountId, userId, balance: 0, save: jest.fn().mockResolvedValue(undefined) };
    req = {
      user: { _id: userId },
      body: { accountId, type: 'income', amount: 25, category: 'Salary' },
    };
    res = response();
    next = jest.fn();
    Account.findOne.mockResolvedValue(account);
    Account.findById.mockResolvedValue(account);
    Transaction.create.mockImplementation(async (data) => ({ _id: 'txn-1', ...data }));
  });

  test('creates income, updates balance and returns 201', async () => {
    await createTransaction(req, res, next);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ _id: 'txn-1', type: 'income', amount: 25 });
    expect(account.balance).toBe(25);
    expect(account.save).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    [{ accountId: '', type: 'income', amount: 25, category: 'Salary' }, 400],
    [{ accountId, type: 'transfer', amount: 25, category: 'Salary' }, 400],
    [{ accountId, type: 'income', amount: 0, category: 'Salary' }, 400],
    [{ accountId, type: 'expense', amount: -1, category: 'Food' }, 400],
    [{ accountId, type: 'income', amount: '25', category: 'Salary' }, 400],
    [{ accountId, type: 'income', amount: Infinity, category: 'Salary' }, 400],
    [{ accountId, type: 'income', amount: 25, category: '   ' }, 400],
    [{ accountId, type: 'income', amount: 25, category: 'Salary', date: 'not-a-date' }, 400],
  ])('rejects invalid input with HTTP %i', async (body, status) => {
    req.body = body;

    await createTransaction(req, res, next);

    expect(res.statusCode).toBe(status);
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(account.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an account not owned by the user', async () => {
    Account.findOne.mockResolvedValue(null);

    await createTransaction(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('forwards persistence failures to error middleware', async () => {
    const error = new Error('database unavailable');
    Transaction.create.mockRejectedValue(error);

    await createTransaction(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('getTransactions', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: userId },
      query: {
        type: 'expense', category: 'Food', startDate: '2026-10-01', endDate: '2026-10-31',
        search: 'lunch', accountId: '000000000000000000000002', page: '2', limit: '10', sort: 'amount',
      },
    };
    res = response();
    next = jest.fn();
  });

  test('applies user filters, search, pagination and returns page metadata', async () => {
    const transactions = [{ _id: 'txn-2' }];
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(transactions),
    };
    Transaction.find.mockReturnValue(query);
    Transaction.countDocuments.mockResolvedValue(15);

    await getTransactions(req, res, next);

    const expectedFilter = {
      userId,
      type: 'expense',
      category: 'Food',
      accountId: new mongoose.Types.ObjectId('000000000000000000000002'),
      date: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-31') },
      $or: [
        { description: /lunch/i },
        { category: /lunch/i },
      ],
    };
    expect(Transaction.find).toHaveBeenCalledWith(expectedFilter);
    expect(Transaction.countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(query.populate).toHaveBeenCalledWith('accountId', 'name type');
    expect(query.sort).toHaveBeenCalledWith('amount');
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(res.body).toEqual({
      transactions,
      pagination: { page: 2, limit: 10, totalCount: 15, totalPages: 2 },
    });
  });

  test('uses default pagination and clamps requested page size to the supported range', async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    Transaction.find.mockReturnValue(query);
    Transaction.countDocuments.mockResolvedValue(0);
    req.query = { page: '-4', limit: '1000' };

    await getTransactions(req, res, next);

    expect(Transaction.find).toHaveBeenCalledWith({ userId });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(res.body.pagination).toEqual({ page: 1, limit: 100, totalCount: 0, totalPages: 0 });
  });

  test.each([
    [{ type: 'transfer' }, 'type must be income or expense'],
    [{ category: '   ' }, 'category must be a non-empty string'],
    [{ accountId: 'invalid-id' }, 'accountId must be a valid account ID'],
    [{ startDate: 'not-a-date' }, 'startDate must be a valid date'],
    [{ endDate: 'not-a-date' }, 'endDate must be a valid date'],
    [{ search: { $ne: '' } }, 'search must be a string of at most 100 characters'],
    [{ search: 'x'.repeat(101) }, 'search must be a string of at most 100 characters'],
    [{ sort: 'userId' }, 'sort is not supported'],
  ])('rejects unsafe query input with %s', async (query, message) => {
    req.query = query;

    await getTransactions(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message });
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  test('forwards list and count errors to middleware', async () => {
    req.query = { accountId: '000000000000000000000002' };
    const error = new Error('query failed');
    Transaction.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(error),
    });
    Transaction.countDocuments.mockResolvedValue(0);

    await getTransactions(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('getTransactionById', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId }, params: { id: 'txn-1' } };
    res = response();
    next = jest.fn();
  });

  test('returns a transaction scoped to the authenticated user and populates its account', async () => {
    const transaction = { _id: 'txn-1' };
    const query = { populate: jest.fn().mockResolvedValue(transaction) };
    Transaction.findOne.mockReturnValue(query);

    await getTransactionById(req, res, next);

    expect(Transaction.findOne).toHaveBeenCalledWith({ _id: 'txn-1', userId });
    expect(query.populate).toHaveBeenCalledWith('accountId', 'name type');
    expect(res.body).toBe(transaction);
  });

  test('returns 404 for another user or missing transaction and forwards query errors', async () => {
    Transaction.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await getTransactionById(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Transaction not found' });

    const error = new Error('query failed');
    Transaction.findOne.mockReturnValue({ populate: jest.fn().mockRejectedValue(error) });
    await getTransactionById(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
