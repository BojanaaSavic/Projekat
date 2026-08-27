const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const CIM = 'http://iec.ch/TC57/CIM100#';

export class GraphService {

    constructor(sparqlService) {
        this.sparql = sparqlService;
    }


    /*
     * GRAF KLASE
     *
     * Čvorovi = RDFS klase
     * Veze = rdfs:subClassOf
     */
    async getClassGraph() {

        const query = `
            SELECT DISTINCT
                ?class
                ?label
                ?parent
                ?parentLabel
            WHERE {

                {
                    ?class a <${RDFS}Class> .
                }
                UNION
                {
                    ?class <${RDFS}subClassOf> ?parent .
                }

                OPTIONAL {
                    ?class <${RDFS}label> ?label .
                }

                OPTIONAL {
                    ?class <${RDFS}subClassOf> ?parent .
                }

                OPTIONAL {
                    ?parent <${RDFS}label> ?parentLabel .
                }
            }
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const classUri = binding.get('class')?.value;
            const classLabel = binding.get('label')?.value;

            const parentUri = binding.get('parent')?.value;
            const parentLabel = binding.get('parentLabel')?.value;

            if (!classUri) {
                return;
            }

            this.addNode(
                nodes,
                classUri,
                classLabel || this.getLocalName(classUri),
                'Class'
            );

            if (parentUri) {

                this.addNode(
                    nodes,
                    parentUri,
                    parentLabel || this.getLocalName(parentUri),
                    'Class'
                );

                this.addEdge(
                    edges,
                    classUri,
                    parentUri,
                    `${RDFS}subClassOf`,
                    'subClassOf'
                );
            }
        });

        return this.createGraph(nodes, edges);
    }


    /*
     * GRAF PROPERTIJA
     *
     * Čvorovi = klase
     * Veze = RDF properties
     *
     * domain klase -> range klase
     */
    async getPropertyGraph() {

        const query = `
            SELECT DISTINCT
                ?property
                ?propertyLabel
                ?domain
                ?domainLabel
                ?range
                ?rangeLabel
            WHERE {

                ?property <${RDFS}domain> ?domain .
                ?property <${RDFS}range> ?range .

                OPTIONAL {
                    ?property <${RDFS}label> ?propertyLabel .
                }

                OPTIONAL {
                    ?domain <${RDFS}label> ?domainLabel .
                }

                OPTIONAL {
                    ?range <${RDFS}label> ?rangeLabel .
                }

                FILTER (isIRI(?domain))
                FILTER (isIRI(?range))
            }
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();


        results.forEach(binding => {

            const property =
                binding.get('property')?.value;

            const propertyLabel =
                binding.get('propertyLabel')?.value;

            const domain =
                binding.get('domain')?.value;

            const domainLabel =
                binding.get('domainLabel')?.value;

            const range =
                binding.get('range')?.value;

            const rangeLabel =
                binding.get('rangeLabel')?.value;


            if (!property || !domain || !range) {
                return;
            }


            /*
            * DOMAIN KLASA
            */

            this.addNode(
                nodes,
                domain,
                domainLabel || this.getLocalName(domain),
                'Class'
            );


            /*
            * RANGE KLASA
            */

            this.addNode(
                nodes,
                range,
                rangeLabel || this.getLocalName(range),
                'Class'
            );


            /*
            * PROPERTY = VEZA
            *
            * Svaki property se prikazuje samo jednom.
            */

            this.addEdge(
                edges,
                domain,
                range,
                property,
                propertyLabel || this.getLocalName(property)
            );
        });


        return this.createGraph(nodes, edges);
    }


    /*
     * GRAF GRUPA
     *
     * classUri + propertyUri određuju grupe.
     *
     * Čvorovi:
     *   grupa
     *   elementi grupe
     *
     * Veze:
     *   grupa -> element
     *
     * Ako je groupUri naveden, prikazuje se samo ta grupa.
     */
    async getGroupGraph(classUri, propertyUri, groupUri = null) {

        if (!classUri || !propertyUri) {

            return {
                nodes: [],
                edges: []
            };
        }

        const groupFilter = groupUri
            ? `FILTER (?group = <${groupUri}>)`
            : '';

        const query = `
            SELECT DISTINCT
                ?item
                ?itemName
                ?itemType
                ?group
                ?groupName
                ?groupType
            WHERE {

                ?item a <${classUri}> .

                ?item <${propertyUri}> ?group .

                ${groupFilter}

                OPTIONAL {
                    ?item <${CIM}IdentifiedObject.name> ?itemName .
                }

                OPTIONAL {
                    ?item a ?itemType .
                }

                OPTIONAL {
                    ?group <${CIM}IdentifiedObject.name> ?groupName .
                }

                OPTIONAL {
                    ?group a ?groupType .
                }
            }
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const item = binding.get('item')?.value;
            const itemName = binding.get('itemName')?.value;
            const itemType = binding.get('itemType')?.value;

            const group = binding.get('group')?.value;
            const groupName = binding.get('groupName')?.value;
            const groupType = binding.get('groupType')?.value;

            if (!item || !group) {
                return;
            }

            this.addNode(
                nodes,
                group,
                groupName || this.getLocalName(group),
                groupType
                    ? this.getLocalName(groupType)
                    : 'Group'
            );

            this.addNode(
                nodes,
                item,
                itemName || this.getLocalName(item),
                itemType
                    ? this.getLocalName(itemType)
                    : 'Item'
            );

            this.addEdge(
                edges,
                group,
                item,
                propertyUri,
                this.getLocalName(propertyUri)
            );
        });

        return this.createGraph(nodes, edges);
    }


    addNode(nodes, id, name, type = null) {

        if (!id) {
            return;
        }

        if (!nodes.has(id)) {

            nodes.set(id, {
                id,
                name: name || this.getLocalName(id),
                type
            });
        }
    }


    addEdge(edges, source, target, property, propertyName) {

        if (!source || !target) {
            return;
        }

        const id = `${source}|${property}|${target}`;

        if (!edges.has(id)) {

            edges.set(id, {
                id,
                source,
                target,
                property,
                propertyName
            });
        }
    }


    createGraph(nodes, edges) {

        return {
            nodes: Array.from(nodes.values()),
            edges: Array.from(edges.values())
        };
    }


    getLocalName(uri) {

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
}