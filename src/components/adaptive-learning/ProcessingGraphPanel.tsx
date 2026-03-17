'use client'

import { memo, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import type { PipelineJobStatus } from './types'

interface ConceptNodeData extends Record<string, unknown> {
  label: string
}

const ConceptNode = memo(function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  return (
    <div className="min-w-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 transition-all duration-200">
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !bg-slate-400" />
      <div className="text-center text-[10px] font-mono tracking-wider text-slate-700">
        {data.label.length > 25 ? `${data.label.substring(0, 23)}...` : data.label}
      </div>
      <div className="pointer-events-none absolute -inset-0.5 animate-pulse rounded-md border border-slate-400/30" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !bg-slate-400" />
    </div>
  )
})

const nodeTypes = {
  concept: ConceptNode,
}

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const getLayoutedElements = (nodes: Node<ConceptNodeData>[], edges: Edge[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 140, height: 60 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom

    node.position = {
      x: nodeWithPosition.x - 70,
      y: nodeWithPosition.y - 30,
    }

    return node
  })

  return { nodes, edges }
}

function PartialGraphFlow({ partialGraph }: { partialGraph?: PipelineJobStatus['partial_graph'] }) {
  const { fitView } = useReactFlow()
  const t = useTranslations('adaptiveLearning')

  const initialNodes: Node<ConceptNodeData>[] = useMemo(() => {
    if (!partialGraph?.nodes)
      return []
    return partialGraph.nodes.map((n) => ({
      id: n.id,
      type: 'concept',
      position: { x: 0, y: 0 },
      data: { label: n.name },
    }))
  }, [partialGraph])

  const initialEdges: Edge[] = useMemo(() => {
    if (!partialGraph?.edges)
      return []
    return partialGraph.edges.map((e, index) => ({
      id: `${e.source}-${e.target}-${index}`,
      source: e.source,
      target: e.target,
      type: 'default',
      animated: true,
      style: { stroke: '#94A3B8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
    }))
  }, [partialGraph])

  const { nodes, edges } = useMemo(() => {
    if (initialNodes.length === 0)
      return { nodes: [], edges: [] }
    return getLayoutedElements(initialNodes, initialEdges)
  }, [initialNodes, initialEdges])

  useEffect(() => {
    if (nodes.length > 0) {
      window.setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 50)
    }
  }, [nodes, fitView])

  if (!partialGraph || nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          {t('processing.waitingForConcepts')}
        </div>
      </div>
    )
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
      className="bg-slate-50/30"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background color="#E2E8F0" gap={16} size={1} />
      <Controls showInteractive={false} className="border-slate-200 fill-slate-500" />
    </ReactFlow>
  )
}

export default function ProcessingGraphPanel({ partialGraph }: { partialGraph?: PipelineJobStatus['partial_graph'] }) {
  return (
    <ReactFlowProvider>
      <PartialGraphFlow partialGraph={partialGraph} />
    </ReactFlowProvider>
  )
}
