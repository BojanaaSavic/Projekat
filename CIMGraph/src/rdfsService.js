const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

export class RdfsService {

    constructor(sparqlService) { this.sparql = sparqlService; }

    async getClasses() {

        const query = `
            SELECT DISTINCT ?class ?label
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

        const query = `
            SELECT DISTINCT ?instance
            WHERE {

                ?instance a <${classUri}> .
            }

            ORDER BY ?instance
        `;

        return await this.sparql.query(query);
    }

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

    async getGroupedData(classUri, propertyUri) {

        const query = `
            SELECT DISTINCT ?item ?itemName ?group ?groupName ?groupType
            WHERE {

                ?item a <${classUri}> .

                ?item <${propertyUri}> ?group .

                OPTIONAL { ?item ?itemNameProperty ?itemName .
                    
                    FILTER ( ?itemNameProperty = <http://iec.ch/TC57/CIM100#IdentifiedObject.name> )
                }

                OPTIONAL { ?group ?groupNameProperty ?groupName .

                    FILTER ( ?groupNameProperty = <http://iec.ch/TC57/CIM100#IdentifiedObject.name> )
                }

                OPTIONAL { ?group a ?groupType . }
            }

            ORDER BY ?groupName ?itemName
        `;

        return await this.sparql.query(query);
    }
}