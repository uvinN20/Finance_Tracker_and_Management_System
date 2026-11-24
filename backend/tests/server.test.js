describe('server startup', () => {
  const originalPort = process.env.PORT;
  const originalExitCode = process.exitCode;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  test('connects to MongoDB before listening on the configured port', async () => {
    const listen = jest.fn((port, callback) => callback());
    const connectDB = jest.fn().mockResolvedValue(undefined);
    process.env.PORT = '5010';
    jest.doMock('../app', () => ({ listen }));
    jest.doMock('../config/db', () => connectDB);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('../server');
    await new Promise(setImmediate);

    expect(connectDB).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith('5010', expect.any(Function));
    expect(log).toHaveBeenCalledWith('Server running on port 5010');
  });

  test('uses port 5000 when no port is configured', async () => {
    delete process.env.PORT;
    const listen = jest.fn((port, callback) => callback());
    jest.doMock('../app', () => ({ listen }));
    jest.doMock('../config/db', () => jest.fn().mockResolvedValue(undefined));
    jest.spyOn(console, 'log').mockImplementation(() => {});

    require('../server');
    await new Promise(setImmediate);

    expect(listen).toHaveBeenCalledWith('5000', expect.any(Function));
  });

  test('reports database startup failures and sets a failing process exit code', async () => {
    const error = new Error('database unavailable');
    const connectDB = jest.fn().mockRejectedValue(error);
    process.exitCode = 0;
    jest.doMock('../app', () => ({ listen: jest.fn() }));
    jest.doMock('../config/db', () => connectDB);
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});

    require('../server');
    await new Promise(setImmediate);

    expect(logError).toHaveBeenCalledWith('Failed to start server:', error);
    expect(process.exitCode).toBe(1);
  });
});
