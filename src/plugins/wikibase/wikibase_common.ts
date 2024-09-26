export class properties {
  static instance_of: string = 'P1';
  static relatedAgents: string = 'P40';
  static media: string = 'P104';
  static hasPart: string = 'P5';
  static isPartOf: string = 'P6';
  static internalID: string = 'P96';
  static title: string = 'P4';
  static dateCreated: string = 'P12';
  static dateModified: string = 'P112';
  static license: string = 'P53';
  static technique: string = 'P65';
  static software: string = 'P66';
  static equipment: string = 'P67';
  static cameraType: string = 'P78';
  static role: string = 'P110';
  static objectOfRepresentation: string = 'P63';
  static bibliographicRef: string = 'P58';
  static externalLink: string = 'P57';
  static hasAnnotation: string = 'P75';
  static targetEntity: string = 'P77';
  static perspectivePositionX: string = 'P84';
  static perspectivePositionY: string = 'P85';
  static perspectivePositionZ: string = 'P86';
  static perspectiveTargetX: string = 'P87';
  static perspectiveTargetY: string = 'P88';
  static perspectiveTargetZ: string = 'P89';
  static selectorPositionX: string = 'P90';
  static selectorPositionY: string = 'P91';
  static selectorPositionZ: string = 'P92';
  static selectorNormalX: string = 'P93';
  static selectorNormalY: string = 'P94';
  static selectorNormalZ: string = 'P95';
  static annotationRanking: string = 'P79';
  static annotationMotivation: string = 'P80';
  static annotationVerified: string = 'P83';
  static annotationDescriptionLink: string = 'P76';
  static annotationRelatedConcepts: string = 'P81';
  static annotationRelatedMedia: string = 'P82';
  static image: string = 'P61';
  static creator: string = 'P40';
  static dataCreator: string = 'P41';
  static editor: string = 'P42';
  static inCustodyOf: string = 'P43';
  static owner: string = 'P44';
  static rightsOwner: string = 'P45';
  static curator: string = 'P46';
  static contactPerson: string = 'P51';
}

export class classes {
  static organisation: number = 4;
  static buildingEnsemble: number = 58;
  static human: number = 2;
  static bibliographicRef: number = 20;
  static media: number = 21;
  static license: number = 19;
  static technique: number = 22;
  static software: number = 23;
  static role: number = 196;
  static annotation: number = 25;
}

export class values {
  static motivationDescribing: number = 45;
  static true: number = 30;
  static false: number = 31;
}

export class WikibaseID {
  public url?: URL;
  public itemID: string;
  public numericID: number;
  public namespace?: string;

  constructor(public id: string) {
    // we might get a non-URL as an id
    // in this case consider id to be the Q-number
    try {
      this.url = new URL(id);
      const url_tokens = this.url.pathname.split(/\//);
      this.itemID = url_tokens[url_tokens.length - 1];
    } catch (err) {
      this.url = undefined;
      this.itemID = id;
    }
    const nsSplit = this.itemID.split(/[:]/);
    if (nsSplit.length > 1) {
      this.namespace = nsSplit[0];
      this.itemID = nsSplit[1];
    }
    this.numericID = parseInt(this.itemID.slice(1));
  }
}
