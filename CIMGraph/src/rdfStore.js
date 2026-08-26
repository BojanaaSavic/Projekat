import fs from 'fs/promises';
import { Store, Parser } from 'n3';

export class RdfStore {

    constructor() {
        this.store = new Store();
    }

    async loadTurtle(filePath) {

        console.log(`Učitavanje RDF fajla: ${filePath}`);

        const ttlContent = await fs.readFile(filePath, 'utf8');

        const parser = new Parser({
            format: 'Turtle'
        });

        return this.parseContent(ttlContent, parser);
    }

    async loadRdfs(filePath) {

        console.log(`Učitavanje RDFS fajla: ${filePath}`);

        const rdfsContent = await fs.readFile(filePath, 'utf8');

        const parser = new Parser({
            format: 'Turtle'
        });

        return this.parseContent(rdfsContent, parser);
    }

    parseContent(content, parser) {

        return new Promise((resolve, reject) => {

            parser.parse(content, (error, quad) => {

                if (error) {
                    reject(error);
                    return;
                }

                if (quad) {
                    this.store.addQuad(quad);
                    return;
                }

                resolve();
            });

        });
    }

    getStore() {
        return this.store;
    }

    getQuadCount() {
        return this.store.size;
    }
}