jest.mock('../../models/Account');
jest.mock('../../models/Transaction');

const Account = require('../../models/Account');
const Transaction = require('../../models/Transaction');
const mongoose = require('mongoose');
const { getAccounts, createAccount, updateAccount, deleteAccount, transfer } = require('../../controllers/accountController');

const userId = 'user-1';
const fromId = '64a000000000000000000001';
const toId = '64a000000000000000000002';

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

describe('transfer', () => {
  let req;
  let res;
  let next;
  let fromAccount;
  let toAccount;

  beforeEach(() => {
    jest.clearAllMocks();
    fromAccount = { _id: new mongoose.Types.ObjectId(fromId), userId, balance: 100, save: jest.fn().mockResolvedValue(undefined) };
    toAccount = { _id: new mongoose.Types.ObjectId(toId), userId, balance: 20, save: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, body: { fromAccountId: fromId, toAccountId: toId, amount: 30 } };
    res = response();
    next = jest.fn();
    Account.findOne.mockResolvedValueOnce(fromAccount).mockResolvedValueOnce(toAccount);
  });

  test('moves funds between accounts without changing combined balance', async () => {
    await transfer(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(fromAccount.balance).toBe(70);
    expect(toAccount.balance).toBe(50);
    expect(fromAccount.balance + toAccount.balance).toBe(120);
    expect(fromAccount.save).toHaveBeenCalledTimes(1);
    expect(toAccount.save).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ fromAccountId: fromId, toAccountId: toId, amount: 0 }, 400],
    [{ fromAccountId: fromId, toAccountId: toId, amount: -1 }, 400],
    [{ fromAccountId: fromId, toAccountId: fromId, amount: 10 }, 400],
  ])('rejects invalid transfer input with HTTP %i', async (body, status) => {
    req.body = body;

    await transfer(req, res, next);

    expect(res.statusCode).toBe(status);
    expect(fromAccount.save).not.toHaveBeenCalled();
    expect(toAccount.save).not.toHaveBeenCalled();
  });

  test('rejects a transfer above available balance and preserves balances', async () => {
    req.body.amount = 101;

    await transfer(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(fromAccount.balance).toBe(100);
    expect(toAccount.balance).toBe(20);
    expect(fromAccount.save).not.toHaveBeenCalled();
    expect(toAccount.save).not.toHaveBeenCalled();
  });

  test('rejects a missing account', async () => {
    Account.findOne.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(toAccount);

    await transfer(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(fromAccount.save).not.toHaveBeenCalled();
  });

  test('rejects missing account IDs and non-numeric amounts', async () => {
    for (const body of [
      { toAccountId: toId, amount: 10 },
      { fromAccountId: fromId, amount: 10 },
      { fromAccountId: fromId, toAccountId: toId, amount: '10' },
    ]) {
      req.body = body;
      res = response();
      await transfer(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(fromAccount.save).not.toHaveBeenCalled();
      expect(toAccount.save).not.toHaveBeenCalled();
    }
  });

  test('forwards account lookup and persistence errors', async () => {
    const error = new Error('database unavailable');
    Account.findOne.mockReset().mockRejectedValue(error);

    await transfer(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    Account.findOne.mockReset().mockResolvedValueOnce(fromAccount).mockResolvedValueOnce(toAccount);
    fromAccount.save.mockRejectedValue(error);
    next.mockClear();
    await transfer(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('getAccounts', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId } };
    res = response();
    next = jest.fn();
  });

  test('returns only the user accounts with combined balance', async () => {
    const accounts = [{ balance: 100 }, { balance: 25 }];
    const query = { sort: jest.fn().mockResolvedValue(accounts) };
    Account.find.mockReturnValue(query);

    await getAccounts(req, res, next);

    expect(Account.find).toHaveBeenCalledWith({ userId });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(res.body).toEqual({ accounts, total: 125 });
  });

  test('returns zero total for an empty account list and forwards errors', async () => {
    Account.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await getAccounts(req, res, next);
    expect(res.body).toEqual({ accounts: [], total: 0 });

    const error = new Error('database unavailable');
    Account.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(error) });
    await getAccounts(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('createAccount', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId }, body: { name: 'QA Savings', type: 'savings', balance: 50 } };
    res = response();
    next = jest.fn();
  });

  test('creates an account for the authenticated user', async () => {
    const account = { _id: 'account-3', ...req.body, userId };
    Account.create.mockResolvedValue(account);

    await createAccount(req, res, next);

    expect(Account.create).toHaveBeenCalledWith({ userId, name: 'QA Savings', type: 'savings', balance: 50 });
    expect(res.statusCode).toBe(201);
    expect(res.body).toBe(account);
  });

  test('defaults a missing or zero balance to zero', async () => {
    req.body = { name: 'Cash' };
    Account.create.mockResolvedValue({});
    await createAccount(req, res, next);
    expect(Account.create).toHaveBeenCalledWith({ userId, name: 'Cash', type: undefined, balance: 0 });
  });

  test('rejects missing account name and forwards database errors', async () => {
    req.body = { type: 'cash' };
    await createAccount(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Account name is required' });
    expect(Account.create).not.toHaveBeenCalled();

    const error = new Error('database unavailable');
    req.body = { name: 'Cash' };
    Account.create.mockRejectedValue(error);
    await createAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('updateAccount', () => {
  let req;
  let res;
  let next;
  let account;

  beforeEach(() => {
    jest.clearAllMocks();
    account = { _id: 'account-1', name: 'Old name', type: 'cash', save: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, params: { id: 'account-1' }, body: { name: 'New name', type: 'savings' } };
    res = response();
    next = jest.fn();
    Account.findOne.mockResolvedValue(account);
  });

  test('updates supplied fields on the current user account', async () => {
    await updateAccount(req, res, next);

    expect(Account.findOne).toHaveBeenCalledWith({ _id: 'account-1', userId });
    expect(account).toMatchObject({ name: 'New name', type: 'savings' });
    expect(account.save).toHaveBeenCalledTimes(1);
    expect(res.body).toBe(account);
  });

  test('leaves omitted fields unchanged and returns 404 for another user or missing account', async () => {
    req.body = { name: 'Renamed' };
    await updateAccount(req, res, next);
    expect(account.name).toBe('Renamed');
    expect(account.type).toBe('cash');

    Account.findOne.mockResolvedValue(null);
    res = response();
    await updateAccount(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Account not found' });
  });

  test('updates only the account type when the name is omitted', async () => {
    req.body = { type: 'bank' };

    await updateAccount(req, res, next);

    expect(account.name).toBe('Old name');
    expect(account.type).toBe('bank');
    expect(account.save).toHaveBeenCalledTimes(1);
  });

  test('forwards lookup and save errors', async () => {
    const error = new Error('database unavailable');
    Account.findOne.mockRejectedValue(error);
    await updateAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);

    Account.findOne.mockResolvedValue(account);
    account.save.mockRejectedValue(error);
    next.mockClear();
    await updateAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('deleteAccount', () => {
  let req;
  let res;
  let next;
  let account;

  beforeEach(() => {
    jest.clearAllMocks();
    account = { _id: 'account-1', deleteOne: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, params: { id: 'account-1' } };
    res = response();
    next = jest.fn();
    Account.findOne.mockResolvedValue(account);
  });

  test('prevents deleting accounts that have transactions', async () => {
    Transaction.countDocuments.mockResolvedValue(2);

    await deleteAccount(req, res, next);

    expect(Transaction.countDocuments).toHaveBeenCalledWith({ accountId: account._id });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/has transactions/);
    expect(account.deleteOne).not.toHaveBeenCalled();
  });

  test('deletes an empty account and returns 404 if it is not owned or missing', async () => {
    Transaction.countDocuments.mockResolvedValue(0);
    await deleteAccount(req, res, next);
    expect(account.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ message: 'Account deleted' });

    Account.findOne.mockResolvedValue(null);
    res = response();
    await deleteAccount(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(Transaction.countDocuments).toHaveBeenCalledTimes(1);
  });

  test('forwards lookup, transaction count and delete errors', async () => {
    const error = new Error('database unavailable');
    Account.findOne.mockRejectedValue(error);
    await deleteAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);

    Account.findOne.mockResolvedValue(account);
    Transaction.countDocuments.mockRejectedValue(error);
    next.mockClear();
    await deleteAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);

    Transaction.countDocuments.mockResolvedValue(0);
    account.deleteOne.mockRejectedValue(error);
    next.mockClear();
    await deleteAccount(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
