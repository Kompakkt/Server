import type { IEntity } from '@kompakkt/common';
import { Configuration } from 'src/configuration';
import type { DfgMetsExtensionData } from './types';
import mime from 'mime';

const LICENSE_MAP: Record<string, { name: string; url: string }> = {
  BY: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  BYSA: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  BYNC: { name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  BYNCSA: {
    name: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  BYND: { name: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  BYNCND: {
    name: 'CC BY-NC-ND 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  },
};

const MODEL_TYPE_MAP: Record<string, string> = {
  '.glb': 'Mesh',
  '.gltf': 'Mesh',
  '.obj': 'Mesh',
  '.fbx': 'Mesh',
  '.stl': 'Mesh',
  '.ply': 'Point Cloud',
  '.las': 'Point Cloud',
  '.laz': 'Point Cloud',
  '.e57': 'Point Cloud',
  '.vox': 'Voxel',
  '.spx': '3D Gaussian Splatting',
  '.spz': '3D Gaussian Splatting',
};

const getLicenseInfo = (code: string) => LICENSE_MAP[code] ?? { name: code, url: '' };

const getModelType = (fileFormat: string): string =>
  MODEL_TYPE_MAP[fileFormat.toLowerCase()] ?? 'Mesh';

const getMimeType = (fileName: string): string =>
  mime.getType(fileName) ?? 'application/octet-stream';

const makeAbsoluteUrl = (path: string): string =>
  new URL(`/server/${path}`, Configuration.Server.PublicURL).toString();

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildMets = async ({ entity }: { entity: IEntity<DfgMetsExtensionData, true> }) => {
  const digitalEntity = entity.relatedDigitalEntity;
  const entityId = entity._id;
  const title = escapeXml(entity.name);
  const description = digitalEntity.description ? escapeXml(digitalEntity.description) : '';
  const licenseCode = digitalEntity.licence ?? '';
  const licenseInfo = getLicenseInfo(licenseCode);

  const persons = digitalEntity.persons ?? [];
  const institutions = digitalEntity.institutions ?? [];
  const files = entity.files ?? [];

  const creators = persons.filter(p =>
    Object.values(p.roles).some(roles => roles.some(r => r === 'CREATOR' || r === 'DATA_CREATOR')),
  );

  const funderInstitutions = institutions.filter(inst =>
    Object.values(inst.roles).some(roles => roles.includes('RIGHTS_OWNER')),
  );

  const primaryModelFile = files.find(f => entity.processed.raw.includes(f.file_name));

  const modelUrl = primaryModelFile ? makeAbsoluteUrl(primaryModelFile.file_link) : '';
  const modelType = primaryModelFile ? getModelType(primaryModelFile.file_format) : 'Mesh';

  const previewPath = entity.settings?.preview;
  const previewUrl = previewPath ? makeAbsoluteUrl(previewPath) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
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
  <mets:dmdSec ID="DMDLOG_${entityId}">
    <mets:mdWrap MDTYPE="MODS">
      <mets:xmlData>
        <mods:mods>

          <!-- ============================================================= -->
          <!-- 01 Title (Mandatory / Visible in Viewer: ✓)                   -->
          <!-- ============================================================= -->
          <mods:titleInfo xml:lang="en">
            <mods:title>${title}</mods:title>
          </mods:titleInfo>

          <!-- ============================================================= -->
          <!-- 02 Genre (Optional / Visible in Viewer: ✓)                    -->
          <!-- ============================================================= -->
${
  (digitalEntity.discipline ?? []).length > 0
    ? digitalEntity.discipline
        .map(d => `          <mods:genre>${escapeXml(d)}</mods:genre>`)
        .join('\n')
    : ''
}

          <!-- ============================================================= -->
          <!-- 04 Creator (Mandatory / Visible in Viewer: ✓)                 -->
          <!-- ============================================================= -->
${
  creators.length > 0
    ? creators
        .map(
          p => `          <mods:name type="personal">
            <mods:namePart type="family">${escapeXml(p.name)}</mods:namePart>
            <mods:namePart type="given">${escapeXml(p.prename)}</mods:namePart>
            <mods:role>
              <mods:roleTerm type="code" authority="marcrelator">aut</mods:roleTerm>
            </mods:role>
          </mods:name>`,
        )
        .join('\n')
    : ''
}
${
  funderInstitutions.length > 0
    ? funderInstitutions
        .map(
          inst => `
          <mods:name type="corporate">
            <mods:displayForm>${escapeXml(inst.name)}${inst.university ? `, ${escapeXml(inst.university)}` : ''}</mods:displayForm>
            <mods:role>
              <mods:roleTerm authority="marcrelator" type="code">fnd</mods:roleTerm>
            </mods:role>
          </mods:name>`,
        )
        .join('\n')
    : ''
}

          <!-- ============================================================= -->
          <!-- 09 Description (Recommended / Visible in Viewer: ✓)           -->
          <!-- ============================================================= -->
${
  description
    ? `          <mods:abstract xml:lang="en">
            ${description}
          </mods:abstract>`
    : ''
}

          <!-- ============================================================= -->
          <!-- 11 Copyrights / License (Mandatory / Visible in Viewer: ✓)    -->
          <!-- ============================================================= -->
          <mods:accessCondition
            type="use and reproduction"
            displayLabel="${escapeXml(licenseInfo.name)}"
            xlink:type="simple"
            xlink:href="${escapeXml(licenseInfo.url)}">
            ${escapeXml(licenseInfo.name)}
          </mods:accessCondition>

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
    <mets:techMD ID="TECHMD_${entityId}">
      <mets:mdWrap MDTYPE="OTHER" OTHERMDTYPE="PREMIS" MIMETYPE="text/xml">
        <mets:xmlData>
          <premis:object>
            <premis:objectIdentifier>
              <premis:objectIdentifierType>local</premis:objectIdentifierType>
              <premis:objectIdentifierValue>FILE_${entityId}_MODEL</premis:objectIdentifierValue>
            </premis:objectIdentifier>

            <premis:objectCharacteristics>
              <premis:compositionLevel>0</premis:compositionLevel>
${
  primaryModelFile
    ? `              <premis:size>${primaryModelFile.file_size}</premis:size>
              <premis:format>
                <premis:formatDesignation>
                  <premis:formatName>${escapeXml(modelType)}</premis:formatName>
                </premis:formatDesignation>
              </premis:format>`
    : ''
}
            </premis:objectCharacteristics>

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
${
  funderInstitutions.length > 0
    ? funderInstitutions
        .map(
          inst =>
            `            <dv:owner>${escapeXml(inst.name)}${inst.university ? `, ${escapeXml(inst.university)}` : ''}</dv:owner>`,
        )
        .join('\n')
    : ''
}
            <dv:license>${escapeXml(licenseInfo.name)}</dv:license>
          </dv:rights>
        </mets:xmlData>
      </mets:mdWrap>
    </mets:rightsMD>

  </mets:amdSec>

  <!-- =================================================================== -->
  <!-- 12 Files (Mandatory / Visible in Viewer: ✓)                         -->
  <!-- =================================================================== -->
  <mets:fileSec>

    <!-- 12.1 Primary 3D file / Visible in Viewer: ✓) -->
    <mets:fileGrp USE="DEFAULT">
${
  primaryModelFile
    ? `      <mets:file
        ID="FILE_${entityId}_MODEL"
        MIMETYPE="${getMimeType(primaryModelFile.file_name)}"
        SIZE="${primaryModelFile.file_size}">
        <mets:FLocat LOCTYPE="URL" xlink:href="${escapeXml(modelUrl)}"/>
      </mets:file>`
    : ''
}
    </mets:fileGrp>

    <!-- 12.2 Preview images / Visible in Viewer: ✗)-->
    <mets:fileGrp USE="THUMBS">
${
  previewPath
    ? `      <mets:file ID="FILE_${entityId}_THUMB_MAIN" MIMETYPE="${getMimeType(previewPath)}">
        <mets:FLocat LOCTYPE="URL" xlink:href="${escapeXml(previewUrl)}"/>
      </mets:file>`
    : ''
}
    </mets:fileGrp>

  </mets:fileSec>

  <!-- =================================================================== -->
  <!-- Structure maps (Viewer navigation)                                  -->
  <!-- =================================================================== -->
  <mets:structMap TYPE="LOGICAL">
    <mets:div
      ID="LOG_${entityId}"
      TYPE="object"
      LABEL="${title}"
      DMDID="DMDLOG_${entityId}"/>
  </mets:structMap>

  <mets:structMap TYPE="PHYSICAL">
    <mets:div ID="PHYS_ROOT" TYPE="physSequence">
      <mets:div ID="PHYS_${entityId}" TYPE="object" ORDER="1" ORDERLABEL="1">
${primaryModelFile ? `        <mets:fptr FILEID="FILE_${entityId}_MODEL"/>` : ''}
${previewPath ? `        <mets:fptr FILEID="FILE_${entityId}_THUMB_MAIN"/>` : ''}
      </mets:div>
    </mets:div>
  </mets:structMap>

  <!-- =============================================================== -->
  <!-- 13 Related items / linking (Optional / Visible in Viewer: ? )    -->
  <!-- =============================================================== -->
  <mets:structLink>
    <mets:smLink xlink:from="LOG_${entityId}" xlink:to="PHYS_${entityId}"/>
  </mets:structLink>

</mets:mets>`.trim();
};
