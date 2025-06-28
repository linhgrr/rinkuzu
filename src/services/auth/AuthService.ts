import { IAuthService, LoginRequest, RegisterRequest, AuthResponse } from '@/interfaces/services/IAuthService'
import { IUserRepository } from '@/interfaces/repositories/IUserRepository'
import { IUser } from '@/types/index'
import { validateEmail, validatePassword } from '@/lib/utils'
import { hashPassword, verifyPassword } from '@/lib/password'
import { signToken } from '@/lib/jwt'

export class AuthService implements IAuthService {
  constructor(private userRepository: IUserRepository) {}

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { email, password } = credentials

    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    // Find user
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Generate JWT token
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    })

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      token,
    }
  }

  async register(userData: RegisterRequest): Promise<{ user: IUser }> {
    const { email, password, role = 'user' } = userData

    // Validation
    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    if (!validateEmail(email)) {
      throw new Error('Invalid email format')
    }

    if (!validatePassword(password)) {
      throw new Error('Password must be at least 6 characters')
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email)
    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      role: role as 'admin' | 'user',
    })

    return { user }
  }

  async validateCredentials(email: string, password: string): Promise<IUser | null> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      return null
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return null
    }

    return user
  }
} 