import { apiFetch } from '../../lib/api';
import { auth } from '../../lib/firebase';

describe('apiFetch utility', () => {
  const mockGetIdToken = jest.fn();
  const mockUser = {
    uid: 'user-123',
    getIdToken: mockGetIdToken,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as any).currentUser = mockUser;
    mockGetIdToken.mockResolvedValue('mock-token-123');
  });

  it('should throw an error if auth.currentUser is null', async () => {
    (auth as any).currentUser = null;

    await expect(apiFetch('/api/test')).rejects.toThrow(
      'You must be signed in to perform this action.',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should normalize url path and inject Bearer token and headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        data: { message: 'hello' },
      }),
    });

    const result = await apiFetch('/api/tasks');

    expect(mockGetIdToken).toHaveBeenCalledWith(false);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.smartflush.example.com/api/tasks',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token-123',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      data: { message: 'hello' },
    });
  });

  it('should normalize relative paths without leading slash', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: [] }),
    });

    await apiFetch('api/tasks/without-slash');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.smartflush.example.com/api/tasks/without-slash',
      expect.any(Object),
    );
  });

  it('should retry with forceRefresh=true when receiving a 401 Unauthorized', async () => {
    mockGetIdToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');

    // First request returns 401, second returns 200
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce({ error: 'Token expired' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ success: true, data: { reloaded: true } }),
      });

    const result = await apiFetch('/api/protected');

    expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(1, false);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(2, true);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, data: { reloaded: true } });
  });

  it('should throw an error with backend message when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValueOnce({
        success: false,
        error: 'Custom backend validation error',
      }),
    });

    await expect(apiFetch('/api/error-test')).rejects.toThrow(
      'Custom backend validation error',
    );
  });

  it('should fallback to status code error message when backend does not supply error field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(apiFetch('/api/internal-error')).rejects.toThrow(
      'Request failed with status 500',
    );
  });

  it('should throw when payload cannot be parsed as JSON or returns invalid non-object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
    });

    await expect(apiFetch('/api/corrupt')).rejects.toThrow(
      'The server returned an invalid response.',
    );
  });
});
