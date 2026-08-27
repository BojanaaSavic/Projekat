import { RdfStore } from './rdfStore.js';
import { SparqlService } from './sparqlService.js';
import { RdfsService } from './rdfsService.js';


async function main() {

    console.log('==========================================');
    console.log('       CIM RDF APPLICATION');
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
    const classes = await rdfs.getClasses();

    console.log();
    console.log(`Pronađeno RDFS klasa: ${classes.length}`);

    console.log();
    console.log('==========================================');
    console.log('RDF APLIKACIJA USPJEŠNO POKRENUTA');
    console.log('==========================================');
}


main().catch(error => {

    console.error();
    console.error('GREŠKA:');
    console.error(error);

});