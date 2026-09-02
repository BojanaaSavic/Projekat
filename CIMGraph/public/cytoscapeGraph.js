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

    clear() {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.container.innerHTML = '';
    }
}