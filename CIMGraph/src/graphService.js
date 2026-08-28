const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const CIM = 'http://iec.ch/TC57/CIM100#';

export class GraphService {

    constructor(sparqlService) { this.sparql = sparqlService; }

    /*
     * GRAF INSTANCI
     *
     * Čvorovi = instance izabrane klase
     * Veze = RDF relacije između instanci
     *
     * Izabrana klasa određuje koje instance se prikazuju.
     */
    async getInstanceGraph(classUri) {

        if (!classUri) {

            return {
                nodes: [],
                edges: []
            };
        }


        const query = `SELECT DISTINCT ?instance ?instanceName ?relation ?target ?targetName ?targetType
            WHERE {

                ?instance a <${classUri}> .

                ?instance ?relation ?target .

                FILTER (isIRI(?target))

                OPTIONAL {
                    ?instance <${CIM}IdentifiedObject.name> ?instanceName .
                }

                OPTIONAL {
                    ?target <${CIM}IdentifiedObject.name> ?targetName .
                }

                OPTIONAL {
                    ?target a ?targetType .
                }

                FILTER (?relation != <${RDF}type>)
            }
        `;


        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();


        results.forEach(binding => {

            const instance = binding.get('instance')?.value;
            const instanceName = binding.get('instanceName')?.value;
            const relation = binding.get('relation')?.value;
            const target = binding.get('target')?.value;
            const targetName = binding.get('targetName')?.value;
            const targetType = binding.get('targetType')?.value;


            if (!instance || !relation || !target) {
                return;
            }

            this.addNode(nodes, instance, instanceName || this.getLocalName(instance), 'Instance');
            this.addNode(nodes, target, targetName || this.getLocalName(target), targetType ? this.getLocalName(targetType) : 'Instance');
            this.addEdge(edges, instance, target, relation, this.getLocalName(relation));
        });

        return this.createGraph(nodes, edges);
    }


    /*
     * GRAF GRUPA
     *
     * classUri + propertyUri određuju grupe.
     *
     * Čvorovi: grupa i elementi grupe
     *
     * Veze: grupa -> element
     */
    async getGroupGraph(classUri, propertyUri, groupUri = null) {

        if (!classUri || !propertyUri) {

            return {
                nodes: [],
                edges: []
            };
        }

        const groupFilter = groupUri ? `FILTER (?group = <${groupUri}>)` : '';
        const query = `SELECT DISTINCT ?item ?itemName ?itemType ?group ?groupName ?groupType
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

            this.addNode(nodes, group, groupName || this.getLocalName(group), groupType ? this.getLocalName(groupType) : 'Group');
            this.addNode(nodes, item, itemName || this.getLocalName(item), itemType ? this.getLocalName(itemType) : 'Item');
            this.addEdge(edges, group, item, propertyUri, this.getLocalName(propertyUri));
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