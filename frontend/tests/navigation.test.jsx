import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '../src/pages/Login';
import Register from '../src/pages/Register';
import Navbar from '../src/components/Navbar';

const authActions = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'QA User', email: 'qa@example.com' }, ...authActions }),
}));

function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

const renderAt = (path, page) => render(
  <MemoryRouter initialEntries={[path]}>
    <CurrentPath />
    <Routes>
      <Route path={path} element={page} />
      <Route path="/" element={<div>Home</div>} />
      <Route path="/login" element={<div>Login route</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('authentication and navigation pages', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('navigates to the dashboard after a successful login', async () => {
    authActions.login.mockResolvedValue({ id: 'qa-user' });
    renderAt('/login', <Login />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    expect(authActions.login).toHaveBeenCalledWith('qa@example.com', 'secret123');
  });

  it('navigates to the dashboard after a successful registration', async () => {
    authActions.register.mockResolvedValue({ id: 'new-user' });
    renderAt('/register', <Register />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    expect(authActions.register).toHaveBeenCalledWith('New User', 'new@example.com', 'secret123', 'LKR');
  });

  it('logs out and navigates to the login route', async () => {
    renderAt('/', <Navbar />);

    fireEvent.click(screen.getByRole('button', { name: 'QA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/login'));
    expect(authActions.logout).toHaveBeenCalledTimes(1);
  });
});
