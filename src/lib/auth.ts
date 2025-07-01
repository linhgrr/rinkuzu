import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from './mongoose';
import User from '@/models/User';
import { verifyPassword } from './password';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await connectDB();
          
          const user = await User.findOne({ email: credentials.email });
          if (!user) {
            return null;
          }

          const isValidPassword = await verifyPassword(
            credentials.password,
            user.password
          );
          
          console.log('Auth debug:', {
            email: credentials.email,
            passwordLength: credentials.password.length,
            hashedPasswordLength: user.password.length,
            isValidPassword
          });
          
          if (!isValidPassword) {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '180000') || 50 * 60 * 60, // 50 hours default
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 