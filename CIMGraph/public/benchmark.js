import { D3Graph } from './d3Graph.js';
import { CytoscapeGraph } from './cytoscapeGraph.js';
import { SigmaGraph } from './sigmaGraph.js';
import { G6Graph } from './g6Graph.js';

const classSelect = document.getElementById('classSelect');
const resultCountInput = document.getElementById('resultCount');
const repeatCountInput = document.getElementById('repeatCount');
const startButton = document.getElementById('startBenchmark');
const statusElement = document.getElementById('benchmarkStatus');
const nodeCountElement = document.getElementById('nodeCount');
const edgeCountElement = document.getElementById('edgeCount');
const resultsElement = document.getElementById('benchmarkResults');

const renderers = [
    {
        name: 'D3.js',
        containerId: 'd3BenchmarkContainer',
        create: container => new D3Graph(container)
    },
    {
        name: 'Cytoscape.js',
        containerId: 'cytoscapeBenchmarkContainer',
        create: container => new CytoscapeGraph(container)
    },
    {
        name: 'Sigma.js',
        containerId: 'sigmaBenchmarkContainer',
        create: container => new SigmaGraph(container)
    },
    {
        name: 'G6',
        containerId: 'g6BenchmarkContainer',
        create: container => new G6Graph(container)
    }
];

let classes = [];
let benchmarkResults = []; 
let currentGraph = null;

async function loadClasses() {
    try {

        const response = await fetch('/api/classes');

        if (!response.ok) {
            throw new Error('Greška prilikom učitavanja klasa.');
        }

        classes = await response.json();
        classSelect.innerHTML = '';

        classes.forEach(item => {

            const option = document.createElement('option');

            option.value = item.uri;
            option.textContent = item.name;

            classSelect.appendChild(option);
        });

    }
    catch (error) {
        console.error(error);
        classSelect.innerHTML = '<option value="">Greška</option>';
        statusElement.textContent =  error.message;
    }
}

