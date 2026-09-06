const d3 = window.d3;

if (!d3) {
    throw new Error(
        'D3.js nije učitan. Provjeri benchmark.html.'
    );
}

export class D3Graph {

    constructor(container) {

        this.container = container;

        this.svg = null;
        this.simulation = null;

        this.width = 0;
        this.height = 0;
    }


    render(graph, onNodeDoubleClick) {

        this.clear();

        this.width = this.container.clientWidth || 1000;
        this.height = 650;

        this.svg = d3
            .select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        const zoomLayer = this.svg.append('g').attr('class', 'zoom-layer');

        this.svg.call(
            d3.zoom().scaleExtent([0.1, 5]).on('zoom', event => {
                    zoomLayer.attr(
                        'transform',
                        event.transform
                    );
                })
        );

        const linksLayer = zoomLayer.append('g').attr('class', 'links');
        const nodesLayer = zoomLayer.append('g').attr('class', 'nodes');
        const link = linksLayer.selectAll('g').data(graph.edges).enter().append('g').attr('class', 'graph-edge');

        link.append('line')
            .attr('class', 'graph-link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1.5);
        link.append('text').attr('class', 'edge-label').text(d => d.propertyName || '');

        const node = nodesLayer.selectAll('g').data(graph.nodes).enter().append('g').attr('class', 'graph-node');

        node.append('circle').attr('r', 9);
        node.append('text').text(d => d.name).attr('dx', 13).attr('dy', 4);
        node.append('title').text(d => {
                if (d.type) {
                    return `${d.name}\nTip: ${d.type}`;
                }

                return d.name;
            });
        node.on('dblclick', (event, d) => {
                if (onNodeDoubleClick) {
                    onNodeDoubleClick(d);
                }
            });
        node.call(
            d3.drag().on('start', (event, d) => {
                    if (!event.active) {
                        this.simulation.alphaTarget(0.3).restart();
                    }

                    d.fx = d.x;
                    d.fy = d.y;
                }).on('drag', (event, d) => {

                    d.fx = event.x;
                    d.fy = event.y;
                }).on('end', (event, d) => {

                    if (!event.active) {
                        this.simulation.alphaTarget(0);
                    }

                    d.fx = null;
                    d.fy = null;
                })
        );

        this.simulation = d3.forceSimulation(graph.nodes).force('link', d3.forceLink(graph.edges).id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(25));

        this.simulation.on('tick', () => {
            link.select('line').attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            link.select('text')
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    async exportSVG() {

        if (!this.svg) {
            throw new Error('D3 graf nije iscrtan.');
        }

        const svgElement = this.svg.node();
        const clone = svgElement.cloneNode(true);

        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        return new XMLSerializer().serializeToString(clone);
    }


    async exportPNG() {

        const svg = await this.exportSVG();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' } );
        const url = URL.createObjectURL(blob);

        try {

            const image = new Image();
            image.src = url;

            await new Promise((resolve, reject) => {

                image.onload = resolve;
                image.onerror = reject;
            });

            const canvas = document.createElement('canvas');

            canvas.width = this.width;
            canvas.height = this.height;

            const context = canvas.getContext('2d');

            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            return await new Promise(resolve => { canvas.toBlob(resolve, 'image/png'); });

        }
        finally {
            URL.revokeObjectURL(url);
        }
    }

    async renderForBenchmark(graph) {

        this.clear();
        this.width = this.container.clientWidth || 1000;
        this.height = 650;

        const renderStart = performance.now();

        this.svg = d3
            .select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        const zoomLayer = this.svg.append('g').attr('class', 'zoom-layer');
        const linksLayer = zoomLayer.append('g').attr('class', 'links');
        const nodesLayer = zoomLayer.append('g').attr('class', 'nodes');
        const link = linksLayer
                .selectAll('g')
                .data(graph.edges)
                .enter()
                .append('g');

        link.append('line');

        const node = nodesLayer
                .selectAll('g')
                .data(graph.nodes)
                .enter()
                .append('g');

        node.append('circle').attr('r', 9);
        node.append('text').text(d => d.name);

        const renderEnd = performance.now();
        const renderTime = renderEnd - renderStart;
        const layoutStart = performance.now();

        this.simulation = d3.forceSimulation(graph.nodes).force('link', d3.forceLink(graph.edges).id(d => d.id).distance(120))
                .force('charge', d3.forceManyBody().strength(-300))
                .force('center', d3.forceCenter(this.width / 2, this.height / 2))
                .force('collision', d3.forceCollide().radius(25));

        await new Promise(resolve => {
            this.simulation.on('end', resolve);
        });

        const layoutEnd = performance.now();

        return {
            layoutTime: layoutEnd - layoutStart,
            renderTime: renderTime,
            totalTime: layoutEnd - renderStart
        };
    }

    clear() {

        if (this.simulation) {

            this.simulation.stop();
            this.simulation = null;
        }

        if (this.svg) {

            this.svg.remove();
            this.svg = null;
        }

        this.container.innerHTML = '';
    }
}