'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
    status: 'locked' | 'available' | 'completed' | 'current';
    radius: number;
}

interface Edge {
    from: string;
    to: string;
}

const mockEdges: Edge[] = [
    { from: '1', to: '2' },
    { from: '1', to: '3' },
    { from: '2', to: '4' },
    { from: '3', to: '4' },
    { from: '4', to: '5' },
    { from: '4', to: '6' },
    { from: '5', to: '7' },
    { from: '6', to: '7' },
];

export default function KnowledgeGraph() {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const t = useTranslations('adaptiveLearning');
    const mockNodes: Node[] = [
        { id: '1', x: 100, y: 300, label: t('knowledgeGraph.nodes.basics'), status: 'completed', radius: 40 },
        { id: '2', x: 250, y: 150, label: t('knowledgeGraph.nodes.algebra'), status: 'completed', radius: 45 },
        { id: '3', x: 250, y: 450, label: t('knowledgeGraph.nodes.geometry'), status: 'completed', radius: 45 },
        { id: '4', x: 450, y: 300, label: t('knowledgeGraph.nodes.calculus'), status: 'current', radius: 55 },
        { id: '5', x: 650, y: 200, label: t('knowledgeGraph.nodes.limits'), status: 'available', radius: 35 },
        { id: '6', x: 650, y: 400, label: t('knowledgeGraph.nodes.integrals'), status: 'locked', radius: 35 },
        { id: '7', x: 800, y: 300, label: t('knowledgeGraph.nodes.advanced'), status: 'locked', radius: 30 },
    ];

    const getNodeColor = (status: Node['status']) => {
        switch (status) {
            case 'completed': return '#10B981'; // green-500
            case 'current': return '#6366F1'; // indigo-500
            case 'available': return '#F59E0B'; // amber-500
            case 'locked': return '#D1D5DB'; // gray-300
            default: return '#E5E7EB';
        }
    };

    const getNodeStroke = (status: Node['status']) => {
        if (status === 'locked') return '#9CA3AF'; // gray-400
        return 'white';
    };

    return (
        <div className="w-full h-[600px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative interactive-graph">
            <div className="absolute top-4 left-6 z-10">
                <h3 className="text-lg font-bold text-gray-900">{t('knowledgeGraph.title')}</h3>
                <p className="text-sm text-gray-500">{t('knowledgeGraph.subtitle')}</p>
            </div>

            <div className="absolute bottom-4 right-6 z-10 flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> {t('knowledgeGraph.legend.completed')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /> {t('knowledgeGraph.legend.current')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /> {t('knowledgeGraph.legend.available')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-300" /> {t('knowledgeGraph.legend.locked')}</div>
            </div>

            <svg width="100%" height="100%" viewBox="0 0 900 600" className="w-full h-full">
                {/* Edges */}
                {mockEdges.map((edge, idx) => {
                    const start = mockNodes.find(n => n.id === edge.from)!;
                    const end = mockNodes.find(n => n.id === edge.to)!;

                    return (
                        <motion.path
                            key={idx}
                            d={`M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`}
                            fill="none"
                            stroke="#E5E7EB"
                            strokeWidth="2"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.5, delay: 0.5 }}
                        />
                    );
                })}

                {/* Nodes */}
                {mockNodes.map((node) => (
                    <g
                        key={node.id}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        className="cursor-pointer"
                    >
                        {/* Outer Glow for Current Node */}
                        {node.status === 'current' && (
                            <circle cx={node.x} cy={node.y} r={node.radius + 10} fill={getNodeColor(node.status)} opacity="0.2">
                                <animate attributeName="r" values={`${node.radius + 5};${node.radius + 15};${node.radius + 5}`} dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.2;0.1;0.2" dur="2s" repeatCount="indefinite" />
                            </circle>
                        )}

                        <motion.circle
                            cx={node.x}
                            cy={node.y}
                            r={node.radius}
                            fill={getNodeColor(node.status)}
                            stroke={getNodeStroke(node.status)}
                            strokeWidth="4"
                            initial={{ scale: 0 }}
                            animate={{ scale: hoveredNode === node.id ? 1.1 : 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        />

                        {/* Label inside node if large enough, or icon */}
                        <text
                            x={node.x}
                            y={node.y}
                            dy=".3em"
                            textAnchor="middle"
                            fill="white"
                            fontSize="12"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                        >
                            {node.label.length > 8 ? node.label.substring(0, 1) : node.label}
                        </text>

                        {/* Tooltip-ish Label on Hover */}
                        {hoveredNode === node.id && (
                            <g>
                                <rect
                                    x={node.x - 60}
                                    y={node.y - node.radius - 40}
                                    width="120"
                                    height="30"
                                    rx="8"
                                    fill="#1F2937"
                                    opacity="0.9"
                                />
                                <text
                                    x={node.x}
                                    y={node.y - node.radius - 21}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="12"
                                    fontWeight="medium"
                                >
                                    {node.label}
                                </text>
                            </g>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}
