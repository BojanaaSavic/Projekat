import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { RdfStore } from './src/rdfStore.js';
import { SparqlService } from './src/sparqlService.js';
import { RdfsService } from './src/rdfsService.js';
import { GraphService } from './src/graphService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;


function getClassName(uri) {

    if (!uri) {
        return '';
    }

    const hashIndex = uri.lastIndexOf('#');

    if (hashIndex !== -1) {
        return uri.substring(hashIndex + 1);
    }

    const slashIndex = uri.lastIndexOf('/');

    if (slashIndex !== -1) {
        return uri.substring(slashIndex + 1);
    }

    return uri;
}


async function initialize() {

    console.log('==========================================');
    console.log('       CIM RDF WEB APPLICATION');
    console.log('==========================================');
    console.log();

    const rdfStore = new RdfStore();

    await rdfStore.loadTurtle('./data/FullGrid_EQ.ttl');

    console.log();
    console.log(`RDF model učitan.`);
    console.log(`Broj RDF trojki: ${rdfStore.getQuadCount()}`);

    const store = rdfStore.getStore();
    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const CIM = 'http://iec.ch/TC57/CIM100#';
    const subjects = new Set();

    for (const quad of store) {
        subjects.add(quad.subject.value);
    }

    const instanceCount = subjects.size;
    const substationCount = store.getQuads(null, RDF_TYPE, `${CIM}Substation`, null).length;

    console.log(`Broj instanci: ${instanceCount}`);
    console.log(`Broj Substation elemenata: ${substationCount}`);

    await rdfStore.loadRdfs('./data/CGMES_RDFS.ttl');

    console.log();
    console.log(`RDFS model učitan.`);
    console.log(`Ukupan broj trojki: ${rdfStore.getQuadCount()}`);

    const sparql = new SparqlService(store);

    const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX cim: <http://iec.ch/TC57/CIM100#>

        SELECT (COUNT(DISTINCT ?container) AS ?count)
        WHERE {
            ?container rdf:type ?class .
            ?class rdfs:subClassOf* cim:EquipmentContainer .
        }
    `;

    const result = await sparql.query(query);
    const containerCount = Number(result[0]?.get('count')?.value || 0);

    console.log(`Broj kontejnera: ${containerCount}`);
    const rdfs = new RdfsService(sparql);
    const graph = new GraphService(sparql);

    return { store, sparql, rdfs, graph };
}

const app = await initialize();

const server = http.createServer(async (request, response) => {
        try {

            if ( request.method === 'GET' && request.url === '/') {

                const htmlPath = path.join(__dirname, 'public', 'index.html');
                const html = await fs.readFile(htmlPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                response.end(html);

                return;
            }

            if (request.method === 'GET' && request.url === '/benchmark.html') {

                const htmlPath = path.join(__dirname, 'public', 'benchmark.html');
                const html = await fs.readFile(htmlPath, 'utf8');

                response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });

                response.end(html);

                return;
            }


            if (request.method === 'GET' && request.url === '/benchmark.js') {

                const jsPath = path.join(__dirname, 'public', 'benchmark.js');
                const js = await fs.readFile(jsPath, 'utf8');

                response.writeHead(200, {
                    'Content-Type': 'application/javascript; charset=utf-8'
                });

                response.end(js);

                return;
            }

            if (request.method === 'GET' && request.url === '/style.css') {

                const cssPath = path.join( __dirname, 'public', 'style.css');
                const css = await fs.readFile(cssPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8'});
                response.end(css);

                return;
            }

            if (request.method === 'GET' && request.url === '/d3Graph.js') {

                const jsPath = path.join(__dirname, 'public', 'd3Graph.js');
                const js = await fs.readFile(jsPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                response.end(js);

                return;
            }

            if (request.method === 'GET' && request.url === '/cytoscapeGraph.js') {

                const jsPath = path.join(__dirname, 'public', 'cytoscapeGraph.js');
                const js = await fs.readFile(jsPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                response.end(js);

                return;
            }

            if (request.method === 'GET' && request.url === '/sigmaGraph.js') {

                const jsPath = path.join(__dirname, 'public', 'sigmaGraph.js');
                const js = await fs.readFile(jsPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                response.end(js);

                return;
            }

            if (request.method === 'GET' && request.url === '/g6Graph.js') {

                const jsPath = path.join(__dirname, 'public', 'g6Graph.js');
                const js = await fs.readFile(jsPath, 'utf8');

                response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                response.end(js);

                return;
            }

            if (request.method === 'GET' && request.url === '/api/classes') {

                const results = await app.rdfs.getClasses();
                const classes =
                    results.map(binding => {

                        const uri = binding.get('class')?.value;
                        const label = binding.get('label')?.value;

                        return { uri, name: label || getClassName(uri) };
                    });

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(classes));

                return;
            }

            if (request.method === 'GET' && request.url === '/api/equipment-containers') {

                const results = await app.rdfs.getEquipmentContainerTypes();
                const containers = results.map(binding => {
                    const uri = binding.get('containerType')?.value;
                    const label = binding.get('label')?.value;

                    return { uri, name: label || getClassName(uri) };
                });

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(containers));

                return;
            }

            if (request.method === 'GET' && request.url.startsWith('/api/equipment-groups?')) {

                const url = new URL(request.url, `http://localhost:${PORT}`);
                const containerType = url.searchParams.get('containerType');

                if (!containerType) {

                    response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    response.end(JSON.stringify({ error: 'Tip EquipmentContainer-a je obavezan.' }));

                    return;
                }

                const results = await app.rdfs.getEquipmentGroups(containerType);

                const groups = results.map(binding => {

                    const uri = binding.get('group')?.value;
                    const name = binding.get('groupName')?.value;
                    const type = binding.get('groupType')?.value;
                    const count = binding.get('equipmentCount')?.value;

                    return { 
                        uri,
                        name: name || getClassName(uri),
                        type: type ? getClassName(type) : getClassName(containerType),
                        equipmentCount: count ? Number(count) : 0
                    };
                });

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(groups));

                return;
            }

            if (request.method === 'GET' && request.url.startsWith('/api/graph')) {

                const url = new URL(request.url, `http://localhost:${PORT}`);
                const type = url.searchParams.get('type');
                let graph;

                //GRAF INSTANCI

                if (type === 'instances') {

                    const classUri = url.searchParams.get('class');

                    if (!classUri) {

                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ error: 'Klasa je obavezna.' }));

                        return;
                    }

                    const limitParam = url.searchParams.get('limit');
                    const limit = limitParam ? parseInt(limitParam, 10) : null;

                    graph = await app.graph.getInstanceGraph(classUri, limit);
                }

                else if (type === 'network') {

                    graph = await app.graph.getNetworkGraph();
                }

                else if (type === 'node') {

                    const nodeUri = url.searchParams.get('node');

                    if (!nodeUri) {

                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ error: 'Čvor je obavezan.' }));

                        return;
                    }

                    graph = await app.graph.getNodeGraph(nodeUri);
                }

                else if (type === 'substation') {

                    const substationUri = url.searchParams.get('substation');

                    if (!substationUri) {

                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ error: 'Substation je obavezna.' }));

                        return;
                    }

                    graph = await app.graph.getSubstationGraph(substationUri);
                }

                else if (type === 'equipment') {

                    const containerUri = url.searchParams.get('container');

                    if (!containerUri) {
                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ error: 'Kontejner je obavezan.' }));

                        return;
                    }

                    graph = await app.graph.getEquipmentGraph(containerUri);
                }

                //GRAF GRUPA

                else if (type === 'groups') {

                    const classUri = url.searchParams.get('class');
                    const propertyUri = url.searchParams.get('property');
                    const groupUri = url.searchParams.get('group');

                    if (!classUri || !propertyUri) {

                        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        response.end(JSON.stringify({ error: 'Za graf grupa potrebni su klasa i relacija.' }));

                        return;
                    }

                    graph = await app.graph.getGroupGraph(classUri, propertyUri, groupUri);
                }

                else {

                    response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    response.end(JSON.stringify({ error: 'Nepoznat tip grafa.' }));

                    return;
                }

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(graph));

                return;
            }

            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Ruta nije pronađena.' }));

        }
        catch (error) {

            console.error(error);

            response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ error: error.message }));
        }

    });


server.listen(PORT, () => {

    console.log();
    console.log('==========================================');
    console.log('WEB SERVER POKRENUT');
    console.log('==========================================');
    console.log();

    console.log(`Otvori: http://localhost:${PORT}`);

    console.log();
});