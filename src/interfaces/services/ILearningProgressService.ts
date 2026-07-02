import type {
  BuyStreakFreezeResponseDto,
  DueReviewListDto,
  LibraryListDto,
  LibraryListQueryDto,
  SubmitReviewRequestDto,
  SubmitReviewResponseDto,
} from '@/dtos/review';
import type { ServiceResult } from '@/interfaces/services/types';

export interface ILearningProgressService {
  listLibrary(userId: string, options: LibraryListQueryDto): Promise<ServiceResult<LibraryListDto>>;

  listDueReviews(userId: string): Promise<ServiceResult<DueReviewListDto>>;

  submitReview(
    userId: string,
    input: SubmitReviewRequestDto,
  ): Promise<ServiceResult<SubmitReviewResponseDto>>;

  buyStreakFreeze(userId: string): Promise<ServiceResult<BuyStreakFreezeResponseDto>>;
}
