import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../src/api/axios';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

vi.mock('../src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

let currentAuth;

function AuthProbe() {
  currentAuth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(currentAuth.loading)}</span>
      <span data-testid="user">{JSON.stringify(currentAuth.user)}</span>
    </div>
  );
}

const mountAuth = () => render(<AuthProvider><AuthProbe /></AuthProvider>);
const waitUntilLoaded = () => waitFor(() => expect(document.querySelector('[data-testid="loading"]').textContent).toBe('false'));

describe('AuthProvider storage and session behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    currentAuth = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('normalizes a stored user and ignores unsafe properties', async () => {
    localStorage.setItem('user', JSON.stringify({
      id: 'local-user',
      name: 'N'.repeat(110),
      email: 'e'.repeat(260),
      currency: 'INVALID',
      monthlyIncomeTarget: 'not-a-number',
      role: 'admin',
    }));

    mountAuth();
    await waitUntilLoaded();

    const user = JSON.parse(document.querySelector('[data-testid="user"]').textContent);
    expect(user).toEqual({
      id: 'local-user',
      _id: 'local-user',
      name: 'N'.repeat(100),
      email: 'e'.repeat(254),
      currency: 'LKR',
      monthlyIncomeTarget: 0,
    });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('ignores malformed stored JSON', async () => {
    localStorage.setItem('user', '{invalid');

    mountAuth();
    await waitUntilLoaded();

    expect(document.querySelector('[data-testid="user"]').textContent).toBe('null');
  });

  it('restores and normalizes the authenticated user from the API', async () => {
    localStorage.setItem('token', 'session-token');
    api.get.mockResolvedValue({ data: { user: {
      _id: 'api-user', name: 'Manual QA', email: 'qa@example.com', currency: 'USD', monthlyIncomeTarget: 2500,
    } } });

    mountAuth();
    await waitUntilLoaded();

    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({
      id: 'api-user', _id: 'api-user', currency: 'USD', monthlyIncomeTarget: 2500,
    });
  });

  it('clears a session when the API response is invalid or unavailable', async () => {
    localStorage.setItem('token', 'session-token');
    api.get.mockResolvedValue({ data: { user: { id: 'missing-required-fields' } } });

    mountAuth();
    await waitUntilLoaded();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(document.querySelector('[data-testid="user"]').textContent).toBe('null');

    localStorage.setItem('token', 'session-token');
    api.get.mockRejectedValue(new Error('offline'));
    cleanup();
    mountAuth();
    await waitUntilLoaded();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('tolerates browser storage removal failures while restoring a session', async () => {
    localStorage.setItem('token', 'session-token');
    api.get.mockRejectedValue(new Error('offline'));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable'); });

    mountAuth();
    await waitUntilLoaded();

    expect(document.querySelector('[data-testid="user"]').textContent).toBe('null');
  });
});

describe('AuthProvider actions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    currentAuth = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('stores safe login and registration responses', async () => {
    api.post
      .mockResolvedValueOnce({ data: { token: 'login-token', user: { id: 'login-user', name: 'Login', email: 'login@example.com', currency: 'EUR', monthlyIncomeTarget: 100 } } })
      .mockResolvedValueOnce({ data: { token: 'register-token', user: { id: 'register-user', name: 'Register', email: 'register@example.com', currency: 'GBP', monthlyIncomeTarget: 200 } } });
    mountAuth();
    await waitUntilLoaded();

    await act(async () => { await currentAuth.login('login@example.com', 'password'); });
    expect(localStorage.getItem('token')).toBe('login-token');
    expect(JSON.parse(localStorage.getItem('user')).currency).toBe('EUR');

    await act(async () => { await currentAuth.register('Register', 'register@example.com', 'password', 'GBP'); });
    expect(api.post).toHaveBeenNthCalledWith(2, '/auth/register', {
      name: 'Register', email: 'register@example.com', password: 'password', currency: 'GBP',
    });
    expect(localStorage.getItem('token')).toBe('register-token');
    expect(JSON.parse(localStorage.getItem('user')).id).toBe('register-user');
  });

  it('rejects malformed login and registration responses', async () => {
    api.post
      .mockResolvedValueOnce({ data: { user: { id: 'no-token', name: 'User', email: 'user@example.com' } } })
      .mockResolvedValueOnce({ data: { token: 'token', user: { id: 'no-name' } } });
    mountAuth();
    await waitUntilLoaded();

    await expect(currentAuth.login('user@example.com', 'password')).rejects.toThrow('Invalid login response');
    await expect(currentAuth.register('User', 'user@example.com', 'password', 'LKR')).rejects.toThrow('Invalid registration response');
  });

  it('ignores invalid user updates, stores valid updates, and clears the session on logout', async () => {
    mountAuth();
    await waitUntilLoaded();

    act(() => { currentAuth.updateUser({ id: 'invalid' }); });
    expect(document.querySelector('[data-testid="user"]').textContent).toBe('null');

    act(() => { currentAuth.updateUser({ id: 'updated-user', name: 'Updated', email: 'updated@example.com', monthlyIncomeTarget: -50 }); });
    expect(JSON.parse(localStorage.getItem('user')).id).toBe('updated-user');
    expect(JSON.parse(localStorage.getItem('user')).monthlyIncomeTarget).toBe(0);

    localStorage.setItem('token', 'token');
    act(() => { currentAuth.logout(); });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
