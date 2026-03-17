import type { IEntity } from 'src/common';
import type { DfgMetsExtensionData } from './types';

export const buildMets = async ({ entity }: { entity: IEntity<DfgMetsExtensionData, true> }) => {
  return `
<?xml version="1.0" encoding="UTF-8"?>
<mets:mets
  xmlns:mets="http://www.loc.gov/METS/"
  xmlns:mods="http://www.loc.gov/mods/v3"
  xmlns:dv="http://dfg-viewer.de/"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:premis="info:lc/xmlns/premis-v3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.loc.gov/mods/v3 http://www.loc.gov/standards/mods/mods.xsd
    http://www.loc.gov/METS/ http://www.loc.gov/standards/mets/mets.xsd">

  <!-- =================================================================== -->
  <!-- DMD (Descriptive metadata)                                           -->
  <!-- =================================================================== -->
  <mets:dmdSec ID="DMDLOG_0310">
    <mets:mdWrap MDTYPE="MODS">
      <mets:xmlData>
        <mods:mods>

          <!-- ============================================================= -->
          <!-- 01 Title (Mandatory / Visible in Viewer: ✓)                   -->
          <!-- ============================================================= -->
          <mods:titleInfo xml:lang="en">
            <mods:title>Volpa Synagogue (1929–1941)</mods:title>
          </mods:titleInfo>

          <!-- 01.1 Title (Optional / Visible in Viewer: ✓)                  -->
          <!-- NOTE: titleInfo@type="abbreviated" tends to be merged with     -->
          <!-- the main title without a separator in the current UI.          -->
          <mods:titleInfo type="uniform">
            <mods:title>SyVo_1929-1941</mods:title>
          </mods:titleInfo>

          <!-- ============================================================= -->
          <!-- 02 Genre (Optional / Visible in Viewer: ✓)                    -->
          <!-- ============================================================= -->
          <mods:genre valueURI="http://uri.gbv.de/terminology/aadgenres/096630876">
            Architektur
          </mods:genre>

          <!-- ============================================================= -->
          <!-- 04 Creator (Mandatory / Visible in Viewer: ✓)                 -->
          <!-- IMPORTANT: current viewer displays creators reliably when     -->
          <!-- MARC relator role is "aut" (not "cre").                        -->
          <!-- ============================================================= -->
          <mods:name type="personal" valueURI="https://orcid.org/0000-0001-8410-3936">
            <mods:namePart type="family">Prokopiuk</mods:namePart>
            <mods:namePart type="given">Katarzyna</mods:namePart>
            <mods:affiliation>Warsaw University of Technology</mods:affiliation>
            <mods:role>
              <mods:roleTerm type="code" authority="marcrelator">aut</mods:roleTerm>
            </mods:role>
          </mods:name>

          <!-- 00.1 Additional agent (not in table / Visible in Viewer: depends) -->
          <!-- Example: funder (fnd). Keep for completeness, but UI behaviour may vary. -->
          <mods:name type="corporate">
            <mods:displayForm>Warsaw University of Technology</mods:displayForm>
            <mods:role>
              <mods:roleTerm authority="marcrelator" type="code">fnd</mods:roleTerm>
            </mods:role>
          </mods:name>

          <!-- ============================================================= -->
          <!-- 09 Description (Recommended / Visible in Viewer: ✓)           -->
          <!-- ============================================================= -->
          <mods:abstract xml:lang="en">
            The model depicts the Volpa Synagogue, a wooden baroque synagogue formerly located in present-day Belarus,
            in its interwar phase shortly before destruction by the German occupiers. The reconstruction is based on
            archival inventory drawings, historic photographs and the monograph by Maria and Kazimierz Piechotka on
            wooden synagogues of the former Polish–Lithuanian Commonwealth. Represented condition in 3D model: intact,
            shortly before destruction (interwar phase), as it stood between 1929 and 1941. It was created as a student
            project at the Warsaw University of Technology within the PL 3DREKO-22 seminar coordinated by the Institute
            of Architecture of Mainz University of Applied Sciences.
          </mods:abstract>

          <!-- ============================================================= -->
          <!-- 06/07 Digitisation/Creation event (Recommended / Visible: ✓)  -->
          <!-- NOTE: In current practice we merge "creation" into             -->
          <!-- originInfo@eventType="digitization".                            -->
          <!-- ============================================================= -->
          <mods:originInfo eventType="digitization">
            <mods:place>
              <mods:placeTerm type="text">Faculty of Architecture of the Warsaw University of Technology</mods:placeTerm>
            </mods:place>
            <mods:publisher type="corporate" authority="gnd" valueURI="https://d-nb.info/gnd/16155115-4">
              Mainz University of Applied Sciences, Institute of Architecture
            </mods:publisher>
            <mods:dateCaptured encoding="w3cdtf" point="start">2022-03</mods:dateCaptured>
            <mods:dateCaptured encoding="w3cdtf" point="end">2022-05</mods:dateCaptured>
          </mods:originInfo>

          <!-- ============================================================= -->
          <!-- 11 Copyrights / License (Mandatory / Visible in Viewer: ✓)    -->
          <!-- ============================================================= -->
          <mods:accessCondition
            type="use and reproduction"
            displayLabel="CC BY-NC-SA 4.0"
            xlink:type="simple"
            xlink:href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
            CC BY-NC-SA 4.0
          </mods:accessCondition>

          <!-- 00.2 Rights/Attribution (not in table / Visible in Viewer: ✗) -->
          <!-- Free-text statements; keep short and human-readable.           -->
          <mods:accessCondition type="license">
            Attribution-NonCommercial-ShareAlike (CC BY-NC-SA)
          </mods:accessCondition>
          <mods:accessCondition type="use and reproduction">
            © 2025 Katarzyna Prokopiuk / PL 3DREKO-22 / CoVHer Repository.
            Licensed under CC BY-NC-SA 4.0.
            Non-commercial use only; derivatives must be shared under the same license; attribution required.
          </mods:accessCondition>

          <!-- ============================================================= -->
          <!-- 10 Original object (Recommended / Visible in Viewer: ✓)       -->
          <!-- ============================================================= -->
          <mods:relatedItem type="original">
            <mods:titleInfo xml:lang="en">
              <mods:title>Volpa Synagogue</mods:title>
            </mods:titleInfo>
            <mods:titleInfo type="translated" xml:lang="pl">
              <mods:title>Synagoga w Wołpie</mods:title>
            </mods:titleInfo>

            <mods:originInfo eventType="production">
              <mods:dateCreated keyDate="yes" encoding="iso8601" qualifier="approximate">1800</mods:dateCreated>
              <mods:dateOther type="destruction">
                Destroyed by German forces in June 1941 or December 1942.
              </mods:dateOther>
            </mods:originInfo>

            <mods:location>
              <mods:physicalLocation valueURI="https://www.wikidata.org/wiki/Q3508102">
                Volpa, Hrodna Region, Belarus.
              </mods:physicalLocation>
            </mods:location>

            <!-- 10.1 Subjects (Optional / Visible in Viewer: ✗) -->
            <mods:subject>
              <mods:topic>synagogue</mods:topic>
              <mods:topic>wooden synagogue architecture</mods:topic>
              <mods:temporal>baroque</mods:temporal>
              <mods:geographic valueURI="https://www.geonames.org/620023">Volpa</mods:geographic>
            </mods:subject>

            <!-- 10.2 Description (Recommended / Visible in Viewer: ✓) -->
            <mods:classification authority="aat">Single Built Work</mods:classification>

            <mods:note type="description" xml:lang="en">
              The Volpa Synagogue was a wooden synagogue in present-day Belarus, probably erected in the
              first half of the 18th century. It underwent several renovations to the roof and aron
              ha-kodesh in 1903–1936 and was listed as a cultural monument in 1929. The hall has a strictly
              symmetrical layout with two-storey corner annexes and an impressive octagonal vault that
              corrects perspective and makes the space appear higher than it is. The interior was covered
              with rich polychrome decoration and the synagogue is regarded as one of the finest examples of
              baroque wooden synagogue architecture.
            </mods:note>

            <mods:note type="currentLocation">
              A full-scale reconstruction based on inventory drawings was built in Biłgoraj (Poland) in 2015.
            </mods:note>
          </mods:relatedItem>

          <!-- ============================================================= -->
          <!-- 00.x Optional non-displayed metadata (not in table)           -->
          <!-- Keep for interoperability / harvesting                         -->
          <!-- ============================================================= -->

          <!-- 00.3 Project / series information (not in table / Visible:✓) -->
          <mods:relatedItem type="series">
            <mods:titleInfo>
              <mods:title>3DREKO-22: Digital 3D Reconstruction of wooden synagogues</mods:title>
            </mods:titleInfo>
          </mods:relatedItem>

          <!-- 00.4 Keywords/topics/classification for the MODEL (not in table / Visible: ✗) -->
          <mods:subject>
            <mods:geographic valueURI="https://www.geonames.org/620023/">Volpa</mods:geographic>
            <mods:geographic valueURI="https://www.geonames.org/630336/">Belarus</mods:geographic>
            <mods:topic>wooden synagogue</mods:topic>
            <mods:topic>Jewish heritage</mods:topic>
            <mods:topic>interwar period</mods:topic>
            <mods:topic>virtual reconstruction</mods:topic>
            <mods:topic>3D model</mods:topic>
          </mods:subject>

          <mods:classification type="category" valueURI="http://vocab.getty.edu/page/aat/300004789">
            single built work
          </mods:classification>
          <mods:classification type="type" valueURI="http://vocab.getty.edu/page/aat/300007590">
            synagogue
          </mods:classification>

          <!-- 00.5 Record info (not in table / Visible: ✗) -->
          <mods:recordInfo>
            <mods:recordIdentifier source="CoVHer Repository">310</mods:recordIdentifier>
            <mods:recordCreationDate encoding="iso8601">2025-05-26</mods:recordCreationDate>
            <mods:recordContentSource>CoVHer Repository</mods:recordContentSource>
            <mods:recordInfoNote>Record curated by Igor Bajena.</mods:recordInfoNote>
          </mods:recordInfo>

          <!-- 00.6 Related textual notes (not in table / Visible: ✗) -->
          <mods:relatedItem type="references">
            <mods:titleInfo>
              <mods:title>Key sources for the reconstruction</mods:title>
            </mods:titleInfo>
            <mods:note>
              Maria and Kazimierz Piechotka, "Bramy Nieba. Bóżnice drewniane na ziemiach dawnej Rzeczypospolitej";
              archival inventory drawings and historic photographs of the Volpa Synagogue.
            </mods:note>
          </mods:relatedItem>

          <mods:relatedItem type="otherFormat">
            <mods:titleInfo>
              <mods:title>Paradata and documentation files</mods:title>
            </mods:titleInfo>
            <mods:note>
              Internal CoVHer paradata files such as Volpa_Presentation_PL.pdf, Sy_Wolpa_dokumentacja.pdf and
              Volpa_IDOVR_documentation describing modelling decisions and interpretation.
            </mods:note>
          </mods:relatedItem>

          <mods:relatedItem type="otherVersion">
            <mods:titleInfo>
              <mods:title>Related reconstruction models and derivatives</mods:title>
            </mods:titleInfo>
            <mods:note>
              Related reconstruction models include 1.1_SyVo_1929-1941 and 2.1_SyVo_1929-1941, as well as derivative
              models for 3D printing and AR derived from the primary reconstruction.
            </mods:note>
          </mods:relatedItem>

        </mods:mods>
      </mets:xmlData>
    </mets:mdWrap>
  </mets:dmdSec>

  <!-- =================================================================== -->
  <!-- AMD (Administrative metadata)                                        -->
  <!-- =================================================================== -->
  <mets:amdSec ID="AMD">

    <!-- =============================================================== -->
    <!-- 03 Technical specification (Optional / Visible in Viewer: ✗)    -->
    <!-- Stored as PREMIS in techMD                                       -->
    <!-- =============================================================== -->
    <mets:techMD ID="TECHMD_0310">
      <mets:mdWrap MDTYPE="OTHER" OTHERMDTYPE="PREMIS" MIMETYPE="text/xml">
        <mets:xmlData>
          <premis:object>
            <premis:objectIdentifier>
              <premis:objectIdentifierType>local</premis:objectIdentifierType>
              <premis:objectIdentifierValue>FILE_0310_MODEL</premis:objectIdentifierValue>
            </premis:objectIdentifier>

            <premis:objectCharacteristics>
              <premis:compositionLevel>0</premis:compositionLevel>
              <premis:fixity>
                <premis:messageDigestAlgorithm>SHA-256</premis:messageDigestAlgorithm>
                <premis:messageDigest>38bb2d3ddab86301fc83c6de99fc11359183c8c0ace6130f80c3e3ea99f50cb8</premis:messageDigest>
              </premis:fixity>
              <premis:size>40605260</premis:size>
              <premis:format>
                <premis:formatDesignation>
                  <premis:formatName>GLB (GL Transmission Format, binary)</premis:formatName>
                </premis:formatDesignation>
              </premis:format>

              <!-- 00.7 Optional mesh metrics extension (not in table) -->
              <premis:objectCharacteristicsExtension>
                <premis:extension>
                  <premis:extensionType>3D-mesh-metrics</premis:extensionType>
                  <premis:extensionValue>
                    vertices=108315; faces=91386;
                    extentsX=2776.004395; extentsY=1875.372803; extentsZ=2435.516968;
                    units=unknown (model units).
                  </premis:extensionValue>
                </premis:extension>
              </premis:objectCharacteristicsExtension>
            </premis:objectCharacteristics>

            <!-- 00.8 Creating application (not in table) -->
            <premis:creatingApplication>
              <premis:creatingApplicationName>Rhino</premis:creatingApplicationName>
              <premis:creatingApplicationVersion>6/7</premis:creatingApplicationVersion>
            </premis:creatingApplication>
            <premis:creatingApplication>
              <premis:creatingApplicationName>Blender</premis:creatingApplicationName>
            </premis:creatingApplication>

          </premis:object>
        </mets:xmlData>
      </mets:mdWrap>
    </mets:techMD>

    <!-- =============================================================== -->
    <!-- 05 Provider (Mandatory / Visible in Viewer: ✓)                   -->
    <!-- Implemented via dv:rights in rightsMD                            -->
    <!-- =============================================================== -->
    <mets:rightsMD ID="RIGHTS">
      <mets:mdWrap MDTYPE="OTHER" OTHERMDTYPE="DVRIGHTS" MIMETYPE="text/xml">
        <mets:xmlData>
          <dv:rights>
            <dv:owner>CoVHer Repository</dv:owner>
            <dv:license>CC BY-NC-SA 4.0</dv:license>
            <dv:ownerLogo>https://repository.covher.eu/sites/default/files/Group-2-1_0.png</dv:ownerLogo>
            <dv:ownerSiteURL>https://repository.covher.eu</dv:ownerSiteURL>
            <dv:ownerContact>https://repository.covher.eu/imprint</dv:ownerContact>
          </dv:rights>
        </mets:xmlData>
      </mets:mdWrap>
    </mets:rightsMD>

    <!-- =============================================================== -->
    <!-- 08 Publication event (Optional / Visible in Viewer: ✗)           -->
    <!-- Here used for "links in dropdown" (OPAC / Local context)         -->
    <!-- =============================================================== -->
    <mets:digiprovMD ID="DIGIPROV">
      <mets:mdWrap MDTYPE="OTHER" OTHERMDTYPE="DVLINKS" MIMETYPE="text/xml">
        <mets:xmlData>
          <dv:links>
            <dv:reference>https://repository.covher.eu/api/digital_reconstruction/record/310</dv:reference>
            <dv:presentation>https://repository.covher.eu/wisski/navigate/310/view</dv:presentation>
          </dv:links>
        </mets:xmlData>
      </mets:mdWrap>
    </mets:digiprovMD>

  </mets:amdSec>

  <!-- =================================================================== -->
  <!-- 12 Files (Mandatory / Visible in Viewer: ✓)                         -->
  <!-- =================================================================== -->
  <mets:fileSec>

    <!-- 12.1 Primary 3D file / Visible in Viewer: ✓) -->
    <mets:fileGrp USE="DEFAULT">
      <mets:file
        ID="FILE_0310_MODEL"
        MIMETYPE="model/gltf-binary"
        CHECKSUM="38bb2d3ddab86301fc83c6de99fc11359183c8c0ace6130f80c3e3ea99f50cb8"
        CHECKSUMTYPE="SHA-256"
        SIZE="40605260">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/Sy_Wolpa_Model3D-1-.glb"/>
      </mets:file>
    </mets:fileGrp>

    <!-- 12.2 Preview images / Visible in Viewer: ✗)-->
    <mets:fileGrp USE="THUMBS">
      <mets:file ID="FILE_0310_THUMB_MAIN" MIMETYPE="image/png">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/views/Sy_Wolpa_Model3D-1-_side45.png"/>
      </mets:file>
      <mets:file ID="FILE_0310_THUMB_0" MIMETYPE="image/png">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/views/Sy_Wolpa_Model3D-1-_side0.png"/>
      </mets:file>
      <mets:file ID="FILE_0310_THUMB_90" MIMETYPE="image/png">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/views/Sy_Wolpa_Model3D-1-_side90.png"/>
      </mets:file>
      <mets:file ID="FILE_0310_THUMB_180" MIMETYPE="image/png">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/views/Sy_Wolpa_Model3D-1-_side180.png"/>
      </mets:file>
      <mets:file ID="FILE_0310_THUMB_TOP" MIMETYPE="image/png">
        <mets:FLocat LOCTYPE="URL" xlink:href="https://repository.covher.eu/sites/default/files/2025-05/views/Sy_Wolpa_Model3D-1-_top.png"/>
      </mets:file>
    </mets:fileGrp>

  </mets:fileSec>

  <!-- =================================================================== -->
  <!-- Structure maps (Viewer navigation)                                  -->
  <!-- =================================================================== -->
  <mets:structMap TYPE="LOGICAL">
    <mets:div
      ID="LOG_0310"
      TYPE="object"
      LABEL="Volpa Synagogue (1929–1941) reconstructed by Katarzyna Prokopiuk"
      DMDID="DMDLOG_0310"/>
  </mets:structMap>

  <mets:structMap TYPE="PHYSICAL">
    <mets:div ID="PHYS_ROOT" TYPE="physSequence">
      <mets:div ID="PHYS_0310" TYPE="object" ORDER="1" ORDERLABEL="1">
        <mets:fptr FILEID="FILE_0310_MODEL"/>
        <mets:fptr FILEID="FILE_0310_THUMB_MAIN"/>
      </mets:div>
    </mets:div>
  </mets:structMap>

  <!-- =============================================================== -->
  <!-- 13 Related items / linking (Optional / Visible in Viewer: ? )    -->
  <!-- =============================================================== -->
  <mets:structLink>
    <mets:smLink xlink:from="LOG_0310" xlink:to="PHYS_0310"/>
  </mets:structLink>

</mets:mets>
`.trim();
};
