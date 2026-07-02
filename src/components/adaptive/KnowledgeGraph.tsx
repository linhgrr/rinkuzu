'use client';

import React, { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslations } from 'next-intl';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';

import dagre from 'dagre';
import { Lock } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import type {
  ConceptDetail,
  KnowledgeGraphData,
  KnowledgeNode,
} from '@/features/adaptive/types/graph';
import ConceptDetailPanel from './ConceptDetail';

interface KnowledgeGraphProps {
  sessionId?: string;
}

interface SelectedConceptState {
  sessionId: string;
  detail: ConceptDetail;
}

function getNodeColor(status: KnowledgeNode['status']) {
  if (status === 'mastered') return 'var(--brand-trust)';
  if (status === 'in_progress') return 'var(--brand-action)';
  if (status === 'available') return 'var(--bg-surface)';
  return 'var(--border-default)';
}

function getNodeBorderColor(status: KnowledgeNode['status']) {
  if (status === 'locked') return undefined;
  if (status === 'available') return 'var(--border-default)';
  return getNodeColor(status);
}

type EdgeVariant = 'locked' | 'mastered' | 'default';

const EDGE_STYLES: Record<
  EdgeVariant,
  { stroke: string; strokeWidth: number; dashed: boolean; opacity: number; animated: boolean }
> = {
  locked: {
    stroke: 'var(--border-default)',
    strokeWidth: 1.5,
    dashed: true,
    opacity: 0.5,
    animated: false,
  },
  mastered: {
    stroke: 'var(--brand-trust)',
    strokeWidth: 2.5,
    dashed: false,
    opacity: 1,
    animated: true,
  },
  default: {
    stroke: 'var(--text-secondary, #525252)',
    strokeWidth: 1.5,
    dashed: false,
    opacity: 1,
    animated: true,
  },
};

function getMasteryOpacity(mastery: number) {
  return 0.4 + mastery * 0.6;
}

interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  status: KnowledgeNode['status'];
  mastery: number;
}

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const color = getNodeColor(data.status);
  const opacity = getMasteryOpacity(data.mastery);
  const isLocked = data.status === 'locked';
  const isFilled = data.status === 'mastered' || data.status === 'in_progress';
  const showDot = data.status === 'in_progress';

  return (
    <div
      className={`relative min-w-[140px] rounded-xl border bg-white px-3 py-2.5 transition-colors duration-200 ${isLocked ? 'border-neutral-200 opacity-60' : 'hover:border-neutral-400'}`}
      style={{
        borderColor: getNodeBorderColor(data.status),
        backgroundColor: isFilled ? color : undefined,
        color: isFilled ? 'white' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-neutral-400" />

      <div className="flex flex-col items-center justify-center gap-1.5">
        <div
          className={`text-center text-xs font-medium tracking-tight ${isFilled ? 'text-white' : 'text-neutral-900'}`}
        >
          {data.label.length > 25 ? `${data.label.substring(0, 23)}...` : data.label}
        </div>

        {isLocked ? (
          <Lock aria-hidden className="size-3 text-neutral-400" strokeWidth={2.25} />
        ) : (
          <div className="flex items-center gap-1.5">
            {showDot && <div className="size-1.5 rounded-full bg-white" style={{ opacity }} />}
            <span
              className={`text-[10px] font-mono ${isFilled ? 'text-white/80' : 'text-neutral-500'}`}
            >
              {Math.round(data.mastery * 100)}%
            </span>
          </div>
        )}
      </div>

      {data.status === 'in_progress' && (
        <div className="pointer-events-none absolute -inset-[1px] animate-pulse rounded-xl border border-orange-300/60" />
      )}

      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-neutral-400" />
    </div>
  );
}

const nodeTypes = {
  concept: ConceptNode,
};

function getConceptDetailCache(ref: MutableRefObject<Map<string, ConceptDetail> | null>) {
  if (ref.current === null) {
    ref.current = new Map<string, ConceptDetail>();
  }

  return ref.current;
}

function getConceptDetailCacheKey(sessionId: string, nodeId: string) {
  return `${sessionId}:${nodeId}`;
}

const getLayoutedElements = (nodes: Node<ConceptNodeData>[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 70 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - 75,
      y: nodeWithPosition.y - 35,
    };

    return node;
  });

  return { nodes, edges };
};

