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
import { Lock, Maximize2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import type {
  ConceptDetail,
  KnowledgeGraphData,
  KnowledgeNode,
} from '@/features/adaptive/types/graph';
import ConceptDetailPanel from './ConceptDetail';
import styles from './KnowledgeGraphLayout.module.css';

interface KnowledgeGraphProps {
  sessionId?: string;
}

interface SelectedConceptState {
  sessionId: string;
  detail: ConceptDetail;
}

type GraphDirection = 'TB' | 'LR';

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
    stroke: 'var(--text-secondary)',
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
  direction: GraphDirection;
}

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const color = getNodeColor(data.status);
  const opacity = getMasteryOpacity(data.mastery);
  const isLocked = data.status === 'locked';
  const isFilled = data.status === 'mastered' || data.status === 'in_progress';
  const showDot = data.status === 'in_progress';
  const targetPosition = data.direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = data.direction === 'LR' ? Position.Right : Position.Bottom;
  return (
    <div
      className={`${styles['conceptNode']} relative rounded-xl border bg-white px-3 py-2.5 transition-colors duration-200 ${isLocked ? 'border-line opacity-60' : 'hover:border-line-blue'}`}
      style={{
        borderColor: getNodeBorderColor(data.status),
        backgroundColor: isFilled ? color : undefined,
        color: isFilled ? 'white' : undefined,
      }}
    >
      <Handle type="target" position={targetPosition} className="!h-1.5 !w-1.5 !bg-neutral-400" />
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
              className={`font-mono text-xs ${isFilled ? 'text-white/80' : 'text-neutral-500'}`}
            >
              {Math.round(data.mastery * 100)}%
            </span>
          </div>
        )}
      </div>

      {data.status === 'in_progress' && (
        <div className="pointer-events-none absolute -inset-[1px] animate-pulse rounded-xl border border-orange-300/60" />
      )}

      <Handle type="source" position={sourcePosition} className="!h-1.5 !w-1.5 !bg-neutral-400" />
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

const getLayoutedElements = (
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  direction: GraphDirection,
) => {
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
  direction,
  onNodeClick,
  preventPageScroll,
}: {
  graphData: KnowledgeGraphData | null;
  direction: GraphDirection;
  onNodeClick: (nodeId: string) => void;
  preventPageScroll: boolean;
}) {
  const { fitView } = useReactFlow();

  const initialNodes: Node<ConceptNodeData>[] = (() => {
    if (!graphData) return [];
    return graphData.nodes.map((n) => ({
      id: n.id,
      type: 'concept',
      draggable: false,
      position: { x: 0, y: 0 },
      data: {
        label: n.name,
        status: n.status,
        mastery: n.mastery,
        direction,
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
        focusable: false,
      };
    });
  })();

  const { nodes, edges } = (() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(initialNodes, initialEdges, direction);
  })();
  const nodeCount = nodes.length;

  // Fit view when nodes change
  useEffect(() => {
    if (nodeCount > 0) {
      const fitViewTimer = window.setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
      return () => window.clearTimeout(fitViewTimer);
    }
    return undefined;
  }, [direction, graphData, nodeCount, fitView]);

  const handleNodeClick = (_: React.MouseEvent, node: Node<ConceptNodeData>) => {
    onNodeClick(node.id);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      edgesFocusable={false}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      panOnScroll={false}
      preventScrolling={preventPageScroll}
      proOptions={{ hideAttribution: true }}
      className="bg-neutral-50/50"
    >
      <Background color="var(--line)" gap={20} size={1} />
      <Controls showInteractive={false} className="border-line fill-neutral-600" />
    </ReactFlow>
  );
}

interface KnowledgeGraphViewportProps {
  graphData: KnowledgeGraphData;
  graphError: string | null;
  legendItems: Array<{ color: string; label: string }>;
  mode: 'embedded' | 'expanded';
  onExpand?: () => void;
  onNodeSelect: (nodeId: string) => void;
  renderGraph?: boolean;
  expandButtonRef?: React.Ref<HTMLButtonElement>;
  title: string;
  clickNodeHint: string;
  expandLabel: string;
}

