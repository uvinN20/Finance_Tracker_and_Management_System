const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const Account = require('../models/Account');
const buildDateRange = require('./dateRange');

const parseAccountId = (value) => {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) return null;
  return new mongoose.Types.ObjectId(value);
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const applyBalanceChange = async (accountId, type, amount, sign = 1) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');
  const delta = type === 'income' ? amount : -amount;
  account.balance += delta * sign;
  await account.save();
};

// @route POST /api/transactions
const createTransaction = async (req, res, next) => {
  try {
    const { accountId, type, amount, category, description, date, paymentMethod } = req.body;

    if (!accountId || !type || amount === undefined || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ message: 'accountId, type, amount and category are required' });
    }
    const safeAccountId = parseAccountId(accountId);
    if (!safeAccountId) {
      return res.status(400).json({ message: 'accountId must be a valid account ID' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'type must be income or expense' });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amount must be greater than 0' });
    }
    if (date !== undefined && Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ message: 'date must be valid' });
    }

    const account = await Account.findOne({ _id: safeAccountId, userId: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const transaction = await Transaction.create({
      userId: req.user._id,
      accountId: safeAccountId,
      type,
      amount,
      category,
      description,
      date: date || Date.now(),
      paymentMethod,
    });

    await applyBalanceChange(safeAccountId, type, amount, 1);

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

// @route GET /api/transactions?type=&category=&startDate=&endDate=&search=&accountId=&page=&limit=&sort=
const getTransactions = async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, search, accountId, page = 1, limit = 20, sort = '-date' } = req.query;

    const filter = { userId: req.user._id };
    if (type !== undefined) {
      if (typeof type !== 'string' || !['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'type must be income or expense' });
      }
      filter.type = type;
    }
    if (category !== undefined) {
      if (typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ message: 'category must be a non-empty string' });
      }
      filter.category = category.trim();
    }
    if (accountId !== undefined) {
      const safeAccountId = parseAccountId(accountId);
      if (!safeAccountId) return res.status(400).json({ message: 'accountId must be a valid account ID' });
      filter.accountId = safeAccountId;
    }
    const dateRange = buildDateRange(startDate, endDate);
    if (dateRange.invalidField) {
      return res.status(400).json({ message: `${dateRange.invalidField} must be a valid date` });
    }
    if (dateRange.filter) filter.date = mongoose.trusted(dateRange.filter);
    if (search !== undefined) {
      if (typeof search !== 'string' || search.length > 100) {
        return res.status(400).json({ message: 'search must be a string of at most 100 characters' });
      }
      const searchPattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { description: searchPattern },
        { category: searchPattern },
      ];
    }

    const allowedSorts = ['date', '-date', 'amount', '-amount', 'category', '-category', 'createdAt', '-createdAt'];
    if (typeof sort !== 'string' || !allowedSorts.includes(sort)) {
      return res.status(400).json({ message: 'sort is not supported' });
    }
    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const safeFilter = mongoose.sanitizeFilter(filter);

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(safeFilter)
        .populate('accountId', 'name type')
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Transaction.countDocuments(safeFilter),
    ]);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id }).populate(
      'accountId',
      'name type'
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

// @route PUT /api/transactions/:id
const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    const { accountId, type, amount, category, description, date, paymentMethod } = req.body;
    if (type !== undefined && !['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'type must be income or expense' });
    }
    if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)) {
      return res.status(400).json({ message: 'amount must be greater than 0' });
    }
    if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
      return res.status(400).json({ message: 'category must be a non-empty string' });
    }
    if (date !== undefined && Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ message: 'date must be valid' });
    }
    const safeAccountId = accountId === undefined ? undefined : parseAccountId(accountId);
    if (accountId !== undefined && !safeAccountId) {
      return res.status(400).json({ message: 'accountId must be a valid account ID' });
    }
    if (accountId !== undefined) {
      const targetAccount = await Account.findOne({ _id: safeAccountId, userId: req.user._id });
      if (!targetAccount) return res.status(404).json({ message: 'Account not found' });
    }

    // Reverse the old effect only after the new values and target ownership are valid.
    await applyBalanceChange(transaction.accountId, transaction.type, transaction.amount, -1);

    if (accountId !== undefined) transaction.accountId = safeAccountId;
    if (type !== undefined) transaction.type = type;
    if (amount !== undefined) transaction.amount = amount;
    if (category !== undefined) transaction.category = category;
    if (description !== undefined) transaction.description = description;
    if (date !== undefined) transaction.date = date;
    if (paymentMethod !== undefined) transaction.paymentMethod = paymentMethod;

    await transaction.save();

    // Apply the new effect
    await applyBalanceChange(transaction.accountId, transaction.type, transaction.amount, 1);

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/transactions/:id
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    await applyBalanceChange(transaction.accountId, transaction.type, transaction.amount, -1);
    await transaction.deleteOne();

    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
