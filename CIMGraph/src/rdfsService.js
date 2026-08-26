export class RdfsService {

    constructor(sparqlService) {
        this.sparql = sparqlService;
    }

    async getClasses() {

        const query = `
            SELECT DISTINCT ?class
            WHERE {
                ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
            }
            ORDER BY ?class
        `;

        return await this.sparql.query(query);
    }

    async getClassInstances(classUri) {

        const query = `
            SELECT DISTINCT ?instance
            WHERE {
                ?instance a <${classUri}> .
            }
            ORDER BY ?instance
        `;

        return await this.sparql.query(query);
    }

    async getClassLabel(classUri) {

        const query = `
            SELECT ?label
            WHERE {
                <${classUri}> <http://www.w3.org/2000/01/rdf-schema#label> ?label .
            }
            LIMIT 1
        `;

        const results = await this.sparql.query(query);

        if (results.length === 0) {
            return null;
        }

        return results[0].get('label')?.value;
    }
}