jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'signed-test-token') }));
jest.mock('../../models/User');
jest.mock('../../models/Account');

const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Account = require('../../models/Account');
const { register, login, getMe, updateMe, changePassword } = require('../../controllers/authController');

const userId = 'user-1';
const safeUser = { id: userId, name: 'QA User', email: 'qa@example.com', currency: 'LKR', monthlyIncomeTarget: 0 };

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

describe('register', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
    delete process.env.JWT_EXPIRES_IN;
    req = { body: { name: 'QA User', email: 'QA@example.com', password: 'secret123', currency: 'LKR' } };
    res = response();
    next = jest.fn();
  });

  test.each([
    [{ email: 'qa@example.com', password: 'secret123' }],
    [{ name: 'QA User', password: 'secret123' }],
    [{ name: 'QA User', email: 'qa@example.com' }],
  ])('rejects missing required fields', async (body) => {
    req.body = body;

    await register(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Name, email and password are required' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('rejects an already registered email using lowercase lookup', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing-user' });

    await register(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'qa@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Email already registered' });
    expect(User.create).not.toHaveBeenCalled();
  });

  test('creates a user and default cash account, then returns safe user and token', async () => {
    const user = { _id: userId, toSafeObject: jest.fn(() => safeUser) };
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(user);
    Account.create.mockResolvedValue({});

    await register(req, res, next);

    expect(User.create).toHaveBeenCalledWith({
      name: 'QA User', email: 'QA@example.com', password: 'secret123', currency: 'LKR',
    });
    expect(Account.create).toHaveBeenCalledWith({ userId, name: 'Cash', type: 'cash', balance: 0 });
    expect(jwt.sign).toHaveBeenCalledWith({ id: userId }, 'unit-test-secret', { expiresIn: '7d' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ user: safeUser, token: 'signed-test-token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards registration and default-account errors', async () => {
    const error = new Error('database unavailable');
    User.findOne.mockRejectedValue(error);

    await register(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('login', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
    req = { body: { email: 'QA@example.com', password: 'secret123' } };
    res = response();
    next = jest.fn();
  });

  test.each([
    [{ password: 'secret123' }],
    [{ email: 'qa@example.com' }],
  ])('rejects missing credentials', async (body) => {
    req.body = body;

    await login(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Email and password are required' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('returns the same unauthorized response for unknown email and wrong password', async () => {
    User.findOne.mockResolvedValue(null);

    await login(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'qa@example.com' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password' });

    const user = { comparePassword: jest.fn().mockResolvedValue(false) };
    User.findOne.mockResolvedValue(user);
    res = response();
    await login(req, res, next);
    expect(user.comparePassword).toHaveBeenCalledWith('secret123');
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password' });
  });

  test('returns safe user and a signed token for valid credentials', async () => {
    const user = { _id: userId, comparePassword: jest.fn().mockResolvedValue(true), toSafeObject: jest.fn(() => safeUser) };
    User.findOne.mockResolvedValue(user);

    await login(req, res, next);

    expect(user.comparePassword).toHaveBeenCalledWith('secret123');
    expect(jwt.sign).toHaveBeenCalledWith({ id: userId }, 'unit-test-secret', { expiresIn: '7d' });
    expect(res.body).toEqual({ user: safeUser, token: 'signed-test-token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards database and password comparison errors', async () => {
    const error = new Error('database unavailable');
    User.findOne.mockRejectedValue(error);

    await login(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('getMe', () => {
  test('returns the authenticated user safe object', () => {
    const req = { user: { toSafeObject: jest.fn(() => safeUser) } };
    const res = response();

    getMe(req, res);

    expect(req.user.toSafeObject).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ user: safeUser });
  });
});

describe('updateMe', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: {
        name: 'Old name', currency: 'USD', monthlyIncomeTarget: 0,
        save: jest.fn().mockResolvedValue(undefined), toSafeObject: jest.fn(() => safeUser),
      },
      body: { name: 'Updated name', currency: 'LKR', monthlyIncomeTarget: 50000 },
    };
    res = response();
    next = jest.fn();
  });

  test('updates supplied profile fields and returns safe user', async () => {
    await updateMe(req, res, next);

    expect(req.user).toMatchObject({ name: 'Updated name', currency: 'LKR', monthlyIncomeTarget: 50000 });
    expect(req.user.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ user: safeUser });
    expect(next).not.toHaveBeenCalled();
  });

  test('leaves omitted profile fields as they were', async () => {
    req.body = {};

    await updateMe(req, res, next);

    expect(req.user).toMatchObject({ name: 'Old name', currency: 'USD', monthlyIncomeTarget: 0 });
    expect(req.user.save).toHaveBeenCalledTimes(1);
  });

  test('forwards save errors', async () => {
    const error = new Error('save failed');
    req.user.save.mockRejectedValue(error);

    await updateMe(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('changePassword', () => {
  let req;
  let res;
  let next;
  let user;

  beforeEach(() => {
    jest.clearAllMocks();
    user = { comparePassword: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue(undefined) };
    User.findById.mockResolvedValue(user);
    req = { user: { _id: userId }, body: { currentPassword: 'old-secret', newPassword: 'new-secret' } };
    res = response();
    next = jest.fn();
  });

  test('checks current password, saves new password and returns success', async () => {
    await changePassword(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(user.comparePassword).toHaveBeenCalledWith('old-secret');
    expect(user.password).toBe('new-secret');
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ message: 'Password updated successfully' });
  });

  test('rejects an incorrect current password without saving', async () => {
    user.comparePassword.mockResolvedValue(false);

    await changePassword(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Current password is incorrect' });
    expect(user.save).not.toHaveBeenCalled();
  });

  test('forwards lookup, comparison and save errors', async () => {
    const error = new Error('password update failed');
    User.findById.mockRejectedValue(error);

    await changePassword(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
