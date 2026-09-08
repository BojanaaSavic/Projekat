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
    async getInstanceGraph(classUri, limit = null) {

        if (!classUri) {

            return {
                nodes: [],
                edges: []
            };
        }

        const instanceLimit = Number.isInteger(limit) && limit > 0 ? limit : null;
        const relationLimit = instanceLimit ? Math.max(1, Math.floor(instanceLimit * 0.4)) : null;

        const query = `SELECT DISTINCT ?instance ?instanceName ?relation ?target ?targetName ?targetType
            WHERE {

                {
                    SELECT DISTINCT ?instance ?relation ?target
                    WHERE {
                        {
                            SELECT DISTINCT ?instance
                            WHERE {
                                ?instance a <${classUri}> .
                            }
                            ORDER BY ?instance
                            ${instanceLimit ? `LIMIT ${instanceLimit}` : ''}
                        }

                        ?instance ?relation ?target .

                        FILTER (isIRI(?target))
                        FILTER (?relation != <${RDF}type>)
                    }
                    ORDER BY ?instance ?relation ?target
                    ${relationLimit ? `LIMIT ${relationLimit}` : ''}
                }

                OPTIONAL {
                    ?instance <${CIM}IdentifiedObject.name> ?instanceName .
                }

                OPTIONAL {
                    ?target <${CIM}IdentifiedObject.name> ?targetName .
                }

                OPTIONAL {
                    ?target a ?targetType .
                }

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

        return this.createGraph(nodes, edges, query);
    }

    async getEquipmentGraph(nodeUri) {
        
        if (!nodeUri) {
            return {
                nodes: [],
                edges: [],
                query: ''
            };
        }

        const query = `SELECT DISTINCT ?equipment ?equipmentName ?equipmentType
            WHERE {
                ?equipment a ?equipmentType .

                ?equipmentType <${RDFS}subClassOf>* <${CIM}Equipment> .

                ?equipment <${CIM}Equipment.EquipmentContainer> <${nodeUri}> .

                OPTIONAL { ?equipment <${CIM}IdentifiedObject.name> ?equipmentName . }
            }
            ORDER BY ?equipmentName
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        this.addNode(nodes, nodeUri, this.getLocalName(nodeUri), 'EquipmentContainer');

        results.forEach(binding => {
            const equipment = binding.get('equipment')?.value;
            const equipmentName = binding.get('equipmentName')?.value;
            const equipmentType = binding.get('equipmentType')?.value;

            if (!equipment) {
                return;
            }

            this.addNode(
                nodes,
                equipment,
                equipmentName || this.getLocalName(equipment),
                equipmentType ? this.getLocalName(equipmentType) : 'Equipment'
            );

            this.addEdge(edges, nodeUri, equipment, `${CIM}Equipment.EquipmentContainer`, 'EquipmentContainer');
        });

        return this.createGraph(nodes, edges, query);
    }

    async getContainerGroupGraph(containerTypeUri, containerUri = null) {

        if (!containerTypeUri) {

            return {
                nodes: [],
                edges: [],
                query: ''
            };
        }

        const containerFilter = containerUri ? `FILTER (?container = <${containerUri}>)` : '';
        const query = ` SELECT DISTINCT ?container ?containerName ?equipment ?equipmentName ?equipmentType
            WHERE {
                ?container a <${containerTypeUri}> .

                ${containerFilter}

                ?equipment a ?equipmentType .

                ?equipmentType <${RDFS}subClassOf>* <${CIM}Equipment> .

                ?equipment <${CIM}Equipment.EquipmentContainer> ?container .

                OPTIONAL { ?container <${CIM}IdentifiedObject.name> ?containerName . }

                OPTIONAL { ?equipment <${CIM}IdentifiedObject.name> ?equipmentName . }
            }
            ORDER BY ?containerName ?equipmentName
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const container = binding.get('container')?.value;
            const containerName = binding.get('containerName')?.value;

            const equipment = binding.get('equipment')?.value;
            const equipmentName = binding.get('equipmentName')?.value;
            const equipmentType = binding.get('equipmentType')?.value;

            if (!container || !equipment) {
                return;
            }

            this.addNode(nodes, container, containerName || this.getLocalName(container), this.getLocalName(containerTypeUri));

            this.addNode(
                nodes,
                equipment,
                equipmentName || this.getLocalName(equipment),
                equipmentType ? this.getLocalName(equipmentType) : 'Equipment'
            );

            this.addEdge(edges, container, equipment, `${CIM}Equipment.EquipmentContainer`, 'EquipmentContainer');
        });

        return this.createGraph(nodes, edges, query);
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

    createGraph(nodes, edges, query = '') {

        return {
            nodes: Array.from(nodes.values()),
            edges: Array.from(edges.values()),
            query
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