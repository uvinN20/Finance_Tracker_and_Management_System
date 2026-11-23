const request = require('supertest');
const app = require('../app');

describe('Finora Express API integration', () => {
  test('health endpoint confirms the API is available without database access', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('protects account routes when no bearer token is supplied', async () => {
    const response = await request(app).get('/api/accounts');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Not authorized, no token' });
  });

  test('rejects an invalid bearer token before reaching the protected route', async () => {
    process.env.JWT_SECRET = 'integration-test-secret';
    const response = await request(app)
      .get('/api/accounts')
      .set('Authorization', 'Bearer invalid.integration.token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Not authorized, token failed' });
  });

  test('returns the standard JSON error for an unknown API route', async () => {
    const response = await request(app).get('/api/route-that-does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('/api/route-that-does-not-exist');
  });
});
