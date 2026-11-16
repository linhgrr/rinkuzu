import type { CreateQuizRequestDto, QuizDetailDto } from '@/dtos/quiz';
import type {
  ClaimableGuestDraft,
  IGuestDraftClaimRepository,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type { IGuestDraftAttemptRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IGuestAttemptClaimService } from '@/interfaces/services/IGuestAttemptClaimService';
import type { IGuestDraftClaimService } from '@/interfaces/services/IGuestDraftClaimService';
import type {
  GuestDraftEvents,
  GuestDraftRefresher,
} from '@/interfaces/services/IGuestDraftService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { QuizCreationError } from '@/lib/quiz/errors';

type Clock = () => Date;

/** The one quiz call the claim needs: idempotent per `sourceDraftId`. */
interface GuestDraftQuizCreator {
  createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<QuizDetailDto>;
}

/**
 * Turns a guest draft into a normal quiz in the new account (RIN-1447). The quiz is
 * public like every learner quiz; Premium stays the owner's later choice. Keyed by the
 * draft's `sourceDraftId`, so a retry or a second tab finds the quiz the first made.
 * Only hashes reach the repositories; neither tokens nor hashes are logged. A draft that
 * holds only its first batch is polled once first and, if still incomplete, claimed with
 * what it holds: no question the guest saw is lost (RIN-1619).
 */
export class GuestDraftClaimService implements IGuestDraftClaimService {
  constructor(
    private readonly drafts: IGuestDraftClaimRepository,
    private readonly attempts: IGuestDraftAttemptRepository,
    private readonly quizzes: GuestDraftQuizCreator,
    private readonly guestAttempts: Pick<IGuestAttemptClaimService, 'claimHashed'>,
    private readonly events: Pick<GuestDraftEvents, 'claimed'>,
    private readonly refresher: GuestDraftRefresher,
    private readonly now: Clock = () => new Date(),
  ) {}

  async claimHashed(userId: string, tokenHashes: readonly string[]): Promise<string[]> {
    if (tokenHashes.length === 0) return [];
    const hashes = [...new Set(tokenHashes)];
    let drafts = await this.drafts.findClaimable(hashes, this.now());
    if (drafts.some((draft) => !draft.complete)) {
      await Promise.all(hashes.map((hash) => this.refresher.refreshHashed(hash)));
      drafts = await this.drafts.findClaimable(hashes, this.now());
    }
    const slugs: string[] = [];
    for (const draft of drafts) {
      const slug = await this.claimOne(userId, draft);
      if (slug) slugs.push(slug);
    }
    return slugs;
  }

  claim(userId: string, tokens: readonly string[]): Promise<string[]> {
    return this.claimHashed(userId, tokens.map(hashGuestClaimToken));
  }

  private async claimOne(userId: string, draft: ClaimableGuestDraft): Promise<string | null> {
    let quiz: QuizDetailDto;
    try {
      quiz = await this.quizzes.createQuizFromDraft(userId, draft.apiDraftId, {
        title: draft.title,
        questions: draft.questions,
        submitToPremium: false,
      });
    } catch (error) {
      // Another account already made the quiz from this draft: nothing to claim here.
      if (error instanceof QuizCreationError && error.code === 'invalid_draft') return null;
      throw error;
    }
    // The quiz keeps the first batch; the rest the API may still write would be lost anyway.
    if (!draft.complete) await this.refresher.releaseUpstream(draft.apiDraftId);
    const unowned = await this.attempts.moveGuestDraftAttempts(
      draft.id,
      { id: quiz.id, slug: quiz.slug },
      userId,
    );
    // The draft's attempts belong to whoever holds the draft: they count toward activated.
    if (unowned.length > 0) await this.guestAttempts.claimHashed(userId, unowned);
    if (await this.drafts.deleteClaimed(draft.id)) {
      const { locale, entry, source, pageCount } = draft;
      await this.events.claimed({ draftId: draft.id, locale, entry, source, pageCount });
    }
    return quiz.slug;
  }
}
