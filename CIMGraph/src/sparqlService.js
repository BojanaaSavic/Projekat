import { QueryEngine } from '@comunica/query-sparql';

export class SparqlService {

    constructor(store) {

        this.store = store;

        this.engine = new QueryEngine();
    }

    async query(sparqlQuery) {

        const bindingsStream = await this.engine.queryBindings(
            sparqlQuery,
            {
                sources: [this.store]
            }
        );

        const bindings = await bindingsStream.toArray();

        return bindings;
    }
}