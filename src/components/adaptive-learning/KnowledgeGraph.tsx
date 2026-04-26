'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { getConceptDetail } from './api-client';
import { useKnowledgeGraph } from '@/hooks/useAdaptiveLearning';
import type { ConceptDetail, KnowledgeGraphData, KnowledgeNode } from './types';
import ConceptDetailPanel from './ConceptDetail';

interface KnowledgeGraphProps {
    sessionId?: string;
}

function getNodeColor(status: KnowledgeNode['status']) {
    if (status === 'mastered') return 'var(--brand-trust)';
    if (status === 'in_progress') return 'var(--brand-action)';
    if (status === 'available') return 'var(--bg-surface)';
    return 'var(--border-default)';
}

function getMasteryOpacity(mastery: number) {
    return 0.4 + mastery * 0.6;
}

interface ConceptNodeData extends Record<string, unknown> {
    label: string;
    status: KnowledgeNode['status'];
    mastery: number;
}

const ConceptNode = memo(function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
    const color = getNodeColor(data.status);
    const opacity = getMasteryOpacity(data.mastery);
    const isLocked = data.status === 'locked';

    return (
        <div
            className={`min-w-[140px] rounded-xl border bg-white px-3 py-2.5 transition-colors duration-200 ${isLocked ? 'border-neutral-200 opacity-60' : 'hover:border-neutral-400'}`}
            style={{
                borderColor: isLocked ? undefined : data.status === 'available' ? 'var(--border-default)' : color,
                backgroundColor: data.status === 'mastered' || data.status === 'in_progress' ? color : undefined,
                color: data.status === 'mastered' || data.status === 'in_progress' ? 'white' : undefined,
            }}
        >
            <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-neutral-400" />

            <div className="flex flex-col items-center justify-center gap-1.5">
                <div className={`text-center text-xs font-medium tracking-tight ${data.status === 'mastered' || data.status === 'in_progress' ? 'text-white' : 'text-neutral-900'}`}>
                    {data.label.length > 25 ? `${data.label.substring(0, 23)}...` : data.label}
                </div>

                <div className="flex items-center gap-1.5">
                    <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color, opacity }}
                    />
                    <span className={`text-[10px] font-mono ${data.status === 'mastered' || data.status === 'in_progress' ? 'text-white/80' : 'text-neutral-500'}`}>
                        {Math.round(data.mastery * 100)}%
                    </span>
                </div>
            </div>

            {data.status === 'in_progress' && (
                <div className="pointer-events-none absolute -inset-[1px] animate-pulse rounded-xl border border-orange-300/60" />
            )}

            <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-neutral-400" />
        </div>
    );
});

const nodeTypes = {
    concept: ConceptNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node<ConceptNodeData>[], edges: Edge[], direction = 'TB') => {
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

function GraphFlow({ graphData, onNodeClick }: { graphData: KnowledgeGraphData | null, onNodeClick: (nodeId: string) => void }) {
    const { fitView } = useReactFlow();

    const initialNodes: Node<ConceptNodeData>[] = useMemo(() => {
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
    }, [graphData]);

    const initialEdges: Edge[] = useMemo(() => {
        if (!graphData) return [];
        return graphData.edges.map((e, index) => ({
            id: `${e.source}-${e.target}-${index}`,
            source: e.source,
            target: e.target,
            type: 'default',
            animated: true,
            style: { stroke: 'var(--border-default)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-default)' },
            interactionWidth: 10,
        }));
    }, [graphData]);

    const { nodes, edges } = useMemo(() => {
        if (initialNodes.length === 0) return { nodes: [], edges: [] };
        return getLayoutedElements(initialNodes, initialEdges);
    }, [initialNodes, initialEdges]);

    // Fit view when nodes change
    useEffect(() => {
        if (nodes.length > 0) {
            window.setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
        }
    }, [nodes, fitView]);

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        onNodeClick(node.id);
    }, [onNodeClick]);

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
    const { data: graphData, isLoading: loading } = useKnowledgeGraph(sessionId);
    const [selectedConcept, setSelectedConcept] = useState<ConceptDetail | null>(null);
    const conceptDetailCacheRef = useRef<Map<string, ConceptDetail>>(new Map());

    useEffect(() => {
        if (!sessionId) {
            setSelectedConcept(null);
            conceptDetailCacheRef.current.clear();
        }
    }, [sessionId]);

    const handleNodeSelect = useCallback(
        async (nodeId: string) => {
            if (!sessionId) {
                return;
            }

            const cachedDetail = conceptDetailCacheRef.current.get(nodeId);
            if (cachedDetail) {
                setSelectedConcept(cachedDetail);
                return;
            }

            try {
                const detail = await getConceptDetail(sessionId, nodeId);
                conceptDetailCacheRef.current.set(nodeId, detail);
                setSelectedConcept(detail);
            } catch {
                // Ignore temporary request errors; user can retry by clicking again.
            }
        },
        [sessionId]
    );

    const legendItems = useMemo(
        () => [
            { color: 'bg-brand-trust', label: t('knowledgeGraph.legend.mastered') },
            { color: 'bg-brand-action', label: t('knowledgeGraph.legend.inProgress') },
            { color: 'bg-white border border-neutral-300', label: t('knowledgeGraph.legend.available') },
            { color: 'bg-neutral-200', label: t('knowledgeGraph.legend.locked') },
        ],
        [t]
    );

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
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
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
                    <h3 className="text-base font-medium tracking-tight text-neutral-900">{t('knowledgeGraph.title')}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{t('knowledgeGraph.clickNodeHint')}</p>
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
                <ConceptDetailPanel concept={selectedConcept} onClose={() => setSelectedConcept(null)} />
            ) : null}
        </>
    );
}
