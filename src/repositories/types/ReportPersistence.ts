import type { ReportFields } from '@/shared/types/report';
import type { MongoIdLike } from '@/types/mongo';

export interface ReportPersistenceRecord extends ReportFields {
  _id: MongoIdLike;
}
