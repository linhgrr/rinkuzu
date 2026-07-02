export interface StringifiableId {
  toString(): string;
}

export type MongoIdLike = string | StringifiableId;
