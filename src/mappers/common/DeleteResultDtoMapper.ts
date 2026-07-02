import type { DeleteResultDto } from '@/dtos/common';

export class DeleteResultDtoMapper {
  static toDto(id: string): DeleteResultDto {
    return { id, deleted: true };
  }
}