function GraphFlow({
  graphData,
  onNodeClick,
}: {
  graphData: KnowledgeGraphData | null;
  onNodeClick: (nodeId: string) => void;
}) {
  const { fitView } = useReactFlow();

  const initialNodes: Node<ConceptNodeData>[] = (() => {
    if (!graphData) return [];
    return graphData.nodes.map((n) => ({
      id: n.id,
      type: 'concept',
      position: { x: 0, y: 0 },
      data: {
        label: n.name,
        status: n.status,
        mastery: n.mastery,
      },
    }));
  })();

  const initialEdges: Edge[] = (() => {
    if (!graphData) return [];
    const statusById = new Map(initialNodes.map((n) => [n.id, n.data.status] as const));
    return graphData.edges.map((e, index) => {
      const variant: EdgeVariant =
        statusById.get(e.target) === 'locked'
          ? 'locked'
          : statusById.get(e.source) === 'mastered'
            ? 'mastered'
            : 'default';
      const s = EDGE_STYLES[variant];
      return {
        id: `${e.source}-${e.target}-${index}`,
        source: e.source,
        target: e.target,
        type: 'default',
        animated: s.animated,
        style: {
          stroke: s.stroke,
          strokeWidth: s.strokeWidth,
          strokeDasharray: s.dashed ? '4 4' : undefined,
          opacity: s.opacity,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: s.stroke },
        interactionWidth: 10,
      };
    });
  })();

  const { nodes, edges } = (() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(initialNodes, initialEdges);
  })();
  const nodeCount = nodes.length;

  // Fit view when nodes change
  useEffect(() => {
    if (nodeCount > 0) {
      window.setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    }
  }, [graphData, nodeCount, fitView]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    onNodeClick(node.id);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      panOnScroll={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
      className="bg-neutral-50/50"
    >
      <Background color="#ececea" gap={20} size={1} />
      <Controls showInteractive={false} className="border-neutral-200 fill-neutral-600" />
    </ReactFlow>
  );
}

export default function KnowledgeGraph({ sessionId }: KnowledgeGraphProps) {
  const t = useTranslations('adaptiveLearning');
  const {
    data: graphData,
    isLoading: loading,
    error: graphFetchError,
  } = useKnowledgeGraph(sessionId);
  const [selectedConceptState, setSelectedConceptState] = useState<SelectedConceptState | null>(
    null,
  );
  const [graphError, setGraphError] = useState<string | null>(null);
  const conceptDetailCacheRef = useRef<Map<string, ConceptDetail> | null>(null);
  const selectedConcept =
    selectedConceptState && selectedConceptState.sessionId === sessionId
      ? selectedConceptState.detail
      : null;

  const handleNodeSelect = async (nodeId: string) => {
    if (!sessionId) {
      return;
    }

    const cache = getConceptDetailCache(conceptDetailCacheRef);
    const cacheKey = getConceptDetailCacheKey(sessionId, nodeId);
    const cachedDetail = cache.get(cacheKey);
    if (cachedDetail) {
      setGraphError(null);
      setSelectedConceptState({ sessionId, detail: cachedDetail });
      return;
    }

    try {
      const detail = await getConceptDetail(sessionId, nodeId);
      cache.set(cacheKey, detail);
      setGraphError(null);
      setSelectedConceptState({ sessionId, detail });
    } catch {
      setGraphError(t('processing.errors.generic'));
    }
  };

  const legendItems = [
    { color: 'bg-brand-trust', label: t('knowledgeGraph.legend.mastered') },
    { color: 'bg-brand-action', label: t('knowledgeGraph.legend.inProgress') },
    { color: 'bg-white border border-neutral-300', label: t('knowledgeGraph.legend.available') },
    { color: 'bg-neutral-200', label: t('knowledgeGraph.legend.locked') },
  ];

  if (!sessionId) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <p className="text-sm text-neutral-500">{t('knowledgeGraph.startSessionHint')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-white">
        <Spinner />
      </div>
    );
  }

  if (graphFetchError) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-red-100 bg-red-50">
        <p role="alert" className="text-sm text-red-700">
          {t('processing.errors.generic')}
        </p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <p className="text-sm text-neutral-500">{t('knowledgeGraph.noData')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="pointer-events-none absolute left-5 top-4 z-10">
          <h3 className="text-base font-medium tracking-tight text-neutral-900">
            {t('knowledgeGraph.title')}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">{t('knowledgeGraph.clickNodeHint')}</p>
          {graphError ? (
            <p
              role="alert"
              className="pointer-events-auto mt-2 max-w-md rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700"
            >
              {graphError}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-none absolute bottom-4 right-5 z-10 flex gap-4 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2 text-[10px] font-mono shadow-sm backdrop-blur-sm">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${item.color}`} />
              <span className="text-neutral-700 uppercase tracking-widest">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="h-full w-full">
          <ReactFlowProvider>
            <GraphFlow graphData={graphData} onNodeClick={handleNodeSelect} />
          </ReactFlowProvider>
        </div>
      </div>

      {selectedConcept ? (
        <ConceptDetailPanel
          concept={selectedConcept}
          onClose={() => setSelectedConceptState(null)}
        />
      ) : null}
    </>
  );
}
