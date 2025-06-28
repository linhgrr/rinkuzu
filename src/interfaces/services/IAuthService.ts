import { IUser } from '@/types/index'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  role?: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    role: string
  }
  token: string
}

export interface IAuthService {
  login(credentials: LoginRequest): Promise<AuthResponse>
  register(userData: RegisterRequest): Promise<{ user: IUser }>
  validateCredentials(email: string, password: string): Promise<IUser | null>
} 