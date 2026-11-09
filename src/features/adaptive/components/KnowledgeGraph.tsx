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
  useStore,
  ReactFlowProvider,
} from '@xyflow/react';

import dagre from 'dagre';
import { Lock, Maximize2 } from 'lucide-react';
import { HiOutlineBookOpen } from 'react-icons/hi';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { getConceptDetail } from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { useRouter } from '@/i18n/navigation';
import { useKnowledgeGraph } from '@/hooks/useAdaptive';
import type {
  ConceptDetail,
  KnowledgeGraphData,
  KnowledgeNode,
} from '@/features/adaptive/types/graph';
import ConceptDetailPanel from './ConceptDetail';
import {
  GRAPH_NODE_HEIGHT,
  getGraphLayout,
  getReadableViewport,
  type GraphLayout,
} from './knowledge-graph-viewport';
import styles from './KnowledgeGraphLayout.module.css';

interface KnowledgeGraphProps {
  sessionId?: string;
  /** Exercises answered in this session; at 0 node mastery is only a model prediction. */
  answeredCount?: number | undefined;
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
  showMastery: boolean;
  direction: GraphDirection;
  /** Phone layout: fixed narrow width that matches the dagre layout (RIN-1116). */
  compact?: boolean;
  nodeWidth?: number;
}

const MAX_LABEL_LENGTH = 25;

/**
 * Labels are 12px (`text-xs`); the graph never zooms out below 100% so they stay
 * readable, and learners pan to see the rest (RIN-1010).
 */
