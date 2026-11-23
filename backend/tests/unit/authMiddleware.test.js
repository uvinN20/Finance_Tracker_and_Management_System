jest.mock('jsonwebtoken');
jest.mock('../../models/User');

const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { protect } = require('../../middleware/authMiddleware');

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

describe('protect authentication middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'auth-middleware-test-secret';
    req = { headers: {} };
    res = response();
    next = jest.fn();
  });

  test('rejects a missing bearer token', async () => {
    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Not authorized, no token' });
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test.each(['Bearer invalid-token', 'Bearer expired-token'])('rejects invalid or expired JWTs', async (authorization) => {
    req.headers.authorization = authorization;
    jwt.verify.mockImplementation(() => {
      const error = new Error('token rejected');
      error.name = authorization.includes('expired') ? 'TokenExpiredError' : 'JsonWebTokenError';
      throw error;
    });

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(authorization.split(' ')[1], 'auth-middleware-test-secret');
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Not authorized, token failed' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a valid token whose user no longer exists', async () => {
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user-1' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await protect(req, res, next);

    expect(User.findById).toHaveBeenCalledWith('user-1');
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Not authorized, user not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches the password-excluded user and continues for a valid token', async () => {
    const user = { _id: 'user-1', email: 'qa@example.com' };
    const select = jest.fn().mockResolvedValue(user);
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user-1' });
    User.findById.mockReturnValue({ select });

    await protect(req, res, next);

    expect(select).toHaveBeenCalledWith('-password');
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
