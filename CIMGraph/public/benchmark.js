const TESTS = [
    { nodes: 1000, edges: 2000 },
    { nodes: 5000, edges: 10000 },
    { nodes: 10000, edges: 20000 },
    { nodes: 25000, edges: 50000 },
    { nodes: 50000, edges: 100000 }
];

const REPEATS = 5;

const container = document.getElementById('benchmark-container');
const status = document.getElementById('status');
const tableBody = document.querySelector('#resultsTable tbody');
const runButton = document.getElementById('runBenchmark');
const csvButton = document.getElementById('downloadCsv');

let benchmarkResults = [];


/*
 * GENERISANJE TESTNOG GRAFA
 */

function generateGraph(nodeCount, edgeCount) {

    const nodes = Array.from(
        { length: nodeCount },
        (_, i) => ({
            id: `n${i}`,
            name: `Node ${i}`,
            type: 'BenchmarkNode'
        })
    );

    const edges = [];
    const used = new Set();


    // Osigurava da graf bude povezan

    for (
        let i = 0;
        i < nodeCount - 1 && edges.length < edgeCount;
        i++
    ) {

        const source = `n${i}`;
        const target = `n${i + 1}`;

        const id = `${source}|p|${target}`;

        used.add(id);

        edges.push({
            id,
            source,
            target,
            property: 'p',
            propertyName: 'relation'
        });
    }


    // Dodavanje preostalih veza

    let i = 0;

    while (edges.length < edgeCount) {

        const sourceIndex =
            (i * 37 + 11) % nodeCount;

        const targetIndex =
            (
                sourceIndex +
                1 +
                (
                    (i * 9973) %
                    Math.max(1, nodeCount - 1)
                )
            ) % nodeCount;


        if (sourceIndex !== targetIndex) {

            const source = `n${sourceIndex}`;
            const target = `n${targetIndex}`;

            const id = `${source}|p|${target}`;


            if (!used.has(id)) {

                used.add(id);

                edges.push({
                    id,
                    source,
                    target,
                    property: 'p',
                    propertyName: 'relation'
                });
            }
        }

        i++;
    }


    return {
        nodes,
        edges
    };
}


/*
 * D3.JS
 */

async function benchmarkD3(graph) {

    clearContainer();

    const width =
        container.clientWidth || 1000;

    const height = 650;


    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);


    const links = svg
        .append('g')
        .selectAll('line')
        .data(graph.edges)
        .enter()
        .append('line');


    const nodes = svg
        .append('g')
        .selectAll('circle')
        .data(graph.nodes)
        .enter()
        .append('circle')
        .attr('r', 4);


    const start = performance.now();


    const simulation = d3
        .forceSimulation(graph.nodes)

        .force(
            'link',
            d3.forceLink(graph.edges)
                .id(d => d.id)
                .distance(50)
        )

        .force(
            'charge',
            d3.forceManyBody()
                .strength(-30)
        )

        .force(
            'center',
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )

        .force(
            'collision',
            d3.forceCollide()
                .radius(5)
        )

        .stop();


    /*
     * LAYOUT
     */

    const layoutStart =
        performance.now();


    for (let i = 0; i < 100; i++) {

        simulation.tick();
    }


    const layoutEnd =
        performance.now();


    /*
     * RENDER
     */

    links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);


    nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);


    const renderEnd =
        performance.now();


    simulation.stop();


    return {

        layout:
            layoutEnd - layoutStart,

        render:
            renderEnd - layoutEnd,

        total:
            renderEnd - start
    };
}


/*
 * CYTOSCAPE.JS
 */

async function benchmarkCytoscape(graph) {

    clearContainer();


    const elements = [

        ...graph.nodes.map(node => ({

            data: {

                id: node.id,

                name: node.name,

                type: node.type
            }
        })),


        ...graph.edges.map(edge => ({

            data: {

                id: edge.id,

                source: edge.source,

                target: edge.target
            }
        }))
    ];


    const start =
        performance.now();


    const cy = cytoscape({

        container,

        elements,


        style: [

            {
                selector: 'node',

                style: {

                    'background-color':
                        '#4f81bd',

                    'width': 8,

                    'height': 8
                }
            },


            {
                selector: 'edge',

                style: {

                    'width': 1,

                    'line-color': '#999'
                }
            }
        ],


        layout: {

            name: 'cose',

            animate: false,

            fit: false,

            padding: 20
        }
    });


    const createEnd =
        performance.now();


    /*
     * LAYOUT
     */

    const layout =
        cy.layout({

            name: 'cose',

            animate: false,

            fit: false,

            padding: 20
        });


    const layoutStart =
        performance.now();


    layout.run();


    const layoutEnd =
        performance.now();


    /*
     * RENDER
     */

    cy.resize();


    const renderEnd =
        performance.now();


    cy.destroy();


    return {

        layout:
            layoutEnd - layoutStart,

        render:
            renderEnd - layoutEnd,

        total:
            renderEnd - start
    };
}