const MIN_GRAPH_ZOOM = 1;

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const color = getNodeColor(data.status);
  const opacity = getMasteryOpacity(data.mastery);
  const isLocked = data.status === 'locked';
  const isFilled = data.status === 'mastered' || data.status === 'in_progress';
  const showDot = data.status === 'in_progress';
  const isTruncated = data.label.length > MAX_LABEL_LENGTH;
  const targetPosition = data.direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = data.direction === 'LR' ? Position.Right : Position.Bottom;
  return (
    <div
      className={`${styles['conceptNode']} relative rounded-xl border bg-white px-3 py-2.5 transition-colors duration-200 ${isLocked ? 'border-dashed border-line' : 'hover:border-line-blue'}`}
      style={{
        ...(data.compact && data.nodeWidth
          ? { width: data.nodeWidth, minWidth: data.nodeWidth }
          : undefined),
        borderColor: getNodeBorderColor(data.status),
        backgroundColor: isFilled ? color : undefined,
        color: isFilled ? 'white' : undefined,
      }}
    >
      <Handle type="target" position={targetPosition} className="!h-1.5 !w-1.5 !bg-neutral-400" />
      <div className="flex flex-col items-center justify-center gap-1.5">
        {/* Locked nodes stay at full opacity: neutral-700 keeps contrast above 4.5:1 (RIN-1010). */}
        <div
          title={isTruncated ? data.label : undefined}
          className={`text-center text-xs font-medium tracking-tight ${isFilled ? 'text-white' : isLocked ? 'text-neutral-700' : 'text-neutral-900'}`}
        >
          {isTruncated ? `${data.label.substring(0, MAX_LABEL_LENGTH - 1)}…` : data.label}
        </div>

        {isLocked ? (
          <Lock aria-hidden className="size-3 text-neutral-500" strokeWidth={2.25} />
        ) : !data.showMastery ? null : (
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
  layout: GraphLayout,
) => {
  const { nodeWidth } = layout;
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: layout.nodeSeparation, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: GRAPH_NODE_HEIGHT });
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
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - GRAPH_NODE_HEIGHT / 2,
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
  showMastery,
}: {
  graphData: KnowledgeGraphData | null;
  showMastery: boolean;
  direction: GraphDirection;
  onNodeClick: (nodeId: string) => void;
  preventPageScroll: boolean;
}) {
  const { fitView, setViewport } = useReactFlow();
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);
  const layout = getGraphLayout(direction, viewportWidth);

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
        showMastery,
        direction,
        compact: layout.compact,
        nodeWidth: layout.nodeWidth,
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
    return getLayoutedElements(initialNodes, initialEdges, direction, layout);
  })();
  const nodeCount = nodes.length;

  const readableViewport = getReadableViewport(
    nodes,
    direction,
    viewportWidth,
    viewportHeight,
    layout.nodeWidth,
  );
  const readableX = readableViewport?.x ?? null;
  const readableY = readableViewport?.y ?? null;

  // Fit view when nodes change; a graph too big for 100% opens at its first rank.
  useEffect(() => {
    if (nodeCount > 0) {
      const fitViewTimer = window.setTimeout(() => {
        if (readableX !== null && readableY !== null) {
          void setViewport({ x: readableX, y: readableY, zoom: MIN_GRAPH_ZOOM }, { duration: 800 });
          return;
        }
        void fitView({ padding: 0.2, duration: 800, minZoom: MIN_GRAPH_ZOOM });
      }, 100);
      return () => window.clearTimeout(fitViewTimer);
    }
    return undefined;
  }, [direction, graphData, nodeCount, fitView, setViewport, readableX, readableY]);

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
      fitViewOptions={{ padding: 0.2, minZoom: MIN_GRAPH_ZOOM }}
      minZoom={MIN_GRAPH_ZOOM}
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
  showMastery: boolean;
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
  showMastery,
}: KnowledgeGraphViewportProps) {
  const isExpanded = mode === 'expanded';

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden rounded-xl border border-line bg-white ${isExpanded ? 'h-full' : styles['embeddedViewport']}`}
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

      <div className="min-h-0 w-full flex-1">
        {renderGraph ? (
          <ReactFlowProvider>
            <GraphFlow
              graphData={graphData}
              direction={isExpanded ? 'LR' : 'TB'}
              onNodeClick={onNodeSelect}
              preventPageScroll={isExpanded}
              showMastery={showMastery}
            />
          </ReactFlowProvider>
        ) : null}
      </div>

      {/* On a phone the legend is a strip below the canvas, clear of the graph, the zoom
          controls and the floating help button (RIN-1116). From sm up it floats bottom-centre:
          bottom-right sat under the logged-in help button (RIN-1119). */}
      <div
        data-testid="knowledge-graph-legend"
        className={`${styles['legend']} flex flex-wrap gap-x-4 gap-y-2 border-t border-line bg-white py-3 pl-4 pr-16 font-mono text-xs sm:pointer-events-none sm:absolute sm:bottom-4 sm:left-1/2 sm:z-10 sm:w-max sm:-translate-x-1/2 sm:justify-center sm:rounded-lg sm:border sm:bg-white/90 sm:px-3 sm:py-2 sm:shadow-sm sm:backdrop-blur-sm`}
      >
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div data-legend-swatch className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span className="uppercase tracking-widest text-neutral-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KnowledgeGraph({ sessionId, answeredCount }: KnowledgeGraphProps) {
  const t = useTranslations('adaptiveLearning');
  const {
    data: graphData,
    isLoading: loading,
    error: graphFetchError,
    mutate: retryGraph,
  } = useKnowledgeGraph(sessionId);
  const router = useRouter();
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
    // Available and Locked nodes are white with a pale border; an 8px swatch in that pale
    // colour vanished on the white legend, so the swatch takes the strong node border
    // (RIN-1119). Locked stays dashed like its node (RIN-1116).
    {
      color: 'bg-white border border-line-blue',
      label: t('knowledgeGraph.legend.available'),
    },
    {
      color: 'bg-white border border-dashed border-line-blue',
      label: t('knowledgeGraph.legend.locked'),
    },
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
        className={`${styles['errorPlaceholder']} flex w-full items-center justify-center rounded-xl border border-line bg-neutral-50 px-4 py-10`}
      >
        <div className="space-y-4 text-center">
          <HiOutlineBookOpen className="mx-auto size-10 text-neutral-400" aria-hidden="true" />
          <p role="alert" className="text-base text-red-700">
            {t('knowledgeGraph.loadError')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => router.push(ADAPTIVE_ROUTES.dashboard)}>
              {t('exercise.backToDashboard')}
            </Button>
            <Button onClick={() => void retryGraph()}>{t('exercise.tryAgain')}</Button>
          </div>
        </div>
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
        showMastery={answeredCount !== 0}
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
            showMastery={answeredCount !== 0}
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
