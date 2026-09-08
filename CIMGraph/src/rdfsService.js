const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

export class RdfsService {

    constructor(sparqlService) { this.sparql = sparqlService; }

    async getClasses() {

        const query = `SELECT DISTINCT ?class ?label
            WHERE {
                ?instance a ?class .

                OPTIONAL { ?class <${RDFS}label> ?label . }
            }
            ORDER BY ?class
        `;

        return await this.sparql.query(query);
    }

    async getClassInfo(classUri) {

        const query = `
            SELECT ?label ?comment ?parent
            WHERE {

                OPTIONAL { <${classUri}> <${RDFS}label> ?label . }

                OPTIONAL { <${classUri}> <${RDFS}comment> ?comment . }

                OPTIONAL { <${classUri}> <${RDFS}subClassOf> ?parent . }
            }
        `;

        return await this.sparql.query(query);
    }

    async getClassInstances(classUri) {

        const query = `SELECT DISTINCT ?instance
            WHERE {
                ?instance a <${classUri}> .
            }
            ORDER BY ?instance
        `;

        return await this.sparql.query(query);
    }

    //might be old code
    async getClassProperties(classUri) {

        const query = `
            SELECT DISTINCT ?property ?label ?comment ?range
            WHERE {

                ?property <${RDFS}domain> <${classUri}> .

                OPTIONAL { ?property <${RDFS}label> ?label . }

                OPTIONAL { ?property <${RDFS}comment> ?comment . }

                OPTIONAL { ?property <${RDFS}range> ?range . }
            }
            ORDER BY ?property
        `;

        return await this.sparql.query(query);
    }

    async getEquipmentContainerTypes() {

        const CIM = 'http://iec.ch/TC57/CIM100#';

        const query = `SELECT DISTINCT ?containerType ?label
            WHERE {
                ?containerType <${RDFS}subClassOf>* <${CIM}EquipmentContainer> .

                OPTIONAL { ?containerType <${RDFS}label> ?label . }
            }
            ORDER BY ?containerType
        `;

        //FILTER (?containerType != <${CIM}EquipmentContainer>)
        return await this.sparql.query(query);
    }

    async getEquipmentGroups(containerTypeUri) {

        const CIM = 'http://iec.ch/TC57/CIM100#';

        if (!containerTypeUri) {
            return [];
        }

        const query = `SELECT DISTINCT ?group ?groupName ?groupType (COUNT(DISTINCT ?equipment) AS ?equipmentCount)
            WHERE {
                ?group a ?actualGroupType .

                ?actualGroupType <${RDFS}subClassOf>* <${containerTypeUri}> .

                ?equipment a ?equipmentType .

                ?equipmentType <${RDFS}subClassOf>* <${CIM}Equipment> .

                ?equipment <${CIM}Equipment.EquipmentContainer> ?group .

                BIND(?actualGroupType AS ?groupType)

                OPTIONAL { ?group <${CIM}IdentifiedObject.name> ?groupName . }
            }
            GROUP BY ?group ?groupName ?groupType

            ORDER BY ?groupName
        `;

        return await this.sparql.query(query);
    }
}