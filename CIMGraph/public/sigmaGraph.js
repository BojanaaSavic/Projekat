import Graph from 'https://esm.sh/graphology@0.25.4';
import Sigma from 'https://esm.sh/sigma@3.0.2';
import forceAtlas2 from 'https://esm.sh/graphology-layout-forceatlas2@0.10.1';

function escapeXml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export class SigmaGraph {
    constructor(container) {
        this.container = container;
        this.graph = null;
        this.renderer = null;
        this.draggedNode = null;
        this.isDragging = false;
    }

    render(graph, onNodeDoubleClick) {

        this.clear();
        this.graph = new Graph();

        graph.nodes.forEach(node => {
            this.graph.addNode(
                node.id,
                {
                    label: node.name || node.id,
                    size: 8,
                    color: '#4f81bd',
                    type: 'circle',
                    cimType: node.type || ''
                }
            );
        });

        graph.edges.forEach(edge => {

            if (!this.graph.hasNode(edge.source) || !this.graph.hasNode(edge.target)) {
                return;
            }

            if (this.graph.hasEdge(edge.source, edge.target)) {
                return;
            }

            this.graph.addEdge(edge.source, edge.target,
                {
                    label: edge.propertyName || '',
                    size: 1,
                    color: '#999'
                }
            );
        });

        this.graph.forEachNode(node => {
            this.graph.setNodeAttribute(node, 'x', Math.random());
            this.graph.setNodeAttribute(node, 'y', Math.random());
        });

        forceAtlas2.assign(this.graph,
            {
                iterations: 100,
                settings: {
                    gravity: 1,
                    scalingRatio: 10,
                    strongGravityMode: true,
                    slowDown: 1,
                    barnesHutOptimize: true
                }
            }
        );

        this.renderer = new Sigma(this.graph, this.container,
            {
                settings: {
                    autoRescale: 'once',
                    minCameraRatio: 0.1,
                    maxCameraRatio: 5,
                    renderLabels: true,
                    labelFont: 'Arial',
                    labelSize: 12,
                    defaultNodeColor: '#4f81bd',
                    defaultEdgeColor: '#999'
                }
            }
        );

        // DRAG POJEDINAČNOG ČVORA

        this.renderer.on('downNode',
            ({ node }) => {

                this.draggedNode = node;
                this.isDragging = true;
                this.renderer.getCamera().disable();
            }
        );

        this.renderer.getMouseCaptor().on('mousemovebody', event => {
                if (!this.isDragging || !this.draggedNode) {
                    return;
                }

                const position = this.renderer.viewportToGraph(event);

                this.graph.setNodeAttribute(this.draggedNode, 'x', position.x);
                this.graph.setNodeAttribute(this.draggedNode, 'y', position.y);
                this.renderer.refresh();
            }
        );

        this.renderer.getMouseCaptor().on('mouseup', () => {
            this.isDragging = false;
            this.draggedNode = null;
            this.renderer.getCamera().enable();
            }
        );

        // DVOKLIK NA ČVOR

        this.renderer.on('doubleClickNode', ({ node }) => {

            const name = this.graph.getNodeAttribute(node, 'label');
            const type = this.graph.getNodeAttribute(node, 'cimType');

            if (onNodeDoubleClick) {

                onNodeDoubleClick({
                    id: node,
                    name: name,
                    type: type
                });
            }
        });

        this.renderer.on('enterNode', ({ node }) => {
                const name = this.graph.getNodeAttribute(node, 'label');
                const type = this.graph.getNodeAttribute(node, 'cimType');

                this.container.title = type ? `${name}\nTip: ${type}` : name;
            }
        );

        this.renderer.on('leaveNode', () => { this.container.title = ''; });
    }

    async exportPNG() {

        if (!this.renderer) {
            throw new Error('Sigma graf nije iscrtan.');
        }

        const canvases = this.renderer.getCanvases();

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);

        Object.values(canvases).forEach(layer => {

            if (!layer) {
                return;
            }

            context.drawImage(
                layer,
                0,
                0,
                width,
                height
            );
        });

        return await new Promise(resolve => {

            canvas.toBlob(resolve, 'image/png');

        });
    }

    async exportSVG() {

        if (!this.renderer || !this.graph) {
            throw new Error('Sigma graf nije iscrtan.');
        }

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const nodes = [];
        const nodePositions = {};

        this.graph.forEachNode((node, attributes) => {

            const display =
                this.renderer.getNodeDisplayData(node);

            if (!display) {
                return;
            }

            const position =
                this.renderer.graphToViewport({
                    x: attributes.x,
                    y: attributes.y
                });

            nodePositions[node] = position;

            nodes.push({
                id: node,
                name: attributes.label || node,
                x: position.x,
                y: position.y,
                size: display.size || 8,
                color: display.color || '#4f81bd'
            });
        });

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

        this.graph.forEachEdge(
            (edge, attributes, source, target) => {

                const sourcePosition =
                    nodePositions[source];

                const targetPosition =
                    nodePositions[target];

                if (!sourcePosition || !targetPosition) {
                    return;
                }

                svg += `
        <line
            x1="${sourcePosition.x}"
            y1="${sourcePosition.y}"
            x2="${targetPosition.x}"
            y2="${targetPosition.y}"
            stroke="#999"
            stroke-width="1"
        />
    `;
            }
        );

        // ČVOROVI

        nodes.forEach(node => {

            const name = escapeXml(node.name);

            svg += `
        <circle
            cx="${node.x}"
            cy="${node.y}"
            r="${node.size}"
            fill="${node.color}"
        />

        <text
            x="${node.x + node.size + 5}"
            y="${node.y + 4}"
            font-family="Arial"
            font-size="12"
            fill="#222"
        >${name}</text>
    `;
        });

        svg += `
    </svg>
    `;

        return svg;
    }

    clear() {
        if (this.renderer) {
            this.renderer.kill();
            this.renderer = null;
        }

        this.graph = null;
        this.draggedNode = null;
        this.isDragging = false;
        this.container.innerHTML = '';
    }
}
