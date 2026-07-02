import { AccountRepository } from '@/repositories/AccountRepository';
import { AccountService } from '@/services/user/AccountService';
import { getImageStorage } from '@/lib/image-storage-factory';

let accountService: AccountService | undefined;

export function getAccountService(): AccountService {
  accountService ??= new AccountService(new AccountRepository(), getImageStorage());
  return accountService;
}
