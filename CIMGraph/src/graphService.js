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

    async getNetworkGraph() {

        const query = ` SELECT DISTINCT ?station1 ?station1Name ?station2 ?station2Name ?line ?lineName

            WHERE {

                ?line a <${CIM}ACLineSegment> .

                ?terminal1 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?line ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode1 .

                ?terminal2 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?line ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode2 .

                FILTER (?terminal1 != ?terminal2)
                FILTER (?connectivityNode1 != ?connectivityNode2)

                ?connectivityNode1 <${CIM}ConnectivityNode.ConnectivityNodeContainer> ?voltageLevel1 .
                ?connectivityNode2 <${CIM}ConnectivityNode.ConnectivityNodeContainer> ?voltageLevel2 .
                ?voltageLevel1 <${CIM}VoltageLevel.Substation> ?station1 .
                ?voltageLevel2 <${CIM}VoltageLevel.Substation> ?station2 .

                FILTER (?station1 != ?station2)

                OPTIONAL { ?station1 <${CIM}IdentifiedObject.name> ?station1Name . }
                OPTIONAL { ?station2 <${CIM}IdentifiedObject.name> ?station2Name . }
                OPTIONAL { ?line <${CIM}IdentifiedObject.name> ?lineName . }
            }

            ORDER BY ?station1Name ?station2Name ?lineName
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const station1 = binding.get('station1')?.value;
            const station1Name = binding.get('station1Name')?.value;

            const station2 = binding.get('station2')?.value;
            const station2Name = binding.get('station2Name')?.value;

            const line = binding.get('line')?.value;
            const lineName = binding.get('lineName')?.value;

            if (!station1 || !station2 || !line) {
                return;
            }

            this.addNode(
                nodes,
                station1,
                station1Name || this.getLocalName(station1),
                'Substation'
            );

            this.addNode(
                nodes,
                station2,
                station2Name || this.getLocalName(station2),
                'Substation'
            );

            this.addNetworkEdge(
                edges,
                station1,
                station2,
                line,
                lineName || this.getLocalName(line)
            );
        });

        const fixedPositions =
            this.getFixedNodePositions(Array.from(nodes.values()));

        return this.createGraph(
            nodes,
            edges,
            query,
            fixedPositions
        );
    }

    async getSubstationGraph(substationUri) {

        if (!substationUri) {

            return {
                nodes: [],
                edges: [],
                query: ''
            };
        }

        const query = ` SELECT DISTINCT
                ?equipment1
                ?equipment1Name
                ?equipment1Type
                ?equipment2
                ?equipment2Name
                ?equipment2Type
                ?connectivityNode

            WHERE {

                # Prvi element preko Terminala dolazi do ConnectivityNode-a
                ?terminal1 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?equipment1 ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode .

                # Drugi element je povezan na isti ConnectivityNode
                ?terminal2 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?equipment2 ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode .

                FILTER (?terminal1 != ?terminal2)
                FILTER (?equipment1 != ?equipment2)

                # ConnectivityNode pripada VoltageLevel-u
                ?connectivityNode <${CIM}ConnectivityNode.ConnectivityNodeContainer> ?voltageLevel .

                # VoltageLevel pripada izabranoj stanici
                ?voltageLevel <${CIM}VoltageLevel.Substation> <${substationUri}> .

                OPTIONAL { ?equipment1 <${CIM}IdentifiedObject.name> ?equipment1Name . }
                OPTIONAL { ?equipment2 <${CIM}IdentifiedObject.name> ?equipment2Name . }
                OPTIONAL { ?equipment1 a ?equipment1Type . }
                OPTIONAL { ?equipment2 a ?equipment2Type . }
            }

            ORDER BY ?equipment1Name ?equipment2Name
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const equipment1 = binding.get('equipment1')?.value;
            const equipment1Name = binding.get('equipment1Name')?.value;
            const equipment1Type = binding.get('equipment1Type')?.value;
            const equipment2 = binding.get('equipment2')?.value;
            const equipment2Name = binding.get('equipment2Name')?.value;
            const equipment2Type = binding.get('equipment2Type')?.value;
            const connectivityNode = binding.get('connectivityNode')?.value;

            if (!equipment1 || !equipment2) {
                return;
            }

            this.addNode(
                nodes,
                equipment1,
                equipment1Name || this.getLocalName(equipment1),
                equipment1Type ? this.getLocalName(equipment1Type) : 'Equipment'
            );

            this.addNode(
                nodes,
                equipment2,
                equipment2Name || this.getLocalName(equipment2),
                equipment2Type ? this.getLocalName(equipment2Type) : 'Equipment'
            );

            this.addEdge(
                edges,
                equipment1,
                equipment2,
                connectivityNode || '',
                'ConnectivityNode'
            );
        });

        return this.createGraph(nodes, edges, query);
    }

    async getNodeGraph(nodeUri) {

        if (!nodeUri) {
            return {
                nodes: [],
                edges: [],
                query: ''
            };
        }

        const query = ` SELECT DISTINCT
                ?source
                ?sourceName
                ?sourceType
                ?property
                ?target
                ?targetName
                ?targetType

            WHERE {

                {
                    BIND(<${nodeUri}> AS ?source)

                    ?source ?property ?target .

                    FILTER (isIRI(?target))
                    FILTER (?property != <${RDF}type>)

                    OPTIONAL { ?source <${CIM}IdentifiedObject.name> ?sourceName . }
                    OPTIONAL { ?source a ?sourceType . }
                    OPTIONAL { ?target <${CIM}IdentifiedObject.name> ?targetName . }
                    OPTIONAL { ?target a ?targetType . }
                }

                UNION

                {
                    ?source ?property <${nodeUri}> .

                    BIND(<${nodeUri}> AS ?target)

                    FILTER (isIRI(?source))
                    FILTER (?property != <${RDF}type>)

                    OPTIONAL { ?source <${CIM}IdentifiedObject.name> ?sourceName . }
                    OPTIONAL { ?source a ?sourceType . }
                    OPTIONAL { ?target <${CIM}IdentifiedObject.name> ?targetName . }
                    OPTIONAL { ?target a ?targetType . }
                }
            }
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const source = binding.get('source')?.value;
            const sourceName = binding.get('sourceName')?.value;
            const sourceType = binding.get('sourceType')?.value;
            const property = binding.get('property')?.value;
            const target = binding.get('target')?.value;
            const targetName = binding.get('targetName')?.value;
            const targetType = binding.get('targetType')?.value;

            if (!source || !property || !target) {
                return;
            }

            this.addNode(
                nodes,
                source,
                sourceName || this.getLocalName(source),
                sourceType ? this.getLocalName(sourceType) : 'Resource'
            );

            this.addNode(
                nodes,
                target,
                targetName || this.getLocalName(target),
                targetType ? this.getLocalName(targetType) : 'Resource'
            );

            this.addEdge(
                edges,
                source,
                target,
                property,
                this.getLocalName(property)
            );
        });

        return this.createGraph(nodes, edges, query);
    }

    async getLineConnectionGraph(station1Uri, station2Uri) {

        if (!station1Uri || !station2Uri) {
            return {
                nodes: [],
                edges: [],
                query: ''
            };
        }

        const query = ` SELECT DISTINCT ?station1 ?station1Name ?station2 ?station2Name ?line ?lineName

            WHERE {

                ?line a <${CIM}ACLineSegment> .

                ?terminal1 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?line ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode1 .

                ?terminal2 a <${CIM}Terminal> ;
                    <${CIM}Terminal.ConductingEquipment> ?line ;
                    <${CIM}Terminal.ConnectivityNode> ?connectivityNode2 .

                FILTER (?terminal1 != ?terminal2)
                FILTER (?connectivityNode1 != ?connectivityNode2)

                ?connectivityNode1 <${CIM}ConnectivityNode.ConnectivityNodeContainer> ?voltageLevel1 .
                ?connectivityNode2 <${CIM}ConnectivityNode.ConnectivityNodeContainer> ?voltageLevel2 .
                ?voltageLevel1 <${CIM}VoltageLevel.Substation> ?station1 .
                ?voltageLevel2 <${CIM}VoltageLevel.Substation> ?station2 .

                FILTER ((?station1 = <${station1Uri}> && ?station2 = <${station2Uri}>)
                    || (?station1 = <${station2Uri}> && ?station2 = <${station1Uri}>))

                OPTIONAL { ?station1 <${CIM}IdentifiedObject.name> ?station1Name . }
                OPTIONAL { ?station2 <${CIM}IdentifiedObject.name> ?station2Name . }
                OPTIONAL { ?line <${CIM}IdentifiedObject.name> ?lineName . }
            }

            ORDER BY ?lineName
        `;

        const results = await this.sparql.query(query);

        const nodes = new Map();
        const edges = new Map();

        results.forEach(binding => {

            const station1 = binding.get('station1')?.value;
            const station1Name = binding.get('station1Name')?.value;
            const station2 = binding.get('station2')?.value;
            const station2Name = binding.get('station2Name')?.value;
            const line = binding.get('line')?.value;
            const lineName = binding.get('lineName')?.value;

            if (!station1 || !station2 || !line) {
                return;
            }

            this.addNode(nodes, station1, station1Name || this.getLocalName(station1), 'Substation');
            this.addNode(nodes, station2, station2Name || this.getLocalName(station2), 'Substation');
            this.addNode(nodes, line, lineName || this.getLocalName(line), 'ACLineSegment');
            this.addEdge(edges, station1, line, `${CIM}ACLineSegment.connection`, 'ACLineSegment');
            this.addEdge(edges, line, station2, `${CIM}ACLineSegment.connection`, 'ACLineSegment');
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

    addNetworkEdge(edges, source, target, lineSegment = null, lineSegmentName = null) {

        if (!source || !target || source === target) {
            return;
        }

        const ordered = [source, target].sort();
        const id = `network|${ordered[0]}|${ordered[1]}`;

        if (!edges.has(id)) {

            edges.set(id, {

                id,
                source: ordered[0],
                target: ordered[1],

                property: lineSegment || '',
                propertyName: lineSegment ? 'ACLineSegment' : 'Mrežna veza',

                lineSegmentCount: lineSegment ? 1 : 0,

                lineSegments: lineSegment ? [{ uri: lineSegment, name: lineSegmentName || this.getLocalName(lineSegment) }] : []
            });

            return;
        }

        const edge = edges.get(id);

        if (lineSegment && !edge.lineSegments.some(segment => segment.uri === lineSegment)) {

            edge.lineSegments.push({
                uri: lineSegment,
                name: lineSegmentName || this.getLocalName(lineSegment)
            });

            edge.lineSegmentCount = edge.lineSegments.length;
        }
    }

    getFixedNodePositions(nodes, fixedType = 'Substation') {

        const fixedNodes = nodes.filter(node => node.type === fixedType).sort((a, b) => a.id.localeCompare(b.id));
        const positions = {};
        const columns = Math.ceil(Math.sqrt(fixedNodes.length));
        const spacingX = 120;
        const spacingY = 120;

        fixedNodes.forEach((node, index) => {

            const column = index % columns;
            const row = Math.floor(index / columns);

            positions[node.id] = {
                x: column * spacingX + (row % 2) * (spacingX / 2),
                y: row * spacingY
            };
        });

        return positions;
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