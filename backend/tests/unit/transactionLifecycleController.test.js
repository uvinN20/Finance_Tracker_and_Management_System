jest.mock('../../models/Transaction');
jest.mock('../../models/Account');

const Transaction = require('../../models/Transaction');
const Account = require('../../models/Account');
const mongoose = require('mongoose');
const { updateTransaction, deleteTransaction } = require('../../controllers/transactionController');

const userId = 'user-1';
const transactionId = 'transaction-1';
const fromAccountId = '000000000000000000000001';
const toAccountId = '000000000000000000000002';

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

describe('updateTransaction', () => {
  let req;
  let res;
  let next;
  let transaction;
  let fromAccount;
  let toAccount;

  beforeEach(() => {
    jest.clearAllMocks();
    fromAccount = { _id: fromAccountId, balance: 100, save: jest.fn().mockResolvedValue(undefined) };
    toAccount = { _id: toAccountId, balance: 20, save: jest.fn().mockResolvedValue(undefined) };
    transaction = {
      _id: transactionId,
      userId,
      accountId: fromAccountId,
      type: 'expense',
      amount: 25,
      category: 'Food',
      description: 'Groceries',
      date: new Date('2026-11-10T10:00:00.000Z'),
      paymentMethod: 'cash',
      save: jest.fn().mockResolvedValue(undefined),
    };
    req = {
      user: { _id: userId },
      params: { id: transactionId },
      body: { accountId: toAccountId, type: 'income', amount: 40, category: 'Salary' },
    };
    res = response();
    next = jest.fn();
    Transaction.findOne.mockReset().mockResolvedValue(transaction);
    Account.findById.mockReset().mockResolvedValueOnce(fromAccount).mockResolvedValueOnce(toAccount);
    Account.findOne.mockReset().mockResolvedValue(toAccount);
  });

  test('reverses the old effect and applies the updated transaction to the new account', async () => {
    await updateTransaction(req, res, next);

    expect(Transaction.findOne).toHaveBeenCalledWith({ _id: transactionId, userId });
    expect(fromAccount.balance).toBe(125);
    expect(toAccount.balance).toBe(60);
    expect(fromAccount.save).toHaveBeenCalledTimes(1);
    expect(toAccount.save).toHaveBeenCalledTimes(1);
    expect(transaction.save).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(transaction);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 404 when the transaction does not belong to the user or is missing', async () => {
    Transaction.findOne.mockResolvedValue(null);

    await updateTransaction(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(Account.findById).not.toHaveBeenCalled();
    expect(transaction.save).not.toHaveBeenCalled();
  });

  test.each([
    [{ type: 'transfer' }],
    [{ amount: '40' }],
    [{ amount: 0 }],
    [{ category: '  ' }],
    [{ date: 'not-a-date' }],
  ])('rejects invalid updates before changing balances', async (body) => {
    req.body = body;

    await updateTransaction(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(Account.findById).not.toHaveBeenCalled();
    expect(transaction.save).not.toHaveBeenCalled();
    expect(fromAccount.balance).toBe(100);
    expect(toAccount.balance).toBe(20);
  });

  test('rejects a target account owned by another user before reversing the old balance', async () => {
    Account.findOne.mockResolvedValue(null);

    await updateTransaction(req, res, next);

    expect(Account.findOne).toHaveBeenCalledWith({ _id: new mongoose.Types.ObjectId(toAccountId), userId });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Account not found' });
    expect(Account.findById).not.toHaveBeenCalled();
    expect(fromAccount.balance).toBe(100);
    expect(toAccount.balance).toBe(20);
    expect(transaction.save).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction', () => {
  let req;
  let res;
  let next;
  let transaction;
  let account;

  beforeEach(() => {
    jest.clearAllMocks();
    account = { _id: fromAccountId, balance: 100, save: jest.fn().mockResolvedValue(undefined) };
    transaction = {
      _id: transactionId,
      userId,
      accountId: fromAccountId,
      type: 'expense',
      amount: 25,
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    req = { user: { _id: userId }, params: { id: transactionId } };
    res = response();
    next = jest.fn();
    Transaction.findOne.mockReset().mockResolvedValue(transaction);
    Account.findById.mockReset().mockResolvedValue(account);
  });

  test('restores the account balance and deletes the transaction', async () => {
    await deleteTransaction(req, res, next);

    expect(Transaction.findOne).toHaveBeenCalledWith({ _id: transactionId, userId });
    expect(account.balance).toBe(125);
    expect(account.save).toHaveBeenCalledTimes(1);
    expect(transaction.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Transaction deleted' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 404 and leaves balances untouched when the transaction is missing', async () => {
    Transaction.findOne.mockResolvedValue(null);

    await deleteTransaction(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(Account.findById).not.toHaveBeenCalled();
    expect(transaction.deleteOne).not.toHaveBeenCalled();
  });
});
