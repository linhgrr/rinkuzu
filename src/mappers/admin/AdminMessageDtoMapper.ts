import type { AdminMessageDto } from '@/dtos/admin-user';

export class AdminMessageDtoMapper {
  static toDto(message: string): AdminMessageDto {
    return { message };
  }
}
