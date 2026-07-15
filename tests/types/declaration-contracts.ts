import type { Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type SessionUser = NonNullable<Session['user']>;

type SessionIdContract = Expect<Equal<SessionUser['id'], string>>;
type SessionRoleContract = Expect<Equal<SessionUser['role'], 'admin' | 'user'>>;
type UserIdContract = Expect<Equal<User['id'], string>>;
type JwtIdContract = Expect<Equal<JWT['id'], string>>;
type JwtPasswordCounterContract = Expect<Equal<JWT['pwc'], number | null | undefined>>;
type PublicSiteUrlContract = Expect<
  Equal<NodeJS.ProcessEnv['NEXT_PUBLIC_SITE_URL'], string | undefined>
>;

export type DeclarationContracts =
  | SessionIdContract
  | SessionRoleContract
  | UserIdContract
  | JwtIdContract
  | JwtPasswordCounterContract
  | PublicSiteUrlContract;
