'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';

import dagre from 'dagre';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';

interface ConceptNodeData extends Record<string, unknown> {
  label: string;
}

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  return (
    <div className="min-w-[120px] rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all duration-200">
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !bg-neutral-400" />
      <div className="text-center text-[10px] font-mono tracking-wider text-neutral-700">
        {data.label.length > 25 ? `${data.label.substring(0, 23)}...` : data.label}
      </div>
      <div className="pointer-events-none absolute -inset-0.5 animate-pulse rounded-md border border-neutral-400/30" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !bg-neutral-400" />
    </div>
  );
}

const nodeTypes = {
  concept: ConceptNode,
};

const getLayoutedElements = (nodes: Node<ConceptNodeData>[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 140, height: 60 });
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
      x: nodeWithPosition.x - 70,
      y: nodeWithPosition.y - 30,
    };

    return node;
  });

  return { nodes, edges };
};

function PartialGraphFlow({ partialGraph }: { partialGraph?: PipelinePartialGraph | null }) {
  const { fitView } = useReactFlow();
  const t = useTranslations('adaptiveLearning');

  const initialNodes: Node<ConceptNodeData>[] = (() => {
    if (!partialGraph?.nodes) return [];
    return partialGraph.nodes.map((n) => ({
      id: n.id,
      type: 'concept',
      position: { x: 0, y: 0 },
      data: { label: n.name },
    }));
  })();

  const initialEdges: Edge[] = (() => {
    if (!partialGraph?.edges) return [];
    return partialGraph.edges.map((e, index) => ({
      id: `${e.source}-${e.target}-${index}`,
      source: e.source,
      target: e.target,
      type: 'default',
      animated: true,
      style: { stroke: 'var(--neutral-400)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--neutral-400)' },
    }));
  })();

  const { nodes, edges } = (() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(initialNodes, initialEdges);
  })();
  const nodeCount = nodes.length;

  useEffect(() => {
    if (nodeCount > 0) {
      window.setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 50);
    }
  }, [partialGraph, nodeCount, fitView]);

  if (!partialGraph || nodeCount === 0) {
    return <PanelBlockSkeleton label={t('processing.waitingForConcepts')} />;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-neutral-50/30"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background color="var(--neutral-200)" gap={16} size={1} />
      <Controls showInteractive={false} className="border-neutral-200 fill-neutral-500" />
    </ReactFlow>
  );
}

export default function ProcessingGraphPanel({
  partialGraph,
}: {
  partialGraph?: PipelinePartialGraph | null;
}) {
  return (
    <ReactFlowProvider>
      <PartialGraphFlow {...(partialGraph !== undefined ? { partialGraph } : {})} />
    </ReactFlowProvider>
  );
}
