export class G6Graph {
    constructor(container) {
        this.container = container;
        this.graph = null;
    }

    render(graph) {

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
                mode: 'linlog'
            },
            behaviors: [

                'drag-element',
                'zoom-canvas',
                'drag-canvas'
            ]
        });

        this.graph.render();
    }

    clear() {

        if (this.graph) {
            this.graph.destroy();
            this.graph = null;
        }
        this.container.innerHTML = '';
    }
}