# Metadata recommendation for 3D data within  DFG 3D-Viewer framework

## Version 1.0 – 25.02.2025

1. **Title (mandatory)**

3D object title should indicate with what kind of model user dealing with. 

* For digitisation models, which capture current phase of the object, title can cover just the identification of the object. 

* For 3D visualisations of concepts, which exists only in their carriers, title should indicate that model present concept, which have never been realised and contain information about concept creator (if it's available) 

* For 3D models, which visualise past phases of the object, time coverage should be indicated in the title. It can be achieved by adding "as it was in (time coverage)", or by describing phase of the object, which is visualised (for example, gothic phase).

* For hypothetical models of visualisation of past, or concepts, which have been never realised, and have multiple possible variants, the title of the variant should be indicated or in the title, or as subtitle attribute.

It would be recommended to provide information about language in which title is presented.

2. **Genre (optional)**

Optionally, you can include information about the disciplinary context in which the model was created, e.g. architecture, archaeology, art history, etc. It is recommended to include a reference to controlled vocabularies here.	

3. **Specification (mandatory)**

The specification should describe the basic technical properties of the 3D model, which allow the data to be filtered within the aggregator. The mandatory properties include:

* File size  
* Number of vertices and polygons (if applicable)  
* Model type

Model types should be defined based on the publication *“3D Data Creation to Curation: Community Standards for 3D Data Preservation”* (Moore, Rountrey & Kettler, 2022), which distinguishes between:

* Mesh  
* Point cloud  
* Voxel data

Additionally, it is necessary to specify the time phase of the object (e.g., contemporary, past, conceptual, etc.). For objects that have undergone multiple changes over time, the specific phase represented in the model should be indicated (e.g., Romanesque, Gothic). It is also recommended to provide an exact time frame depicted by the model (e.g., 1500–1550).

4. **Creator (mandatory)**

If information about the reconstruction's creator (person) is available, it should be provided. If the creator's details are unavailable, the institution whose employees created the 3D model may be listed as the creator. In any case, authorship information is required. The minimal input should cover name and surname as one or two separate fields. 

It is recommended to provide the person's identifier as a URI whenever possible. If available, multiple identifiers, such as ORCID, GND, VIAF, or Wikidata, may be included.

5. **Provider (mandatory)**

Information about the data provider for the 3D model is required. The minimum input should contain the institution's name. It is recommended that an identifier based on authority files, the institution's contact details, and its logo be provided. Multiple identifiers may be included if available.

6. **Digitisation Event (conditionally recommended)**

This section provides information about the event when raw data was collected from the original object for digitisation. In photogrammetry, \#this refers to the moment the photos were taken; for scans, it is the date of scanning. This should not be confused with the **creation event**, which refers to the final 3D model's completion after data processing and editing.

Providing this information is recommended but applies **only** to models obtained through the digitisation of an existing monument or those created using a combination of methods that include digitisation. It **does not apply** to models illustrating a past state based on historical sources, hypothetical reconstructions, or purely imaginative creations. The description of the digitisation event should include:

* The institutions and individuals involved, along with their roles,  
* The date of completion,  
* The place,  
* A description of the technique used, and  
* Details of the equipment employed.

7. **Creation Event (recommended)**

This section provides information about the 3D file creation event. It should not be confused with the digitisation event, which refers to the acquisition of raw data. The creation event can be described as the period of work on the file or the date of completion of modelling or data processing.

It is recommended to include the names of the individuals and institutions involved, along with their roles. If the 3D model creation event is part of a larger project, it is advisable to reference the project by providing its name, website, and main objectives. Additionally, it is recommended to specify the software used for creating the model and the modelling techniques applied.

8. **Publication Event (conditionally mandatory)**

An event describing the publication of a 3D model in a repository that generates data export. It should contain information about who published the data and when. It is recommended to provide the URI of the resulting record and basic repository data (name, URL, logo). 

9. **Description (optionalmandatory)**

A brief description of the model’s content, how it was created, and key information about the original object. This description is meant to be easily readable by people, not machines, and does not affect the indexing process.

10. **Original object (conditionally mandatory)**

If the model represents a real object, basic information about it must be provided. At a minimum, this includes the object's name and *creation*  or period of object’s origin Additionally, the object must be classified according to scale. The classification system, developed in the first phase of the DFG 3D-Viewer project based on selected items from the Getty AAT, consists of the following categories:

* Settlements & Landscapes

* Complexes & Districts

* Open (public) Spaces

* Single Built Work

* Building Component

* Furnishings & Equipment

* General Object

Furthermore, the object's specific type must be defined with a reference to its Getty AAT identifier. The current state of the object (e.g., destroyed, preserved, ruined, modified, intact, restored, reconstructed, etc.) should also be specified. Information about the object's creator, founder, or contractor should be included where possible. Both historical figures and the object should be linked to authority file identifiers, and multiple identifiers may be provided if available.

Geocoordinates should be provided for objects with a fixed location (such as buildings, landscapes, and cities). For objects with a variable location (e.g., sculptures, artworks, or archaeological finds), it is recommended to specify the place of creation, the place of discovery, and the institution currently holding the object. In the case of unrealised concepts, existing media should be identified and linked using available identifiers. If possible, the current holder of the concept media should also be indicated.

Additionally, it is acceptable to include physical attributes of the object, such as dimensions, architectural or artistic style, and materials.

11. **Copyrights (mandatory)**

Licensing and Attribution Requirements:

1. License Declaration: Every 3D model must clearly state the license under which it is made available. This declaration informs users of their rights and obligations concerning the model's use.

2. Author or Data Provider Attribution: If the chosen license mandates attribution, the model must include a 'Copyright Statement' detailing the author's or data provider's information. This ensures creators receive appropriate credit for their work.

3. Absence of License or Attribution: Models lacking a clear license or necessary attribution (when required by the license) are prohibited from being displayed in the viewer. This measure protects intellectual property rights and maintains legal compliance.

Best Practices for Licensing and Attribution:

* Utilize Standard Licenses: Employ widely recognized licenses, such as those from Creative Commons, to provide clarity on usage rights. For instance, the Creative Commons Attribution (CC BY) license allows others to use, distribute, and build upon the work, provided proper credit is given.

* Embed License Information: Incorporate license details directly within the model's metadata or associated documentation. This practice ensures that licensing information remains intact, even if the model is shared or modified.

* Provide Clear Attribution: When required, include a comprehensive 'Copyright Statement' that specifies the creator's name, the title of the work, a link to the license, and a disclaimer if modifications were made. The Creative Commons best practices for attribution offer detailed guidance on crafting appropriate acknowledgments.

By adhering to these guidelines, the DFG 3D-Viewer can foster a respectful and legally compliant environment for sharing and utilizing 3D models.

12. **Files (mandatory)**

To ensure proper linkage, format specification, and detailed descriptions for 3D model files, certain requirements must be met. The minimum requirement is to provide a direct link to the 3D model file intended for display in the viewer, with **.glb** or **.gltf** formats being the recommended options due to their efficiency and compatibility. Additionally, a link to a preview image of the model must be included to offer users a visual reference before loading the full 3D content.

Each file should have its type and format indicated according to the MIME specification. For 3D model files, the appropriate MIME types are model/gltf-binary for .glb files and model/gltf+json for .gltf files, while preview images should use standard MIME types such as image/png or image/jpeg, depending on the format.It is allowed to include links to additional resources, such as native file formats, raw data, or derivative works. In such cases, each supplementary file should be accompanied by a description that explains what it is, specifies its format, states what software was used in its creation, and clarifies its intended purpose. These details ensure transparency and help users understand the relevance of each file in relation to the primary 3D model.

If permitted by the license, these resources can be made available for download. Clear licensing information should always be provided to determine whether files can be freely shared or redistributed. 

13. **Related items (optional)**

When establishing relational links between 3D models, whether for multiple versions, variations, or different phases of the same object, these connections should be explicitly described by specifying the type of relationship. Each reference must include the title of the model, a preview image, and the names of its authors. Additionally, an XML file containing the METS/MODS description of the resource should be provided to ensure structured metadata and interoperability. Clearly defining these relationships enhances the organization and accessibility of related 3D models, allowing for a more comprehensive representation of the object's different states or versions.

