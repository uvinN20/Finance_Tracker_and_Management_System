const Goal = require('../models/Goal');

const decorate = (goal) => {
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const progress = goal.targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100) : 0;

  let requiredMonthlySaving = null;
  if (goal.targetDate) {
    const now = new Date();
    const months = Math.max(
      (goal.targetDate.getFullYear() - now.getFullYear()) * 12 + (goal.targetDate.getMonth() - now.getMonth()),
      1
    );
    requiredMonthlySaving = Math.ceil(remaining / months);
  }

  return {
    _id: goal._id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    remaining,
    progress,
    requiredMonthlySaving,
  };
};

const getGoals = async (req, res, next) => {
  try {
    const goals = await Goal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(goals.map(decorate));
  } catch (err) {
    next(err);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const { name, targetAmount, currentAmount, targetDate } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName || targetAmount === undefined) {
      return res.status(400).json({ message: 'name and targetAmount are required' });
    }
    if (typeof targetAmount !== 'number' || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ message: 'targetAmount must be a positive number' });
    }
    if (currentAmount !== undefined && (typeof currentAmount !== 'number' || !Number.isFinite(currentAmount) || currentAmount < 0)) {
      return res.status(400).json({ message: 'currentAmount must be a non-negative number' });
    }
    let normalizedTargetDate;
    if (targetDate !== undefined && targetDate !== null && targetDate !== '') {
      normalizedTargetDate = new Date(targetDate);
      if (Number.isNaN(normalizedTargetDate.getTime())) {
        return res.status(400).json({ message: 'targetDate must be a valid date' });
      }
    }
    const goal = await Goal.create({
      userId: req.user._id,
      name: normalizedName,
      targetAmount,
      currentAmount: currentAmount === undefined ? 0 : currentAmount,
      targetDate: normalizedTargetDate,
    });
    res.status(201).json(decorate(goal));
  } catch (err) {
    next(err);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const { name, targetAmount, currentAmount, targetDate } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'name must be a non-empty string' });
      }
      goal.name = name.trim();
    }
    if (targetAmount !== undefined) {
      if (typeof targetAmount !== 'number' || !Number.isFinite(targetAmount) || targetAmount <= 0) {
        return res.status(400).json({ message: 'targetAmount must be a positive number' });
      }
      goal.targetAmount = targetAmount;
    }
    if (currentAmount !== undefined) {
      if (typeof currentAmount !== 'number' || !Number.isFinite(currentAmount) || currentAmount < 0) {
        return res.status(400).json({ message: 'currentAmount must be a non-negative number' });
      }
      goal.currentAmount = currentAmount;
    }
    if (targetDate !== undefined) {
      const parsedTargetDate = targetDate === null || targetDate === '' ? undefined : new Date(targetDate);
      if (parsedTargetDate && Number.isNaN(parsedTargetDate.getTime())) {
        return res.status(400).json({ message: 'targetDate must be a valid date' });
      }
      goal.targetDate = parsedTargetDate;
    }

    await goal.save();
    res.json(decorate(goal));
  } catch (err) {
    next(err);
  }
};

// @route POST /api/goals/:id/contribute  { amount }
const contributeToGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    const { amount } = req.body;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    goal.currentAmount += amount;
    await goal.save();
    res.json(decorate(goal));
  } catch (err) {
    next(err);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    await goal.deleteOne();
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getGoals, createGoal, updateGoal, contributeToGoal, deleteGoal };