function KnowledgeGraphViewport({
  graphData,
  graphError,
  legendItems,
  mode,
  onExpand,
  onNodeSelect,
  renderGraph = true,
  expandButtonRef,
  title,
  clickNodeHint,
  expandLabel,
}: KnowledgeGraphViewportProps) {
  const isExpanded = mode === 'expanded';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-line bg-white ${isExpanded ? 'h-full' : styles['embeddedViewport']}`}
    >
      {!isExpanded ? (
        <div
          className={`${styles['embeddedHeader']} pointer-events-none absolute left-5 top-4 z-10`}
        >
          <h3 className="text-base font-medium tracking-tight text-neutral-900">{title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{clickNodeHint}</p>
          {graphError ? (
            <p
              role="alert"
              className="pointer-events-auto mt-2 max-w-md rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700"
            >
              {graphError}
            </p>
          ) : null}
        </div>
      ) : graphError ? (
        <p
          role="alert"
          className="absolute left-5 top-4 z-10 max-w-md rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700"
        >
          {graphError}
        </p>
      ) : null}

      {!isExpanded && onExpand ? (
        <Button
          ref={expandButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          onClick={onExpand}
          aria-haspopup="dialog"
          aria-expanded={!renderGraph}
          aria-label={expandLabel}
          title={expandLabel}
          className="absolute right-4 top-4 z-20 size-11 rounded-full border border-line bg-white/95 p-0 text-neutral-600 shadow-sm backdrop-blur-sm transition-[background-color,border-color,color,transform] hover:border-line-blue hover:bg-neutral-50 hover:text-neutral-900 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-trust"
        >
          <Maximize2 className="size-5" aria-hidden="true" />
        </Button>
      ) : null}

      <div
        className={`${styles['legend']} pointer-events-none absolute bottom-4 right-4 z-10 flex flex-wrap justify-end gap-x-4 gap-y-2 rounded-lg border border-line bg-white/90 px-3 py-2 font-mono text-xs shadow-sm backdrop-blur-sm sm:right-5`}
      >
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${item.color}`} />
            <span className="uppercase tracking-widest text-neutral-700">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="h-full w-full">
        {renderGraph ? (
          <ReactFlowProvider>
            <GraphFlow
              graphData={graphData}
              direction={isExpanded ? 'LR' : 'TB'}
              onNodeClick={onNodeSelect}
              preventPageScroll={isExpanded}
            />
          </ReactFlowProvider>
        ) : null}
      </div>
    </div>
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
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const conceptDetailCacheRef = useRef<Map<string, ConceptDetail> | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const isExpanded = Boolean(sessionId && expandedSessionId === sessionId);
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
    { color: 'bg-white border border-line', label: t('knowledgeGraph.legend.available') },
    { color: 'bg-neutral-200', label: t('knowledgeGraph.legend.locked') },
  ];

  const closeExpandedGraph = () => {
    setExpandedSessionId(null);
    window.requestAnimationFrame(() => expandButtonRef.current?.focus());
  };

  if (!sessionId) {
    return (
      <div
        className={`${styles['placeholder']} flex w-full items-center justify-center rounded-xl border border-line bg-neutral-50`}
      >
        <p className="text-sm text-neutral-500">{t('knowledgeGraph.startSessionHint')}</p>
      </div>
    );
  }

  if (loading) {
    return <PanelBlockSkeleton label={t('knowledgeGraph.title')} />;
  }

  if (graphFetchError) {
    return (
      <div
        className={`${styles['placeholder']} flex w-full items-center justify-center rounded-xl border border-red-100 bg-red-50`}
      >
        <p role="alert" className="text-sm text-red-700">
          {t('processing.errors.generic')}
        </p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div
        className={`${styles['placeholder']} flex w-full items-center justify-center rounded-xl border border-line bg-neutral-50`}
      >
        <p className="text-sm text-neutral-500">{t('knowledgeGraph.noData')}</p>
      </div>
    );
  }

  return (
    <>
      <KnowledgeGraphViewport
        graphData={graphData}
        graphError={graphError}
        legendItems={legendItems}
        mode="embedded"
        onExpand={() => setExpandedSessionId(sessionId)}
        onNodeSelect={handleNodeSelect}
        renderGraph={!isExpanded}
        expandButtonRef={expandButtonRef}
        title={t('knowledgeGraph.title')}
        clickNodeHint={t('knowledgeGraph.clickNodeHint')}
        expandLabel={t('knowledgeGraph.expand')}
      />

      <Modal
        isOpen={isExpanded}
        onClose={closeExpandedGraph}
        title={t('knowledgeGraph.title')}
        description={t('knowledgeGraph.expandedDescription')}
        size="wide"
        className={`${styles['expandedModal']} overflow-hidden`}
      >
        <div className={`${styles['expandedBody']} min-h-0`}>
          <KnowledgeGraphViewport
            graphData={graphData}
            graphError={graphError}
            legendItems={legendItems}
            mode="expanded"
            onNodeSelect={handleNodeSelect}
            title={t('knowledgeGraph.title')}
            clickNodeHint={t('knowledgeGraph.clickNodeHint')}
            expandLabel={t('knowledgeGraph.expand')}
          />
        </div>
      </Modal>

      {selectedConcept ? (
        <ConceptDetailPanel
          concept={selectedConcept}
          onClose={() => setSelectedConceptState(null)}
        />
      ) : null}
    </>
  );
}
