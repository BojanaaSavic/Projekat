function escapeXml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export class CytoscapeGraph {
    constructor(container) {
        this.container = container;
        this.cy = null;
    }

    getInitialPosition(index, nodeCount, width, height) {
        const columns = Math.ceil(Math.sqrt(nodeCount));
        const spacing = Math.max(24, Math.min(width, height) / columns);

        return {
            x: (index % columns) * spacing + spacing / 2,
            y: Math.floor(index / columns) * spacing + spacing / 2
        };
    }

    async createBenchmarkElementsAsync(graph, width, height) {
        const isLargeGraph = graph.nodes.length > 1000;
        const elements = [];
        const batchSize = 500;

        for (let start = 0; start < graph.nodes.length; start += batchSize) {
            const end = Math.min(start + batchSize, graph.nodes.length);

            for (let index = start; index < end; index++) {
                const node = graph.nodes[index];
                elements.push({
                    data: {
                        id: node.id,
                        ...(isLargeGraph ? {} : {
                            name: node.name,
                            type: node.type || ''
                        })
                    },
                    position: this.getInitialPosition(index, graph.nodes.length, width, height)
                });
            }

            await new Promise(requestAnimationFrame);
        }

        for (let start = 0; start < graph.edges.length; start += batchSize) {
            const end = Math.min(start + batchSize, graph.edges.length);

            for (let index = start; index < end; index++) {
                const edge = graph.edges[index];
                const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

                elements.push({
                    data: {
                        id: edge.id,
                        source: sourceId,
                        target: targetId
                    }
                });
            }

            await new Promise(requestAnimationFrame);
        }

        return elements;
    }

    getBenchmarkStyle(nodeCount) {
        const isLargeGraph = nodeCount > 1000;

        return [
            {
                selector: 'node',
                style: {
                    'background-color': '#4f81bd',
                    'width': 14,
                    'height': 14,
                    ...(isLargeGraph ? {} : {
                        'label': 'data(name)',
                        'color': '#222',
                        'font-size': '12px'
                    })
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1,
                    'line-color': '#999',
                    'curve-style': 'straight'
                }
            }
        ];
    }

    getBenchmarkLayout(nodeCount) {
        return {
            name: 'cose',
            animate: false,
            randomize: false,
            fit: true,
            padding: 40,
            numIter: nodeCount > 5000 ? 25 : nodeCount > 1000 ? 50 : 250,
            idealEdgeLength: nodeCount > 1000 ? 30 : 50,
            nodeRepulsion: nodeCount > 1000 ? 1000 : 4500,
            edgeElasticity: 0.45,
            gravity: 0.25,
            refresh: 0
        };
    }

    render(graph, onNodeDoubleClick) {

        this.clear();
        const elements = [];

        // ČVOROVI

        graph.nodes.forEach(node => {

            const position = graph.fixedPositions?.[node.id];

            elements.push({
                data: {
                    id: node.id,
                    name: node.name,
                    type: node.type || ''
                },
                ...(position ? { position } : {})
            });
        });

        // VEZE

        graph.edges.forEach(edge => {

            const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

            elements.push({
                data: {
                    id: edge.id,
                    source: sourceId,
                    target: targetId,
                    property: edge.property,
                    propertyName: edge.propertyName || ''
                }
            });
        });

        this.cy = cytoscape({
            
            container: this.container,
            elements: elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#4f81bd',
                        'width': 10,
                        'height': 10,
                        'label': 'data(name)',
                        'color': '#222',
                        'font-size': '10px',
                        'text-valign': 'center',
                        'text-halign': 'right',
                        'text-margin-x': 6
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1,
                        'line-color': '#999',
                        'curve-style': 'straight'
                    }
                }
            ],

            layout: {
                name: 'cose',
                animate: false,
                fit: true,
                padding: 40,
                numIter: 100,
                idealEdgeLength: 30,
                nodeRepulsion: 500,
                edgeElasticity: 0.45,
                gravity: 0.25
            },

            minZoom: 0.1,
            maxZoom: 5,

            wheelSensitivity: 0.2

        });

        Object.keys(graph.fixedPositions || {}).forEach(id => {

            const node = this.cy.getElementById(id);

            if (node.length) {
                node.position(graph.fixedPositions[id]);
                node.lock();
            }
        });

        // PRIKAZ TIPA ČVORA KADA SE PREĐE MIŠEM

        this.cy.nodes().forEach(node => {

            node.on('mouseover', () => {
                const name = node.data('name');
                const type = node.data('type');

                node.data('tooltip', type ? `${name}\nTip: ${type}` : name);
            });
        });

        // DVOKLIK NA ČVOR

        this.cy.nodes().forEach(node => {

            node.on('dblclick', () => {
                if (onNodeDoubleClick) {
                    onNodeDoubleClick({
                        id: node.id(),
                        name: node.data('name'),
                        type: node.data('type')
                    });
                }
            });
        });
    }

    async exportPNG() {

        if (!this.cy) {
            throw new Error('Cytoscape graf nije iscrtan.');
        }

        return await this.cy.png({
            output: 'blob',
            bg: '#ffffff',
            full: true,
            scale: 2
        });
    }

    async exportSVG() {

        if (!this.cy) {
            throw new Error('Cytoscape graf nije iscrtan.');
        }

        const nodes = this.cy.nodes();
        const edges = this.cy.edges();
        const padding = 50;
        const box = nodes.boundingBox();
        const width = box.w + padding * 2;
        const height = box.h + padding * 2;
        const offsetX = padding - box.x1;
        const offsetY = padding - box.y1;

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

            const source = edge.source().position();
            const target = edge.target().position();

            const x1 = source.x + offsetX;
            const y1 = source.y + offsetY;

            const x2 = target.x + offsetX;
            const y2 = target.y + offsetY;

            svg += `
                <line
                    x1="${x1}"
                    y1="${y1}"
                    x2="${x2}"
                    y2="${y2}"
                    stroke="#999"
                    stroke-width="1.5"
                />
            `;
        });

        // ČVOROVI

        nodes.forEach(node => {

            const position = node.position();

            const x = position.x + offsetX;
            const y = position.y + offsetY;

            const name = escapeXml(node.data('name') || node.id());

            svg += `
                <circle
                    cx="${x}"
                    cy="${y}"
                    r="9"
                    fill="#4f81bd"
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

        this.clear();

        const totalStart = performance.now();
        const renderStart = performance.now();
        const isLargeGraph = graph.nodes.length > 1000;

        this.cy = cytoscape({

            container: this.container,
            elements: await this.createBenchmarkElementsAsync(graph, this.container.clientWidth || 1000, 650),
            style: this.getBenchmarkStyle(graph.nodes.length),

            minZoom: 0.1,
            maxZoom: 5,
            hideEdgesOnViewport: isLargeGraph,
            textureOnViewport: isLargeGraph,
            motionBlur: false,
            pixelRatio: 1
        });

        const renderEnd = performance.now();
        const layoutStart = performance.now();

        await new Promise(resolve => {

            const layout = this.cy.layout(this.getBenchmarkLayout(graph.nodes.length));
            layout.one('layoutstop', resolve);
            layout.run();
        });

        const layoutEnd = performance.now();

        return {
            layoutTime: layoutEnd - layoutStart,
            renderTime: renderEnd - renderStart,
            totalTime: layoutEnd - totalStart
        };
    }

    clear() {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.container.innerHTML = '';
    }
}