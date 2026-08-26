import { RdfStore } from './rdfStore.js';
import { SparqlService } from './sparqlService.js';
import { RdfsService } from './rdfsService.js';

async function main() {

    console.log('==========================================');
    console.log('       CIM RDF TEST APPLICATION');
    console.log('==========================================');
    console.log();

    const rdfStore = new RdfStore();

    // ==========================================
    // 1. UČITAVANJE RDF MODELA
    // ==========================================

    await rdfStore.loadTurtle('./data/IEEE34.ttl');

    console.log();
    console.log('RDF model uspješno učitan.');
    console.log(`Broj RDF trojki: ${rdfStore.getQuadCount()}`);

    // ==========================================
    // 2. UČITAVANJE RDFS MODELA
    // ==========================================

    await rdfStore.loadRdfs('./data/IEEE34_rdfs.ttl');

    console.log();
    console.log('RDFS model uspješno učitan.');
    console.log(`Ukupan broj trojki nakon RDFS-a: ${rdfStore.getQuadCount()}`);

    const store = rdfStore.getStore();

    // ==========================================
    // 3. SPARQL
    // ==========================================

    const sparql = new SparqlService(store);

    // ==========================================
    // 4. RDF TROJKE
    // ==========================================

    console.log();
    console.log('PRVIH 10 RDF TROJKI');
    console.log('------------------------------------------');

    const quads = store.getQuads(null, null, null, null);

    quads.slice(0, 10).forEach((quad, index) => {

        console.log(
            `${index + 1}.`,
            quad.subject.value,
            '→',
            quad.predicate.value,
            '→',
            quad.object.value
        );

    });

    // ==========================================
    // 5. RDFS KLASE
    // ==========================================

    const rdfs = new RdfsService(sparql);

    console.log();
    console.log('RDFS KLASE');
    console.log('------------------------------------------');

    const classResults = await rdfs.getClasses();

    console.log(
        `Pronađeno RDFS klasa: ${classResults.length}`
    );

    console.log();

    classResults.forEach((binding, index) => {

        const classUri = binding.get('class')?.value;

        console.log(
            `${index + 1}. ${classUri}`
        );

    });

    // ==========================================
    // 6. TEST IZBORA KLASE
    // ==========================================

    const selectedClass =
        'http://iec.ch/TC57/CIM100#ACLineSegment';

    console.log();
    console.log('ODABRANA KLASA');
    console.log('------------------------------------------');

    console.log(selectedClass);

    // ==========================================
    // 7. INSTANCE ODABRANE KLASE
    // ==========================================

    const instances =
        await rdfs.getClassInstances(selectedClass);

    console.log();
    console.log('INSTANCE ODABRANE KLASE');
    console.log('------------------------------------------');

    console.log(
        `Broj instanci: ${instances.length}`
    );

    console.log();

    instances.forEach((binding, index) => {

        const instance =
            binding.get('instance')?.value;

        console.log(
            `${index + 1}. ${instance}`
        );

    });

    console.log();
    console.log('==========================================');
    console.log('TEST ZAVRŠEN');
    console.log('==========================================');
}

main().catch(error => {

    console.error();
    console.error('GREŠKA:');
    console.error(error);

});