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

    render(graph, onNodeDoubleClick) {

        this.clear();
        const elements = [];

        // ČVOROVI

        graph.nodes.forEach(node => {
            elements.push({
                data: {
                    id: node.id,
                    name: node.name,
                    type: node.type || ''
                }
            });
        });

        // VEZE

        graph.edges.forEach(edge => {
            elements.push({
                data: {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
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
                        'label': 'data(name)',
                        'color': '#222',
                        'font-size': '12px',
                        'text-valign': 'center',
                        'text-halign': 'right',
                        'text-margin-x': 8,
                        'width': 18,
                        'height': 18
                    }
                },

                {
                    selector: 'edge',

                    style: {
                        'width': 1.5,
                        'line-color': '#999',
                        'target-arrow-color': '#999',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                }

            ],

            layout: {
                name: 'cose',
                animate: true,
                fit: true,
                padding: 40
            },

            minZoom: 0.1,
            maxZoom: 5,

            wheelSensitivity: 0.2

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

        svg += `
    </svg>
    `;

        return svg;
    }

    clear() {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.container.innerHTML = '';
    }
}