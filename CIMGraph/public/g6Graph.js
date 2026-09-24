function escapeXml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export class G6Graph {
    constructor(container) {
        this.container = container;
        this.graph = null;
    }

    getNodeId(value) {
        if (typeof value === 'object' && value !== null) {
            return value.id;
        }
        return value;
    }

    async createBenchmarkData(graph) {
        const includeMetadata = graph.nodes.length <= 1000;
        const nodes = [];
        const edges = [];
        const batchSize = 500;

        for (let start = 0; start < graph.nodes.length; start += batchSize) {
            const end = Math.min(start + batchSize, graph.nodes.length);

            for (let index = start; index < end; index++) {
                const node = graph.nodes[index];
                nodes.push({
                    id: node.id,
                    ...(includeMetadata ? {
                        data: {
                            name: node.name,
                            type: node.type || ''
                        }
                    } : {})
                });
            }

            await new Promise(requestAnimationFrame);
        }

        for (let start = 0; start < graph.edges.length; start += batchSize) {
            const end = Math.min(start + batchSize, graph.edges.length);

            for (let index = start; index < end; index++) {
                const edge = graph.edges[index];
                edges.push({
                    id: edge.id,
                    source: this.getNodeId(edge.source),
                    target: this.getNodeId(edge.target)
                });
            }

            await new Promise(requestAnimationFrame);
        }

        return { nodes, edges };
    }

    getNodeStyle(nodeCount) {
        const showLabels = nodeCount <= 1000;

        return {
            type: 'circle',
            style: {
                size: 18,
                fill: '#4f81bd',
                stroke: '#2f5597',
                lineWidth: 1,
                ...(showLabels ? {
                    labelText: node => node.data.name,
                    labelFill: '#222',
                    labelFontSize: 12,
                    labelPlacement: 'right',
                    labelOffsetX: 8
                } : {})
            }
        };
    }

    getEdgeStyle(nodeCount) {
        return {
            type: 'line',
            style: {
                stroke: '#999',
                lineWidth: nodeCount > 2000 ? 1 : 1.5,
                endArrow: nodeCount <= 2000,
                labelText: edge => edge.data?.showLabel ? edge.data?.propertyName || '' : '',
                labelFill: '#555',
                labelFontSize: 11,
                labelOffsetY: -8,
                labelBackgroundFill: '#fff',
                labelBackgroundOpacity: 0.8
            }
        };
    }

    getLayout(nodeCount) {
        return {
            type: 'force-atlas2',
            preventOverlap: nodeCount <= 1000,
            nodeSize: 18,
            nodeSpacing: nodeCount > 1000 ? 8 : 30,
            kr: nodeCount > 1000 ? 8 : 20,
            kg: 1,
            maxIteration: nodeCount > 2000 ? 80 : nodeCount > 1000 ? 150 : 500,
            mode: 'linlog',
            barnesHut: true
        };
    }

    async render(graph, onNodeDoubleClick, onEdgeDoubleClick) {

        await this.clear();

        const width = this.container.clientWidth || 1000;
        const height = 650;
        const fixedPositions = graph.fixedPositions || {};
        const isLargeGraph = graph.nodes.length > 1000;

        const nodeById = new Map(
            graph.nodes.map(node => [node.id, node])
        );
        const data = {
            nodes: graph.nodes.map(node => {

                const position = fixedPositions[node.id];

                return {
                    id: node.id,
                    data: {
                        name: node.name,
                        type: node.type || ''
                    },
                    ...(position ? { style: { x: position.x, y: position.y } } : {})
                };
            }),
            edges: graph.edges.map(edge => {

                const sourceId = this.getNodeId(edge.source);
                const targetId = this.getNodeId(edge.target);

                const targetNode = nodeById.get(targetId);
                return {
                    id: edge.id,
                    source: sourceId,
                    target: targetId,
                    data: {
                        propertyName: edge.propertyName || '',
                        lineSegmentCount: edge.lineSegmentCount || 0,
                        showLabel: !isLargeGraph && targetNode?.type === 'ACLineSegment'
                    }
                };
            })
        };

        this.graph = new G6.Graph({

            container: this.container,
            width: width,
            height: height,
            autoFit: 'view',
            data: data,
            node: this.getNodeStyle(graph.nodes.length),
            edge: this.getEdgeStyle(graph.nodes.length),
            layout: this.getLayout(graph.nodes.length),
            behaviors: [

                'drag-element',
                'zoom-canvas',
                'drag-canvas'
            ],
            plugins: [
                {
                    type: 'tooltip',
                    getContent: (event, items) => {
                        const item = items[0];

                        if (event.targetType === 'edge') {
                            const count = item.data?.lineSegmentCount || 0;
                            return `${count} ACLineSegment${count === 1 ? '' : '-a'}`;
                        }

                        if (event.targetType === 'node') {
                            return item.data?.type || '';
                        }
                        return '';
                    }
                }
            ]
        });

        // DVOKLIK 

        this.graph.on('node:dblclick', event => {

            if (!onNodeDoubleClick) {
                return;
            }

            const nodeData = this.graph.getNodeData(event.target.id);

            if (!nodeData) {
                return;
            }

            onNodeDoubleClick({
                id: nodeData.id,
                name: nodeData.data?.name,
                type: nodeData.data?.type
            });
        });

        this.graph.on('edge:dblclick', event => {

            if (!onEdgeDoubleClick) {
                return;
            }

            const edgeData = this.graph.getEdgeData(event.target.id);

            if (!edgeData) {
                return;
            }

            onEdgeDoubleClick({
                id: edgeData.id,
                source: edgeData.source,
                target: edgeData.target
            });
        });

        await this.graph.render();
    }

    async exportPNG() {

        if (!this.graph) {
            throw new Error('G6 graf nije iscrtan.');
        }

        const dataURL = await this.graph.toDataURL({
            mode: 'overall',
            type: 'image/png'
        });

        const response = await fetch(dataURL);

        return await response.blob();
    }

    async exportSVG() {

        if (!this.graph) {
            throw new Error('G6 graf nije iscrtan.');
        }

        const nodes = this.graph.getNodeData();
        const edges = this.graph.getEdgeData();
        const padding = 50;
        const positions = {};

        nodes.forEach(node => {
            const [x, y] = this.graph.getElementPosition(node.id);

            positions[node.id] = { x, y };
        });

        const values = Object.values(positions);

        const minX = Math.min(...values.map(p => p.x));
        const maxX = Math.max(...values.map(p => p.x));
        const minY = Math.min(...values.map(p => p.y));
        const maxY = Math.max(...values.map(p => p.y));

        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const offsetX = padding - minX;
        const offsetY = padding - minY;

        let svg = `
            <svg xmlns="http://www.w3.org/2000/svg"
                width="${width}"
                height="${height}"
                viewBox="0 0 ${width} ${height}">

            <rect
                width="100%"
                height="100%"
                fill="white"
            />
        `;

        // VEZE

        edges.forEach(edge => {

            const source = positions[edge.source];
            const target = positions[edge.target];

            if (!source || !target) {
                return;
            }

            svg += `
                <line
                    x1="${source.x + offsetX}"
                    y1="${source.y + offsetY}"
                    x2="${target.x + offsetX}"
                    y2="${target.y + offsetY}"
                    stroke="#999"
                    stroke-width="1.5"
                />
            `;
        });

        // ČVOROVI

        nodes.forEach(node => {

            const position = positions[node.id];

            if (!position) {
                return;
            }

            const x = position.x + offsetX;
            const y = position.y + offsetY;
            const name = escapeXml(node.data?.name || node.id);

            svg += `
                <circle
                    cx="${x}"
                    cy="${y}"
                    r="9"
                    fill="#4f81bd"
                    stroke="#2f5597"
                    stroke-width="1"
                />

                <text
                    x="${x + 13}"
                    y="${y + 4}"
                    font-family="Arial"
                    font-size="12"
                    fill="#222"
                >${name}</text>
            `;
        });

        svg += `</svg>`;

        return svg;
    }

    async renderForBenchmark(graph) {

        await this.clear();

        const width = this.container.clientWidth || 1000;
        const height = 650;
        const data = await this.createBenchmarkData(graph);

        const totalStart = performance.now();
        const renderStart = performance.now();
        this.graph = new G6.Graph({
                container: this.container,
                width,
                height,
                autoFit: 'view',
                data,
                node: this.getNodeStyle(graph.nodes.length),
                edge: {
                    type: 'line',
                    style: {
                        stroke: '#999',
                        lineWidth: graph.nodes.length > 2000 ? 1 : 1.5,
                        endArrow: graph.nodes.length <= 2000
                    }
                },
                layout: this.getLayout(graph.nodes.length)
            });

        const renderEnd = performance.now();
        const layoutStart = performance.now();

        await this.graph.render();

        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        const layoutEnd = performance.now();

        const positions = this.graph.getNodeData().map(node => {

            const [x, y] = this.graph.getElementPosition(node.id);

            return {
                nodeId: node.id,
                nodeName: node.data?.name || node.id,
                x,
                y
            };

        });

        return {
            layoutTime: layoutEnd - layoutStart,
            renderTime: renderEnd - renderStart,
            totalTime: layoutEnd - totalStart,
            positions: positions
        };
    }

    async clear() {
        if (this.graph) {
            const graph = this.graph;
            this.graph = null;

            await graph.clear();
        }

        this.container.innerHTML = '';
    }
}