import Graph from 'https://esm.sh/graphology@0.25.4';
import Sigma from 'https://esm.sh/sigma@3.0.2';
import forceAtlas2 from 'https://esm.sh/graphology-layout-forceatlas2@0.10.1';


export class SigmaGraph {
    constructor(container) {
        this.container = container;
        this.graph = null;
        this.renderer = null;
        this.draggedNode = null;
        this.isDragging = false;
    }

    render(graph) {

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

        this.renderer.on('enterNode', ({ node }) => {
                const name = this.graph.getNodeAttribute(node, 'label');
                const type = this.graph.getNodeAttribute(node, 'cimType');

                this.container.title = type ? `${name}\nTip: ${type}` : name;
            }
        );

        this.renderer.on('leaveNode', () => { this.container.title = ''; });
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