/*
 * SIGMA.JS
 *
 * Graphology + ForceAtlas2
 */

async function benchmarkSigma(graph) {

    clearContainer();


    const sigmaGraph =
        new Graph();


    const start =
        performance.now();


    /*
     * DODAVANJE ČVOROVA
     */

    graph.nodes.forEach(node => {

        sigmaGraph.addNode(

            node.id,

            {

                label: node.name,

                size: 5,

                color: '#4f81bd',

                type: 'circle'
            }
        );
    });


    /*
     * DODAVANJE VEZA
     */

    graph.edges.forEach(edge => {

        if (
            !sigmaGraph.hasNode(edge.source) ||
            !sigmaGraph.hasNode(edge.target)
        ) {

            return;
        }


        if (
            sigmaGraph.hasEdge(
                edge.source,
                edge.target
            )
        ) {

            return;
        }


        sigmaGraph.addEdge(

            edge.source,

            edge.target,

            {

                size: 1,

                color: '#999'
            }
        );
    });


    const createEnd =
        performance.now();


    /*
     * POČETNE KOORDINATE
     */

    sigmaGraph.forEachNode(node => {

        sigmaGraph.setNodeAttribute(
            node,
            'x',
            Math.random()
        );

        sigmaGraph.setNodeAttribute(
            node,
            'y',
            Math.random()
        );
    });


    /*
     * LAYOUT
     */

    const layoutStart =
        performance.now();


    forceAtlas2.assign(

        sigmaGraph,

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


    const layoutEnd =
        performance.now();


    /*
     * RENDER
     */

    const renderer = new Sigma(

        sigmaGraph,

        container,

        {

            settings: {

                autoRescale: 'once',

                renderLabels: false
            }
        }
    );


    renderer.refresh();


    const renderEnd =
        performance.now();


    renderer.kill();


    return {

        layout:
            layoutEnd - layoutStart,

        render:
            renderEnd - layoutEnd,

        total:
            renderEnd - start
    };
}


/*
 * G6
 *
 * ForceAtlas2
 */

async function benchmarkG6(graph) {

    clearContainer();


    const width =
        container.clientWidth || 1000;

    const height = 650;


    const data = {

        nodes: graph.nodes.map(node => ({

            id: node.id,

            data: {

                name: node.name,

                type: node.type
            }
        })),


        edges: graph.edges.map(edge => ({

            id: edge.id,

            source: edge.source,

            target: edge.target
        }))
    };


    const start =
        performance.now();


    const g =
        new G6.Graph({

            container,

            width,

            height,

            autoFit: 'view',

            data,


            node: {

                type: 'circle',

                style: {

                    size: 8
                }
            },


            edge: {

                type: 'line',

                style: {

                    lineWidth: 1
                }
            },


            layout: {

                type: 'force-atlas2',

                preventOverlap: true,

                nodeSize: 8,

                nodeSpacing: 10,

                kr: 20,

                kg: 1,

                maxIteration: 500,

                mode: 'linlog'
            }
        });


    const createEnd =
        performance.now();


    /*
     * RENDER + LAYOUT
     */

    g.render();


    await new Promise(
        resolve =>
            requestAnimationFrame(resolve)
    );


    const renderEnd =
        performance.now();


    g.destroy();


    return {

        /*
         * Kod G6 biblioteke layout i render
         * nisu potpuno odvojeni u ovoj implementaciji.
         */

        layout:
            renderEnd - createEnd,

        render: 0,

        total:
            renderEnd - start
    };
}


/*
 * POMOĆNE FUNKCIJE
 */

function clearContainer() {

    container.innerHTML = '';
}


function average(values) {

    return values.reduce(
        (sum, value) =>
            sum + value,
        0
    ) / values.length;
}


/*
 * POKRETANJE JEDNE BIBLIOTEKE
 */

async function runLibrary(
    name,
    graph,
    benchmarkFunction
) {


    /*
     * WARM-UP
     */

    try {

        await benchmarkFunction(graph);

    }
    catch (error) {

        console.error(
            `Warm-up greška (${name}):`,
            error
        );
    }


    const measurements = [];


    /*
     * PONAVLJANJA
     */

    for (
        let i = 0;
        i < REPEATS;
        i++
    ) {


        status.textContent =

            `${name}: ` +

            `${graph.nodes.length.toLocaleString()} ` +

            `čvorova, ` +

            `ponavljanje ` +

            `${i + 1}/${REPEATS}`;


        await new Promise(
            resolve =>
                requestAnimationFrame(resolve)
        );


        try {

            const result =
                await benchmarkFunction(graph);


            measurements.push(result);

        }
        catch (error) {

            console.error(
                `Greška (${name}):`,
                error
            );


            measurements.push({

                layout: NaN,

                render: NaN,

                total: NaN
            });
        }


        await new Promise(
            resolve =>
                requestAnimationFrame(resolve)
        );
    }


    return {

        nodes:
            graph.nodes.length,

        edges:
            graph.edges.length,

        library:
            name,


        layout:
            average(
                measurements.map(
                    result =>
                        result.layout
                )
            ),


        render:
            average(
                measurements.map(
                    result =>
                        result.render
                )
            ),


        total:
            average(
                measurements.map(
                    result =>
                        result.total
                )
            )
    };
}


/*
 * DODAVANJE REZULTATA U TABELU
 */

function addResultToTable(result) {

    const row =
        document.createElement('tr');


    const values = [

        result.nodes,

        result.edges,

        result.library,

        result.layout.toFixed(3),

        result.render.toFixed(3),

        result.total.toFixed(3)
    ];


    values.forEach(value => {

        const cell =
            document.createElement('td');

        cell.textContent = value;

        row.appendChild(cell);
    });


    tableBody.appendChild(row);
}


/*
 * FORMIRANJE CSV-a
 */

function resultsToCsv(results) {

    const header = [

        'nodes',

        'edges',

        'library',

        'layout_ms',

        'render_ms',

        'total_ms'
    ];


    const rows =
        results.map(result => [

            result.nodes,

            result.edges,

            result.library,

            result.layout.toFixed(3),

            result.render.toFixed(3),

            result.total.toFixed(3)
        ]);


    return [

        header.join(','),

        ...rows.map(
            row => row.join(',')
        )

    ].join('\n');
}


/*
 * GLAVNI BENCHMARK
 */

runButton.addEventListener(
    'click',
    async () => {


        runButton.disabled = true;

        csvButton.disabled = true;


        tableBody.innerHTML = '';

        benchmarkResults = [];


        try {


            /*
             * Svaki test koristi isti graf
             * za sve četiri biblioteke.
             */

            for (const test of TESTS) {


                status.textContent =

                    `Generisanje grafa: ` +

                    `${test.nodes.toLocaleString()} ` +

                    `čvorova / ` +

                    `${test.edges.toLocaleString()} ` +

                    `veza...`;


                const graph =
                    generateGraph(

                        test.nodes,

                        test.edges
                    );


                const libraries = [

                    [
                        'D3.js',

                        benchmarkD3
                    ],


                    [
                        'Cytoscape.js',

                        benchmarkCytoscape
                    ],


                    [
                        'Sigma.js',

                        benchmarkSigma
                    ],


                    [
                        'G6',

                        benchmarkG6
                    ]
                ];


                for (
                    const [
                        name,
                        benchmarkFunction
                    ]
                    of libraries
                ) {


                    const result =
                        await runLibrary(

                            name,

                            graph,

                            benchmarkFunction
                        );


                    benchmarkResults.push(
                        result
                    );


                    addResultToTable(
                        result
                    );
                }
            }


            status.textContent =
                'Benchmark završen.';


            csvButton.disabled = false;

        }


        catch (error) {

            console.error(error);


            status.textContent =

                `Benchmark nije uspješno završen: ` +

                error.message;
        }


        finally {

            runButton.disabled = false;

            clearContainer();
        }
    }
);


/*
 * PREUZIMANJE CSV REZULTATA
 */

csvButton.addEventListener(
    'click',
    () => {


        const csv =
            resultsToCsv(
                benchmarkResults
            );


        const blob =
            new Blob(

                ["\ufeff" + csv],

                {

                    type:
                        'text/csv;charset=utf-8;'
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement('a');


        link.href = url;


        link.download =
            'cim_graph_benchmark.csv';


        link.click();


        URL.revokeObjectURL(url);
    }
);