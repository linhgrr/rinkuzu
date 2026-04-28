export interface KnowledgeNode {
  id: string;
  index: number;
  name: string;
  mastery: number;
  status: 'locked' | 'available' | 'in_progress' | 'mastered';
  visited: boolean;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface MasteryRow {
  concept_id: string;
  concept_name: string;
  bloom_levels: number[];
}

export interface MasteryMatrixData {
  matrix: MasteryRow[];
  bloom_labels: string[];
}

export interface ConceptPrereq {
  id: string;
  name: string;
  mastery: number;
}

export interface ConceptDetail {
  id: string;
  name: string;
  definition: string;
  mastery: number;
  status: 'locked' | 'available' | 'in_progress' | 'mastered';
  bloom_mastery: number[];
  prerequisites: ConceptPrereq[];
  dependents: ConceptPrereq[];
  visited: boolean;
  visit_count: number;
}
