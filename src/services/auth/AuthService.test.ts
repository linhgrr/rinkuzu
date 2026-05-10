import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './AuthService';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signToken } from '@/lib/jwt';

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/jwt', () => ({
  signToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

function createService(overrides: Record<string, any> = {}) {
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByRole: vi.fn(),
    findExpiredSubscriptionUsers: vi.fn(),
    updateById: vi.fn(),
    ...overrides,
  };

  return {
    userRepository,
    service: new AuthService(userRepository),
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('throws when email or password is missing', async () => {
      const { service } = createService();

      await expect(service.login({ email: '', password: 'pass' })).rejects.toThrow(
        'Email and password are required',
      );
      await expect(service.login({ email: 'a@b.com', password: '' })).rejects.toThrow(
        'Email and password are required',
      );
    });

    it('throws when user is not found', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@test.com', password: 'pass123' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('throws when password is wrong', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
        email: 'user@test.com',
        password: 'hashed-pass',
        role: 'user',
      });
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(service.login({ email: 'user@test.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('returns user and token on successful login', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
        email: 'user@test.com',
        password: 'hashed-pass',
        role: 'user',
      });
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.login({ email: 'user@test.com', password: 'correct' });

      expect(result).toEqual({
        user: { id: 'user-1', email: 'user@test.com', role: 'user' },
        token: 'mock-jwt-token',
      });
      expect(signToken).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
      });
    });
  });

  describe('register', () => {
    it('throws when email or password is missing', async () => {
      const { service } = createService();

      await expect(service.register({ email: '', password: 'pass123' })).rejects.toThrow(
        'Email and password are required',
      );
    });

    it('throws on invalid email format', async () => {
      const { service } = createService();

      await expect(
        service.register({ email: 'not-an-email', password: 'pass123' }),
      ).rejects.toThrow('Invalid email format');
    });

    it('throws on short password', async () => {
      const { service } = createService();

      await expect(service.register({ email: 'a@b.com', password: '12345' })).rejects.toThrow(
        'Password must be at least 6 characters',
      );
    });

    it('throws when email is already taken', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({ _id: 'existing' });

      await expect(
        service.register({ email: 'taken@test.com', password: 'pass123' }),
      ).rejects.toThrow('User with this email already exists');
    });

    it('hashes password and creates user on successful registration', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue('hashed-pass');
      userRepository.create.mockResolvedValue({
        _id: 'user-1',
        email: 'new@test.com',
        password: 'hashed-pass',
        role: 'user',
      });

      const result = await service.register({
        email: 'new@test.com',
        password: 'plain-pass',
        role: 'user',
      });

      expect(result.user.email).toBe('new@test.com');
      expect(hashPassword).toHaveBeenCalledWith('plain-pass');
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'hashed-pass',
        role: 'user',
      });
    });

    it('defaults role to "user" when not provided', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue('hashed');
      userRepository.create.mockResolvedValue({
        _id: 'u1',
        email: 'u@b.com',
        password: 'hashed',
        role: 'user',
      });

      const result = await service.register({ email: 'u@b.com', password: 'pass123' });

      expect(result.user.role).toBe('user');
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    });
  });

  describe('validateCredentials', () => {
    it('returns null when user is not found', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.validateCredentials('missing@test.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: 'user-1',
        email: 'user@test.com',
        password: 'hashed',
      });
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const result = await service.validateCredentials('user@test.com', 'wrong');

      expect(result).toBeNull();
    });

    it('returns the user when credentials are valid', async () => {
      const mockUser = {
        _id: 'user-1',
        email: 'user@test.com',
        password: 'hashed',
        role: 'user',
      };
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.validateCredentials('user@test.com', 'correct');

      expect(result).toEqual(mockUser);
    });
  });
});
