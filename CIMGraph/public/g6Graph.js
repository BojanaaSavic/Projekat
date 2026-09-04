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

    render(graph, onNodeDoubleClick) {

        this.clear();

        const width = this.container.clientWidth || 1000;
        const height = 650;

        const data = {
            nodes: graph.nodes.map(node => ({

                id: node.id,
                data: {
                    name: node.name,
                    type: node.type || ''
                }
            })),

            edges: graph.edges.map(edge => ({

                id: edge.id,
                source: edge.source,
                target: edge.target
            }))
        };

        this.graph = new G6.Graph({

            container: this.container,
            width: width,
            height: height,
            autoFit: 'view',
            data: data,
            node: {

                type: 'circle',
                style: {

                    size: 18,
                    fill: '#4f81bd',
                    stroke: '#2f5597',
                    lineWidth: 1,
                    labelText: node => node.data.name,
                    labelFill: '#222',
                    labelFontSize: 12,
                    labelPlacement: 'right',
                    labelOffsetX: 8
                }
            },
            edge: {

                type: 'line',
                style: {
                    stroke: '#999',
                    lineWidth: 1.5,
                    endArrow: true
                }
            },
            layout: {

                type: 'force-atlas2',
                preventOverlap: true,
                nodeSize: 18,
                nodeSpacing: 30,
                kr: 20,
                kg: 1,
                maxIteration: 500,
                mode: 'linlog',
                barnesHut: true
            },
            behaviors: [

                'drag-element',
                'zoom-canvas',
                'drag-canvas'
            ]
        });

        // DVOKLIK NA ČVOR

        this.graph.on('node:dblclick', event => {

            const node = event.item;

            if (!node || !onNodeDoubleClick) {
                return;
            }

            const nodeData = node.getData();

            onNodeDoubleClick({
                id: nodeData.id,
                name: nodeData.data.name,
                type: nodeData.data.type
            });
        });

        this.graph.render();
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

            const [x, y] =
                this.graph.getElementPosition(node.id);

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

            const name = escapeXml(
                node.data?.name || node.id
            );

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

        svg += `
    </svg>
    `;

        return svg;
    }

    clear() {

        if (this.graph) {
            this.graph.destroy();
            this.graph = null;
        }
        this.container.innerHTML = '';
    }
}