async function loadGraph(classUri, limit = null) {

    let url = `/api/graph?type=instances&class=${encodeURIComponent(classUri)}`;

    if (limit !== null) {
        url += `&limit=${limit}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Greška prilikom učitavanja grafa.');
    }

    return await response.json();
}

function clearRenderer(renderer) {

    try {
        renderer.clear();
    }
    catch (error) { console.warn('Greška prilikom čišćenja:', error); }
}

async function measureRenderer(rendererDefinition, graph) {

    const container = document.getElementById(rendererDefinition.containerId);
    container.innerHTML = '';

    const renderer = rendererDefinition.create(container);
    const result = await renderer.renderForBenchmark(graph);

    clearRenderer(renderer);

    return result;

}

async function benchmarkLibrary(rendererDefinition, graph, repetitions) {

    const measurements = [];

    for (let i = 0; i < repetitions; i++) {

        statusElement.textContent = `${rendererDefinition.name}: ` + `ponavljanje ${i + 1}/${repetitions}`;

        await new Promise(resolve => setTimeout(resolve, 50));

        const measurement = await measureRenderer(rendererDefinition, graph);
        measurements.push(measurement);
    }

    const averageRender = measurements.reduce((sum, measurement) => sum + measurement.renderTime, 0) / measurements.length;
    const averageLayout = measurements.reduce((sum, measurement) => sum + measurement.layoutTime, 0) / measurements.length;
    const averageTotal = measurements.reduce((sum, measurement) => sum + measurement.totalTime, 0) / measurements.length;
    const minimumTotal = Math.min(...measurements.map(measurement => measurement.totalTime));
    const maximumTotal = Math.max(...measurements.map(measurement => measurement.totalTime));

    return {
        name: rendererDefinition.name,
        measurements,
        averageRender,
        averageLayout,
        averageTotal,
        minimumTotal,
        maximumTotal
    };
}

function addResultRow(result, graph) {

    const row = document.createElement('tr');

    row.innerHTML = `
        <td>${result.name}</td>
        <td>${graph.nodes.length}</td>
        <td>${graph.edges.length}</td>

        <td>${(result.averageRender / 1000).toFixed(3)}</td>
        <td>${(result.averageLayout / 1000).toFixed(3)}</td>
        <td>${(result.averageTotal / 1000).toFixed(3)}</td>
    `;

    resultsElement.appendChild(row);
}


function addBenchmarkResult(result) {

    benchmarkResults.push({
        timestamp: new Date().toISOString(),
        library: result.library,
        className: result.className,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        repetitions: result.repetitions,
        averageRenderMs: result.averageRender,
        averageLayoutMs: result.averageLayout,
        averageTotalMs: result.averageTotal,
        minTotalMs: result.minimumTotal,
        maxTotalMs: result.maximumTotal
    });

    document.getElementById('downloadCSV').disabled = false;
}

function exportCSV() {

    if (benchmarkResults.length === 0) {
        alert('Nema rezultata za čuvanje.');
        return;
    }

    const headers = [
        'Timestamp',
        'Library',
        'CIM Class',
        'Nodes',
        'Edges',
        'Repetitions',
        'Average Render (s)',
        'Average Layout (s)',
        'Average Total (s)',
        'Min Total (s)',
        'Max Total (s)'
    ];

    const rows = benchmarkResults.map(result => [

        result.timestamp,
        result.library,
        result.className,
        result.nodeCount,
        result.edgeCount,
        result.repetitions,
        (result.averageRenderMs / 1000).toFixed(3),
        (result.averageLayoutMs / 1000).toFixed(3),
        (result.averageTotalMs / 1000).toFixed(3),
        (result.minTotalMs / 1000).toFixed(3),
        (result.maxTotalMs / 1000).toFixed(3)

    ]);

    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(
        ['\ufeff' + csv],
        {
            type: 'text/csv;charset=utf-8;'
        }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `graph-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
async function runBenchmark() {

    const classUri = classSelect.value;
    const requestedNodes = Number(resultCountInput.value);
    const repetitions = Number(repeatCountInput.value);

    if (!classUri) {
        alert('Izaberi CIM klasu.');

        return;
    }

    if (!Number.isInteger(requestedNodes) || requestedNodes < 1) {
        alert('Broj RDF rezultata mora biti pozitivan cijeli broj.');

        return;
    }

    if (!Number.isInteger(repetitions) || repetitions < 1) {
        alert('Broj ponavljanja mora biti pozitivan cijeli broj.');

        return;
    }

    startButton.disabled = true;
    resultsElement.innerHTML = '';

    nodeCountElement.textContent = '-';
    edgeCountElement.textContent = '-';

    try {
        statusElement.textContent = 'Učitavanje stvarnog RealGrid grafa...';

        currentGraph = await loadGraph(classUri, requestedNodes);

        nodeCountElement.textContent = currentGraph.nodes.length;
        edgeCountElement.textContent = currentGraph.edges.length;

        if (currentGraph.nodes.length < requestedNodes) {

            statusElement.textContent = `RealGrid graf sadrži samo ` + `${currentGraph.nodes.length} ` +
                `čvorova za izabranu klasu. Benchmark će koristiti taj broj.`;
        }

        for (const renderer of renderers) {

            const result = await benchmarkLibrary(renderer, currentGraph, repetitions);

            addResultRow(result, currentGraph);
        }

        statusElement.textContent = 'Benchmark je završen.';
    }
    catch (error) {

        console.error(error);
        statusElement.textContent = `Greška: ${error.message}`;
    }
    finally {
        startButton.disabled = false;
    }
}

async function runAutomaticBenchmark() {

    const classUri = classSelect.value;
    const repetitions = Number(repeatCountInput.value);
    const automaticSizes = [
        100,
        500,
        1000,
        2000,
        5000
    ];

    if (!classUri) {
        alert('Izaberi CIM klasu.');

        return;
    }

    if (!Number.isInteger(repetitions) || repetitions < 1) {
        alert('Broj ponavljanja mora biti pozitivan cijeli broj.');
        return;
    }

    startButton.disabled = true;
    document.getElementById('autoBenchmark').disabled = true;
    resultsElement.innerHTML = '';
    benchmarkResults = [];

    nodeCountElement.textContent = '-';
    edgeCountElement.textContent = '-';

    try {

        for (const size of automaticSizes) {

            statusElement.textContent = `Učitavanje ${size} RDF rezultata...`;

            currentGraph = await loadGraph(classUri, size);

            if (!currentGraph.nodes || currentGraph.nodes.length === 0) {

                statusElement.textContent = `Nema RDF rezultata za ${size}. Automatski benchmark je završen.`;
                break;
            }

            nodeCountElement.textContent = currentGraph.nodes.length;
            edgeCountElement.textContent = currentGraph.edges.length;
            statusElement.textContent = `Benchmark za ${currentGraph.nodes.length} RDF rezultata...`;

            for (const renderer of renderers) {

                const result = await benchmarkLibrary(renderer, currentGraph, repetitions);

                addResultRow(result, currentGraph);
                addBenchmarkResult({
                    library: result.name,
                    className: classSelect.selectedOptions[0].textContent,
                    nodeCount: currentGraph.nodes.length,
                    edgeCount: currentGraph.edges.length,
                    repetitions,
                    averageRender: result.averageRender,
                    averageLayout: result.averageLayout,
                    averageTotal: result.averageTotal,
                    minimumTotal: result.minimumTotal,
                    maximumTotal: result.maximumTotal
                });
            }
        }

        statusElement.textContent = 'Automatski benchmark je završen.';

        exportCSV();
    }
    catch (error) {
        console.error(error);
        statusElement.textContent = `Greška: ${error.message}`;
    }
    finally {
        startButton.disabled = false;
        document.getElementById('autoBenchmark').disabled = false;
    }
}

    startButton.addEventListener('click', runBenchmark);
    document.getElementById('downloadCSV').addEventListener('click', exportCSV);
    document.getElementById('autoBenchmark').addEventListener('click', runAutomaticBenchmark);

    loadClasses();
