export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export const BLOOM_LABELS: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

export interface Course {
    id: string;
    title: string;
    progress: number;
    totalConcepts: number;
    conceptsLearned: number;
    streak: number;
    lastAccessed: string;
    currentTopic: string;
}

export interface Exercise {
    id: string;
    exercise_id: string;
    concept_name: string;
    concept_idx: number;
    bloom_level: number;
    bloom_label: BloomLevel;
    question: string;
    options: Record<string, string>;
    step: number;
    max_steps: number;
    theory?: {
        content: string;
        examples: string[];
    };
}

export interface SubmitResult {
    is_correct: boolean;
    correct_option: string;
    explanation: string;
    concept_name: string;
    bloom_level: number;
    mastery_after: number;
    avg_mastery: number;
    step: number;
    session_completed: boolean;
    stats: {
        total_correct: number;
        total_answered: number;
        accuracy: number;
    };
}

export interface Session {
    session_id: string;
    n_concepts: number;
    concepts: ConceptInfo[];
    status: string;
}

export interface ConceptInfo {
    id: string;
    name: string;
    index: number;
}

export interface SessionStatus {
    session_id: string;
    status: string;
    step: number;
    max_steps: number;
    concepts_visited: number;
    total_concepts: number;
    avg_mastery: number;
    coverage: number;
    total_correct: number;
    total_answered: number;
    accuracy: number;
    exercises: ExerciseHistoryItem[];
}

export interface ExerciseHistoryItem {
    exercise_id: string;
    concept_name: string;
    bloom_level: number;
    is_correct: boolean | null;
}

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

export interface ConceptPrereq {
    id: string;
    name: string;
    mastery: number;
}

export interface DailyStats {
    exercisesCompleted: number;
    accuracy: number;
    timeSpentMinutes: number;
    conceptsLearned: number;
    streakDays: number;
}

// --- Pipeline ---

export interface PipelineUploadResponse {
    job_id: string;
    filename: string;
    file_size: number;
    subject_id: string;
    status: string;
    message: string;
}

export interface PipelineJobStatus {
    job_id: string;
    filename: string;
    subject_id: string;
    status: PipelineStatus;
    current_step: string;
    progress: number;
    total_chunks: number;
    concepts_extracted: number;
    concepts_after_merge: number;
    relations_verified: number;
    graph_stats: Record<string, any>;
    error_message: string | null;
    partial_graph?: { nodes: { id: string; name: string }[]; edges: { source: string; target: string }[] } | null;
    result?: {
        graph: KnowledgeGraphData;
        stats: Record<string, any>;
        n_concepts: number;
    };
}

export type PipelineStatus =
    | 'pending'
    | 'loading'
    | 'chunking'
    | 'extracting'
    | 'embedding'
    | 'merging'
    | 'ranking'
    | 'verifying'
    | 'building_graph'
    | 'optimizing'
    | 'completed'
    | 'failed';

export interface PipelineSessionResponse {
    session_id: string;
    n_concepts: number;
    source: string;
    job_id: string;
    status: string;
}

// --- MongoDB History ---

export interface SessionHistoryItem {
    session_id: string;
    status: string;
    total_correct: number;
    total_answered: number;
    accuracy: number;
    avg_mastery: number;
    step: number;
    max_steps: number;
    updated_at: number;
    created_at: number;
}

export interface ExerciseHistoryFull {
    exercise_id: string;
    concept_idx: number;
    concept_name: string;
    bloom_level: number;
    question: string;
    options: Record<string, string>;
    correct_option: string;
    explanation: string;
    user_answer: string | null;
    is_correct: boolean | null;
    timestamp: number;
}

export interface SessionHistoryDetail {
    session_id: string;
    status: string;
    total_correct: number;
    total_answered: number;
    accuracy: number;
    avg_mastery: number;
    step: number;
    max_steps: number;
    concept_names: string[];
    concept_mastery: number[];
    bloom_mastery: number[][];
    exercise_history: ExerciseHistoryFull[];
    created_at: number;
    updated_at: number;
}

export interface PipelineJobHistoryItem {
    job_id: string;
    filename: string;
    subject_id: string;
    status: string;
    concepts_after_merge: number;
    relations_verified: number;
    completed_at: number;
}

export interface DeleteSubjectResponse {
    job_id: string;
    deleted_job: number;
    deleted_sessions: number;
    status: string;
}
