jest.mock('../../models/Goal');

const Goal = require('../../models/Goal');
const { getGoals, createGoal, updateGoal, contributeToGoal, deleteGoal } = require('../../controllers/goalController');

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

describe('getGoals', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId } };
    res = response();
    next = jest.fn();
  });

  test('scopes goals to the user and decorates progress and remaining amounts', async () => {
    const goal = {
      _id: 'goal-1', name: 'Emergency fund', targetAmount: 1000, currentAmount: 250,
      targetDate: undefined,
    };
    const sorted = { sort: jest.fn().mockResolvedValue([goal]) };
    Goal.find.mockReturnValue(sorted);

    await getGoals(req, res, next);

    expect(Goal.find).toHaveBeenCalledWith({ userId });
    expect(sorted.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.body).toEqual([expect.objectContaining({
      _id: 'goal-1', remaining: 750, progress: 25, requiredMonthlySaving: null,
    })]);
    expect(next).not.toHaveBeenCalled();
  });

  test('caps progress at 100 and calculates monthly savings for a dated goal', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 2);
    const sorted = {
      sort: jest.fn().mockResolvedValue([{
        _id: 'goal-2', name: 'Trip', targetAmount: 100, currentAmount: 120, targetDate: futureDate,
      }]),
    };
    Goal.find.mockReturnValue(sorted);

    await getGoals(req, res, next);

    expect(res.body[0].remaining).toBe(0);
    expect(res.body[0].progress).toBe(100);
    expect(res.body[0].requiredMonthlySaving).toBe(0);
  });

  test('forwards database errors to middleware', async () => {
    const error = new Error('database unavailable');
    Goal.find.mockImplementation(() => ({ sort: jest.fn().mockRejectedValue(error) }));

    await getGoals(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('createGoal', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { _id: userId }, body: { name: '  Holiday  ', targetAmount: 1000 } };
    res = response();
    next = jest.fn();
  });

  test('trims the name, defaults current amount and returns 201', async () => {
    const goal = { _id: 'goal-1', name: 'Holiday', targetAmount: 1000, currentAmount: 0 };
    Goal.create.mockResolvedValue(goal);

    await createGoal(req, res, next);

    expect(Goal.create).toHaveBeenCalledWith({
      userId, name: 'Holiday', targetAmount: 1000, currentAmount: 0, targetDate: undefined,
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ name: 'Holiday', progress: 0, remaining: 1000 }));
    expect(next).not.toHaveBeenCalled();
  });

  test('parses a valid target date and preserves the supplied starting amount', async () => {
    req.body = { name: 'Holiday', targetAmount: 1000, currentAmount: 250, targetDate: '2027-01-01' };
    Goal.create.mockImplementation(async (values) => ({ ...values, _id: 'goal-1' }));

    await createGoal(req, res, next);

    expect(Goal.create).toHaveBeenCalledWith(expect.objectContaining({
      currentAmount: 250,
      targetDate: new Date('2027-01-01'),
    }));
    expect(res.body.progress).toBe(25);
  });

  test.each([
    [{ name: ' ', targetAmount: 100 }, 'name and targetAmount are required'],
    [{ name: 'Goal' }, 'name and targetAmount are required'],
    [{ name: 'Goal', targetAmount: 0 }, 'targetAmount must be a positive number'],
    [{ name: 'Goal', targetAmount: '100' }, 'targetAmount must be a positive number'],
    [{ name: 'Goal', targetAmount: 100, currentAmount: -1 }, 'currentAmount must be a non-negative number'],
    [{ name: 'Goal', targetAmount: 100, currentAmount: '1' }, 'currentAmount must be a non-negative number'],
    [{ name: 'Goal', targetAmount: 100, targetDate: 'not-a-date' }, 'targetDate must be a valid date'],
  ])('rejects invalid input with a clear message', async (body, message) => {
    req.body = body;

    await createGoal(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message });
    expect(Goal.create).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards persistence errors to middleware', async () => {
    const error = new Error('database unavailable');
    Goal.create.mockRejectedValue(error);

    await createGoal(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('updateGoal', () => {
  let req;
  let res;
  let next;
  let goal;

  beforeEach(() => {
    jest.clearAllMocks();
    goal = {
      _id: 'goal-1', name: 'Old name', targetAmount: 1000, currentAmount: 100,
      targetDate: new Date('2027-01-01'), save: jest.fn().mockResolvedValue(undefined),
    };
    req = { user: { _id: userId }, params: { id: 'goal-1' }, body: { name: ' New name ', targetAmount: 2000, currentAmount: 500 } };
    res = response();
    next = jest.fn();
    Goal.findOne.mockResolvedValue(goal);
  });

  test('updates only the current user\'s goal and returns decorated result', async () => {
    await updateGoal(req, res, next);

    expect(Goal.findOne).toHaveBeenCalledWith({ _id: 'goal-1', userId });
    expect(goal.name).toBe('New name');
    expect(goal.targetAmount).toBe(2000);
    expect(goal.currentAmount).toBe(500);
    expect(goal.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(expect.objectContaining({ progress: 25, remaining: 1500 }));
  });

  test.each([
    [{ name: ' ' }, 'name must be a non-empty string'],
    [{ targetAmount: 0 }, 'targetAmount must be a positive number'],
    [{ currentAmount: -1 }, 'currentAmount must be a non-negative number'],
    [{ targetDate: 'invalid-date' }, 'targetDate must be a valid date'],
  ])('rejects invalid update values', async (body, message) => {
    req.body = body;

    await updateGoal(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message });
    expect(goal.save).not.toHaveBeenCalled();
  });

  test('clears the target date when null is supplied', async () => {
    req.body = { targetDate: null };

    await updateGoal(req, res, next);

    expect(goal.targetDate).toBeUndefined();
    expect(goal.save).toHaveBeenCalledTimes(1);
  });

  test('returns 404 when the goal is missing or belongs to another user', async () => {
    Goal.findOne.mockResolvedValue(null);

    await updateGoal(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Goal not found' });
    expect(goal.save).not.toHaveBeenCalled();
  });

  test('forwards lookup and save errors to middleware', async () => {
    const error = new Error('database unavailable');
    Goal.findOne.mockRejectedValue(error);

    await updateGoal(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('contributeToGoal', () => {
  let req;
  let res;
  let next;
  let goal;

  beforeEach(() => {
    jest.clearAllMocks();
    goal = { _id: 'goal-1', name: 'Holiday', targetAmount: 1000, currentAmount: 300, save: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, params: { id: 'goal-1' }, body: { amount: 200 } };
    res = response();
    next = jest.fn();
    Goal.findOne.mockResolvedValue(goal);
  });

  test('adds a valid contribution and recalculates progress', async () => {
    await contributeToGoal(req, res, next);

    expect(goal.currentAmount).toBe(500);
    expect(goal.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(expect.objectContaining({ currentAmount: 500, remaining: 500, progress: 50 }));
  });

  test.each([0, -1, '20', NaN, Infinity])('rejects invalid contribution amount %p', async (amount) => {
    req.body = { amount };

    await contributeToGoal(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'amount must be a positive number' });
    expect(goal.save).not.toHaveBeenCalled();
  });

  test('returns 404 for a missing goal and forwards persistence errors', async () => {
    Goal.findOne.mockResolvedValue(null);
    await contributeToGoal(req, res, next);
    expect(res.statusCode).toBe(404);

    const error = new Error('save failed');
    Goal.findOne.mockResolvedValue(goal);
    goal.save.mockRejectedValue(error);
    await contributeToGoal(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('deleteGoal', () => {
  let req;
  let res;
  let next;
  let goal;

  beforeEach(() => {
    jest.clearAllMocks();
    goal = { deleteOne: jest.fn().mockResolvedValue(undefined) };
    req = { user: { _id: userId }, params: { id: 'goal-1' } };
    res = response();
    next = jest.fn();
    Goal.findOne.mockResolvedValue(goal);
  });

  test('deletes only the current user\'s goal', async () => {
    await deleteGoal(req, res, next);

    expect(Goal.findOne).toHaveBeenCalledWith({ _id: 'goal-1', userId });
    expect(goal.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ message: 'Goal deleted' });
  });

  test('returns 404 when the goal is missing or belongs to another user', async () => {
    Goal.findOne.mockResolvedValue(null);

    await deleteGoal(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(goal.deleteOne).not.toHaveBeenCalled();
  });
});
