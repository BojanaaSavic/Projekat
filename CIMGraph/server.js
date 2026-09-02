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

    await rdfStore.loadRdfs('./data/CGMES_RDFS.ttl');

    console.log();
    console.log(`RDFS model učitan.`);

    console.log(`Ukupan broj trojki: ${rdfStore.getQuadCount()}`);


    const store = rdfStore.getStore();
    const sparql = new SparqlService(store);
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

            if (request.method === 'GET' && request.url.startsWith('/api/properties?')) {

                const url = new URL(request.url, `http://localhost:${PORT}`);
                const classUri = url.searchParams.get('class');

                if (!classUri) {

                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Nije navedena klasa.' }));

                    return;
                }

                const results = await app.rdfs.getClassProperties(classUri);

                const properties =
                    results.map(binding => {

                        const uri = binding.get('property')?.value;
                        const label = binding.get('label')?.value;
                        const comment = binding.get('comment')?.value;
                        const range = binding.get('range')?.value;


                        return { uri, name: label || getClassName(uri), comment: comment || '', range: range || null };
                    });

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(properties));

                return;
            }

            if (request.method === 'GET' && request.url.startsWith('/api/group?')) {

                const url = new URL(request.url, `http://localhost:${PORT}`);
                const classUri = url.searchParams.get('class');
                const propertyUri = url.searchParams.get('property');

                if (!classUri || !propertyUri) {

                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Klasa i property su obavezni.' }));

                    return;
                }

                const results = await app.rdfs.getGroupedData(classUri, propertyUri);
                const groups = {};

                results.forEach(binding => {

                    const item = binding.get('item')?.value;
                    const itemName = binding.get('itemName')?.value;
                    const group = binding.get('group')?.value;
                    const groupName = binding.get('groupName')?.value;
                    const groupType = binding.get('groupType')?.value;

                    if (!group) {
                        return;
                    }


                    if (!groups[group]) {

                        groups[group] = {

                            uri: group,
                            name: groupName || getClassName(group),
                            type: groupType ? getClassName(groupType) : null,
                            items: []
                        };
                    }

                    groups[group].items.push({

                        uri: item,
                        name: itemName || getClassName(item)
                    });
                });

                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(Object.values(groups)));

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

                    graph = await app.graph.getInstanceGraph(classUri);
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