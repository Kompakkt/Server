import { WBAnnotationPredicates, WBClasses, WBPredicates } from './parsed-model';

export const getDigitalEntityMetadataSpark = (wikibaseId: string) => {
  const spark = `SELECT
    ?desc
    ?label
    ?licence ?licenceLabel
    ?date
    ?techniques ?techniquesLabel
    ?software ?softwareLabel
    ?equipment ?equipmentLabel
    ?externalLinks
    ?bibliographicRefs ?bibliographicRefsLabel
    ?physicalObjs ?physicalObjsLabel
    ?rightsOwner ?rightsOwnerLabel
    ?dataCreator ?dataCreatorLabel
    ?creator ?creatorLabel
    ?editor ?editorLabel
    ?contactperson ?contactpersonLabel
    WHERE {
      tib:${wikibaseId} schema:description ?desc .
      tib:${wikibaseId} tibt:${WBPredicates.license} ?licence .
      OPTIONAL { tib:${wikibaseId} rdfs:label ?label }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.date} ?date }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.method} ?techniques }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.softwareUsed} ?software }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.equipment} ?equipment }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.externalLink} ?externalLinks }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.documentedIn} ?bibliographicRefs }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.objectOfRepresentation} ?physicalObjs }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.instanceOf} ?hierarchies }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.rightHeldBy} ?rightsOwner }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.contactPerson} ?contactperson }

      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.rawDataCreatedBy ?? WBPredicates.hasEvent} ?statement1.
				          ?statement1 tibps:${WBPredicates.rawDataCreatedBy ?? WBPredicates.hasEvent} tib:${WBClasses.rawDataCreation} ;
									tibpq:${WBPredicates.carriedOutBy} ?dataCreator. }

      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.createdBy ?? WBPredicates.hasEvent} ?statement2.
                  ?statement2 tibps:${WBPredicates.createdBy ?? WBPredicates.hasEvent} tib:${WBClasses.creation} ;
							    tibpq:${WBPredicates.carriedOutBy} ?creator. }

      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.modifiedBy ?? WBPredicates.hasEvent} ?statement3.
                  ?statement3 tibps:${WBPredicates.modifiedBy ?? WBPredicates.hasEvent} tib:${WBClasses.modification} ;
							    tibpq:${WBPredicates.carriedOutBy} ?editor. }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;
  return spark;
};

export const getAnnotationMetadataSpark = (wikibaseId: string) => {
  const spark = `SELECT
      ?label ?desc ?dateCreated ?dateModified ?val ?rank ?motiv ?camType
      ?cx ?cy ?cz
      ?ctx ?cty ?ctz
      ?sx ?sy ?sz
      ?snx ?sny ?snz
      ?target
      ?concept ?conceptLabel
      ?media ?mediaLabel
      ?mediaURL ?relMediaThumb ?fileView
      ?descAgent ?descAgentLabel
      ?descLicense ?descLicenseLabel
      WHERE {
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
        tib:${wikibaseId} schema:description ?desc .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.verified} ?val .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.ranking} ?rank .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.motivation} ?motiv .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.cameraType} ?camType .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectivePositionXAxis} ?cx .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectivePositionYAxis} ?cy .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectivePositionZAxis} ?cz .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectiveTargetXAxis} ?ctx .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectiveTargetYAxis} ?cty .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.perspectiveTargetZAxis} ?ctz .
        tib:${wikibaseId} tibt:${WBAnnotationPredicates.annotates} ?target .
        OPTIONAL {
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefNormalXAxis} ?sx .
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefNormalYAxis} ?sy .
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefNormalZAxis} ?sz .
        }
        OPTIONAL {
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefPointXAxis} ?snx .
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefPointYAxis} ?sny .
          tib:${wikibaseId} tibt:${WBAnnotationPredicates.selectorRefPointZAxis} ?snz .
        }
        OPTIONAL {
            tib:${wikibaseId} tibp:${WBAnnotationPredicates.annotationText} [tibps:${WBAnnotationPredicates.annotationText} ?descAgentItem; tibpq:${WBPredicates.rightHeldBy} ?descAgent] .
        }
        OPTIONAL {
            tib:${wikibaseId} tibp:${WBAnnotationPredicates.annotationText} [tibps:${WBAnnotationPredicates.annotationText} ?descLicenseItem; tibpq:${WBPredicates.license} ?descLicense]
        }
        OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.date} ?dateCreated .  }
        OPTIONAL { tib:${wikibaseId} tibt:${WBAnnotationPredicates.relatedConcept} ?concept }
        OPTIONAL {
            tib:${wikibaseId} tibt:${WBAnnotationPredicates.relatedMedia} ?media .
            ?media tibt:${WBPredicates.fileView} ?fileView.
            ?media tibt:${WBPredicates.image} ?relMediaThumb.
        }
        OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.externalLink} ?mediaURL }
        OPTIONAL { tib:${wikibaseId} rdfs:label ?label }
      }`;
  return spark;
};

export const getWikibaseClassAndSubclassSpark = (classes: string[]) => {
  const classString = `tib:${classes.join(' tib:')}`;
  const spark = `SELECT ?id ?label_en ?desc ?media WHERE {
    values ?class {${classString}}
    {
      ?id tibt:${WBPredicates.instanceOf} ?class.
    }
    UNION
    {
      ?subclass tibt:${WBPredicates.subclassOf} ?class.
      ?id tibt:${WBPredicates.instanceOf} ?subclass.
    }
    ?id rdfs:label ?label_en filter (lang(?label_en) = "en").
    OPTIONAL { ?id schema:description ?desc filter (lang(?desc) = "en")}.
    OPTIONAL { ?media tibt:${WBPredicates.image} ?media. }
  }`;
  return spark;
};

export const getWikibaseClassInstancesSpark = (classes: string[]) => {
  const classString = `tib:${classes.join(' tib:')}`;

  const spark = `select DISTINCT ?id ?label_en ?description ?media where {
      values ?class {${classString}}
      ?id tibt:${WBPredicates.instanceOf} ?class.
      ?id rdfs:label ?label_en filter (lang(?label_en) = "en").
      optional { ?id schema:description ?description filter (lang(?description) = "en")}.
      optional { ?id tibt:${WBPredicates.image} ?media. }
    }`;

  return spark;
};

export const getHierarchySpark = (wikibaseId: string) => {
  const spark = `
  SELECT ?type ?item ?itemLabel WHERE {
    {
      tib:${wikibaseId} tibt:${WBPredicates.partOf}* ?item.
      BIND("parent" AS ?type)
    } UNION {
      tib:${wikibaseId} tibt:${WBPredicates.partOf} ?parent.
      ?item tibt:${WBPredicates.partOf} ?parent.
      BIND("sibling" AS ?type)
    }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  }
  `;

  return spark;
};
