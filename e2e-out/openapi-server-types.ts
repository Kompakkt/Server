export type paths = {
  '/server/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint */
    get: operations['getServerHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/cologne-cave-api/all-entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieve all CAVE compatible entities that are marked as online and finished, with optional pagination. CAVE: https://itcc.uni-koeln.de/en/hpc/visualization/cave */
    get: operations['getServerCologne-cave-apiAll-entities'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/dfg-mets-api/entity/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieve a specific entity by ID if it has DFG METS sharing enabled, returning METS/MODS XML format. Requires valid API key. */
    get: operations['getServerDfg-mets-apiEntityById'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/dfg-mets-api/entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves a list of entities with DFG METS sharing enabled. Requires valid API key. */
    get: operations['getServerDfg-mets-apiEntities'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/oidc/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint for OIDC authentication service */
    get: operations['getServerOidcHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/oidc/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Initiates OIDC authentication flow */
    get: operations['getServerOidcLogin'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/oidc/callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Callback endpoint for OIDC authentication */
    get: operations['getServerOidcCallback'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sketchfab-import/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint to verify the service is running. */
    get: operations['getServerSketchfab-importHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sketchfab-import/model-info/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Fetches detailed information about a specific Sketchfab model using its ID. */
    get: operations['getServerSketchfab-importModel-infoById'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sketchfab-import/get-models': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postServerSketchfab-importGet-models'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sketchfab-import/download-and-prepare-model': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postServerSketchfab-importDownload-and-prepare-model'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sso-nfdi4culture/actions/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Registers an action for a given token, which can be retrieved later. The action must be a Base64 encoded JSON string. Used internally for handling user intention during the SAML authentication flow. */
    get: operations['getServerSso-nfdi4cultureActionsRegister'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sso-nfdi4culture/actions/retrieve': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves and deletes the action associated with the given token. Used internally after the SAML authentication flow to determine the user's intended action. */
    get: operations['getServerSso-nfdi4cultureActionsRetrieve'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sso-nfdi4culture/saml/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint for the SAML authentication service. */
    get: operations['getServerSso-nfdi4cultureSamlHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sso-nfdi4culture/saml': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Initiates the SAML authentication flow by redirecting the user to the Identity Provider's login page. */
    get: operations['getServerSso-nfdi4cultureSaml'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/auth/saml/callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Callback endpoint for SAML authentication. This is the endpoint that the Identity Provider will redirect to after the user has authenticated. It processes the SAML response, logs the user in, and redirects them to the homepage. */
    post: operations['postServerUser-managementAuthSamlCallback'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/sso-nfdi4culture/saml/callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Callback endpoint for SAML authentication. This is the endpoint that the Identity Provider will redirect to after the user has authenticated. It processes the SAML response, logs the user in, and redirects them to the homepage. */
    post: operations['postServerSso-nfdi4cultureSamlCallback'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/wikibase/parsed-model': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to retrieve the parsed Wikibase model */
    get: operations['getServerWikibaseParsed-model'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/wikibase/choices/metadata': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to retrieve choices for Wikibase metadata fields used in frontend */
    get: operations['getServerWikibaseChoicesMetadata'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/wikibase/choices/annotation-link': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to retrieve choices for annotation link fields used in frontend */
    get: operations['getServerWikibaseChoicesAnnotation-link'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/wikibase/instance/info': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to retrieve basic information about the Wikibase instance */
    get: operations['getServerWikibaseInstanceInfo'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/digest': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get a digest of entities created within a specific time range */
    post: operations['postServerAdminDigest'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/stats': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get statistics about the database collections */
    post: operations['postServerAdminStats'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/getusers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get all users with limited data */
    post: operations['postServerAdminGetusers'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/getuser/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get a specific user by identifier with limited data */
    post: operations['postServerAdminGetuserByIdentifier'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/promoteuser': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Promote a user to a different role */
    post: operations['postServerAdminPromoteuser'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/togglepublished': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Toggle the online/published status of an entity */
    post: operations['postServerAdminTogglepublished'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/admin/resetpassword/{username}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Request a password reset for a user by username */
    post: operations['postServerAdminResetpasswordByUsername'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/login/{strategy}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to log in a user using the specified strategy. Returns user data upon successful authentication. */
    post: operations['postServerUser-managementLoginByStrategy'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to log in a user using the specified strategy. Returns user data upon successful authentication. */
    post: operations['postServerUser-managementLogin'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to register a new user. The first ever registered user gets admin privileges. A welcome email is sent upon successful registration. */
    post: operations['postServerUser-managementRegister'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to log out the user. */
    get: operations['getServerUser-managementLogout'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/auth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Endpoint to check if the user is authenticated and retrieve their user data. */
    get: operations['getServerUser-managementAuth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/help/request-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to request a password reset, which generates a token and sends it via email to the user. */
    post: operations['postServerUser-managementHelpRequest-reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/help/confirm-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to confirm a password reset request using a token sent via email. */
    post: operations['postServerUser-managementHelpConfirm-reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/user-management/help/forgot-username': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Endpoint to request a reminder of the username associated with an email address. */
    post: operations['postServerUser-managementHelpForgot-username'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/utility/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint */
    get: operations['getServerUtilityHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/utility/countentityuses/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Count the number of times an entity is used in compilations */
    get: operations['getServerUtilityCountentityusesById'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/utility/generate-entity-video-preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Generate a video preview for an entity based on provided screenshots. You must have access to the entity to use this endpoint. */
    post: operations['postServerUtilityGenerate-entity-video-preview'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/utility/checksumexists': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * @deprecated
     * @description This endpoint is deprecated and will be removed in a future version. It always returns existing: false.
     */
    post: operations['postServerUtilityChecksumexists'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/utility/moveannotations/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Move annotations from one entity to another by providing a list of annotation IDs. The endpoint will return the updated compilation with the moved annotations. */
    post: operations['postServerUtilityMoveannotationsById'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint */
    get: operations['getServerApiV1Health'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/get/find/{collection}/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Find a single entity in a collection, and decode it with the provided password */
    get: operations['getServerApiV1GetFindByCollectionByIdentifier'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/get/find/{collection}/{identifier}/{password}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Find a single entity in a collection, and decode it with the provided password */
    get: operations['getServerApiV1GetFindByCollectionByIdentifierByPassword'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/get/findall/{collection}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Find all entities in a collection */
    get: operations['getServerApiV1GetFindallByCollection'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/get/id': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get a new ObjectId */
    get: operations['getServerApiV1GetId'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/post/explore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * @deprecated
     * @description Deprecation notice: This endpoint will be removed in the future. Switch to the API V2 Explore endpoint. Explore entities or compilations based on search criteria
     */
    post: operations['postServerApiV1PostExplore'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/post/remove/{collection}/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Remove an entity from a collection */
    post: operations['postServerApiV1PostRemoveByCollectionByIdentifier'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/get/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get all users with stripped data */
    get: operations['getServerApiV1GetUsers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/post/push/{collection}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Push an entity to a collection */
    post: operations['postServerApiV1PostPushByCollection'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v1/post/settings/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Update settings of an entity */
    post: operations['postServerApiV1PostSettingsByIdentifier'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint */
    get: operations['getServerApiV2Health'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/user-data/{collection}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves user data from the specified collection, resolving document IDs to full documents if requested. */
    get: operations['getServerApiV2User-dataByCollection'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/user-data/update-entity-access': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Updates the access permissions for an entity, ensuring at least one owner remains. */
    post: operations['postServerApiV2User-dataUpdate-entity-access'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/user-data/transfer-ownership': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Transfers ownership of an entity or compilation to another user, removing the current user as owner and ensuring the target user is set as the new owner. */
    post: operations['postServerApiV2User-dataTransfer-ownership'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Health check endpoint */
    get: operations['getServerApiV2ProfileHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/user-of-profile/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Finds the user associated with a given profile ID. */
    get: operations['getServerApiV2ProfileUser-of-profileById'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/via-id/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves a user or organization profile via id. */
    get: operations['getServerApiV2ProfileVia-idById'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/organization': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Creates a new organizational profile. */
    post: operations['postServerApiV2ProfileOrganization'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/organization/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Updates an existing organizational profile. */
    post: operations['postServerApiV2ProfileOrganizationById'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/profile/user': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Updates the logged-in user's profile with the provided data. */
    post: operations['postServerApiV2ProfileUser'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/list-entity-formats': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Lists all unique file formats of processed entities. */
    get: operations['getServerApiV2List-entity-formats'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/entities-by-format/{formats}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves entities that match the specified file formats, filtering by processed raw paths. */
    get: operations['getServerApiV2Entities-by-formatByFormats'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/explore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Explore entities (objects) and compilations (collections) on various filters. */
    post: operations['postServerApiV2Explore'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/explore-popular-searches': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Retrieves the most popular search queries for a given collection. */
    get: operations['getServerApiV2Explore-popular-searches'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/remove-self-from-access/{collection}/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Removes the logged-in user from editor or viewer to no special access on the specified document. The user must be either editor or viewer to use this endpoint. */
    post: operations['postServerApiV2Remove-self-from-accessByCollectionByIdentifier'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/compilation/create-empty': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Creates an empty compilation that can be added to with the normal compilation update endpoint. */
    post: operations['postServerApiV2CompilationCreate-empty'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/compilation/update-metadata': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Updates the metadata of a compilation, such as name and description. The user must have editor access to the compilation. */
    post: operations['postServerApiV2CompilationUpdate-metadata'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/compilation/add-entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Adds entities to one or more compilations. The user must have edit access to the compilation and at least viewer access to the entities. */
    post: operations['postServerApiV2CompilationAdd-entities'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/api/v2/compilation/remove-entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Removes entities from a compilation. The user must have edit access to the compilation. */
    post: operations['postServerApiV2CompilationRemove-entities'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/mail/sendmail': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Send a mail to a target */
    post: operations['postServerMailSendmail'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/mail/getmailentries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get all mail entries from the database */
    post: operations['postServerMailGetmailentries'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/mail/toggleanswered/{target}/{identifier}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Toggle the answered status of a mail entry */
    post: operations['postServerMailToggleansweredByTargetByIdentifier'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/uploads/*': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Serve uploaded files with on-the-fly compression */
    get: operations['getServerUploads*'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/download/options/{entityId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get available download options and file types for an entity */
    get: operations['getServerDownloadOptionsByEntityId'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/download/prepare/{entityId}/{type}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Prepare a ZIP archive for download and receive progress updates as a stream. The response is a stream of newline-delimited progress values between 0 and 1, followed by a final "1" when the archive is ready. */
    get: operations['getServerDownloadPrepareByEntityIdByType'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/download/{entityId}/{type}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Download the prepared ZIP archive for an entity. The archive must have been prepared using the /download/prepare endpoint. */
    get: operations['getServerDownloadByEntityIdByType'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/chunk/init': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Initialize a new chunked upload session and receive a unique uploadId for subsequent chunk uploads. */
    post: operations['postServerUploadChunkInit'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/chunk/upload': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Upload a chunk of a file for a given uploadId. */
    post: operations['postServerUploadChunkUpload'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/chunk/finish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Finish a chunked upload by assembling all chunks into the final file. */
    post: operations['postServerUploadChunkFinish'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/file': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * @deprecated
     * @description Upload a file directly without chunking. Deprecated in favor of chunked uploads for stability with large files.
     */
    post: operations['postServerUploadFile'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/process/start': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Start processing uploaded files with Kompressor (internal pre-processing service) if needed. Checks if processing is required based on file types and existing processed files, and initiates processing by calling the Kompressor service. */
    post: operations['postServerUploadProcessStart'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/process/info': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Get processing progress information from Kompressor for a given upload. This endpoint queries the Kompressor service for the current processing state and progress percentage of the uploaded files. */
    post: operations['postServerUploadProcessInfo'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/finish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Finalize the upload process by retrieving the list of uploaded files, checking for processed versions, and returning the final file information. This endpoint is called after processing is complete to get the final file details for the uploaded entity. */
    post: operations['postServerUploadFinish'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/server/upload/cancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Cancel an ongoing upload by deleting the temporary upload directory. This endpoint allows clients to cancel an upload session and clean up any uploaded chunks or files associated with the given uploadId. */
    post: operations['postServerUploadCancel'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
  'getServerHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
    };
  };
  'getServerCologne-cave-apiAll-entities': {
    parameters: {
      query: {
        key: string;
        limit?: number;
        offset?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Array of CAVE compatible entities that are marked as online and finished */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerDfg-mets-apiEntityById': {
    parameters: {
      query: {
        key: string;
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description METS/MODS XML representation of the entity if found and sharing enabled */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/plain': string;
        };
      };
      /** @description Response for status 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerDfg-mets-apiEntities': {
    parameters: {
      query: {
        key: string;
        limit?: number;
        offset?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @description Entity ID */
            _id: string;
            /** @description Entity name */
            name: string;
            /** @description Description of the related digital entity */
            description: string;
            /** @description URL to the entity thumbnail */
            thumbnailUrl: string;
            /** @description URL to the entity in Kompakkt */
            kompakktUrl: string;
            /** @description URL to retrieve the METS/MODS XML for this entity */
            metsUrl: string;
          }[];
        };
      };
    };
  };
  'getServerOidcHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerOidcLogin': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: {
        oidc_state?: string;
        oidc_code_verifier?: string;
      };
    };
    requestBody?: never;
    responses: never;
  };
  'getServerOidcCallback': {
    parameters: {
      query?: {
        code?: string;
        state?: string;
      };
      header?: never;
      path?: never;
      cookie?: {
        oidc_code_verifier?: string;
        oidc_state?: string;
      };
    };
    requestBody?: never;
    responses: never;
  };
  'getServerSketchfab-importHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerSketchfab-importModel-infoById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerSketchfab-importGet-models': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Sketchfab API token */
          token: string;
        };
        'application/x-www-form-urlencoded': {
          /** @description Sketchfab API token */
          token: string;
        };
        'multipart/form-data': {
          /** @description Sketchfab API token */
          token: string;
        };
      };
    };
    responses: never;
  };
  'postServerSketchfab-importDownload-and-prepare-model': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Sketchfab API token */
          token: string;
          /** @description Sketchfab model ID */
          modelId: string;
        };
        'application/x-www-form-urlencoded': {
          /** @description Sketchfab API token */
          token: string;
          /** @description Sketchfab model ID */
          modelId: string;
        };
        'multipart/form-data': {
          /** @description Sketchfab API token */
          token: string;
          /** @description Sketchfab model ID */
          modelId: string;
        };
      };
    };
    responses: never;
  };
  'getServerSso-nfdi4cultureActionsRegister': {
    parameters: {
      query: {
        token: string;
        action: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerSso-nfdi4cultureActionsRetrieve': {
    parameters: {
      query: {
        token: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerSso-nfdi4cultureSamlHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerSso-nfdi4cultureSaml': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerUser-managementAuthSamlCallback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          SAMLResponse: string;
        };
        'application/x-www-form-urlencoded': {
          SAMLResponse: string;
        };
        'multipart/form-data': {
          SAMLResponse: string;
        };
      };
    };
    responses: never;
  };
  'postServerSso-nfdi4cultureSamlCallback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          SAMLResponse: string;
        };
        'application/x-www-form-urlencoded': {
          SAMLResponse: string;
        };
        'multipart/form-data': {
          SAMLResponse: string;
        };
      };
    };
    responses: never;
  };
  'getServerWikibaseParsed-model': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerWikibaseChoicesMetadata': {
    parameters: {
      query?: {
        force?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerWikibaseChoicesAnnotation-link': {
    parameters: {
      query?: {
        force?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerWikibaseInstanceInfo': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerAdminDigest': {
    parameters: {
      query: {
        from: number;
        to: number;
        finished?: boolean;
        restricted?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminStats': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminGetusers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminGetuserByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        identifier: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminPromoteuser': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          identifier: string;
          /** @enum {string} */
          role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          identifier: string;
          /** @enum {string} */
          role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
          username: string;
          password: string;
        };
        'multipart/form-data': {
          identifier: string;
          /** @enum {string} */
          role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminTogglepublished': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          identifier: string;
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          identifier: string;
          username: string;
          password: string;
        };
        'multipart/form-data': {
          identifier: string;
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerAdminResetpasswordByUsername': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        username: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'postServerUser-managementLoginByStrategy': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        strategy: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Represents a registered user with profile links, authentication strategy, and ownership references to all collection types. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            _id: string;
          } & {
            username: string;
            fullname: string;
            prename: string;
            surname: string;
            mail: string;
            /**
             * @description Defines the rank of a user, which can be either "uploader" or "admin".
             * @default uploader
             * @enum {string}
             */
            role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
            strategy: string;
            sessionID?: string;
            data: {
              address?: (
                | ({
                    _id: string;
                  } & {
                    building: string;
                    number: string;
                    street: string;
                    postcode: string;
                    city: string;
                    country: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              annotation?: (
                | ({
                    _id: string;
                  } & {
                    validated: boolean;
                    identifier: string;
                    ranking: number;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    creator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    created: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    generator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    generated?: string;
                    motivation: string;
                    lastModificationDate?: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    lastModifiedBy: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    positionXOnView?: number;
                    positionYOnView?: number;
                    /** @description Annotation body with a type discriminator and the actual content block. */
                    body: {
                      type: string;
                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                      content: {
                        type: string;
                        title: string;
                        description: string;
                        link?: string;
                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                        relatedPerspective: {
                          cameraType: string;
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          position:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          target:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          preview: string;
                        };
                      } & {
                        [key: string]: unknown;
                      };
                    };
                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                    target: {
                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                      source: {
                        link?: string;
                        relatedEntity: string;
                        relatedCompilation?: string;
                      };
                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                      selector: {
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referencePoint:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referenceNormal:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                      };
                    };
                    extensions?: {
                      [key: string]: unknown;
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              compilation?: (
                | ({
                    annotations: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            validated: boolean;
                            identifier: string;
                            ranking: number;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            creator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            created: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            generator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            generated?: string;
                            motivation: string;
                            lastModificationDate?: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            lastModifiedBy: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            positionXOnView?: number;
                            positionYOnView?: number;
                            /** @description Annotation body with a type discriminator and the actual content block. */
                            body: {
                              type: string;
                              /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                              content: {
                                type: string;
                                title: string;
                                description: string;
                                link?: string;
                                /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                relatedPerspective: {
                                  cameraType: string;
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  position:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  target:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  preview: string;
                                };
                              } & {
                                [key: string]: unknown;
                              };
                            };
                            /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                            target: {
                              /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                              source: {
                                link?: string;
                                relatedEntity: string;
                                relatedCompilation?: string;
                              };
                              /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                              selector: {
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referencePoint:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referenceNormal:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                          })
                        | {
                            _id: string;
                          };
                    };
                  } & {
                    __hits?: number;
                    __createdAt?: number;
                    __annotationCount?: number;
                    __normalizedName?: string;
                  } & {
                    __licenses?: string[];
                    __mediaTypes?: string[];
                    __downloadable?: boolean;
                  } & {
                    _id: string;
                  } & {
                    name: string;
                    description: string;
                    /** @description Stripped user data combined with a profile reference, identifying the creator. */
                    creator: ({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    };
                    entities: {
                      [key: string]:
                        | {
                            _id: string;
                          }
                        | ({
                            annotations: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    validated: boolean;
                                    identifier: string;
                                    ranking: number;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    creator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    created: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    generator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    generated?: string;
                                    motivation: string;
                                    lastModificationDate?: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    lastModifiedBy: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    positionXOnView?: number;
                                    positionYOnView?: number;
                                    /** @description Annotation body with a type discriminator and the actual content block. */
                                    body: {
                                      type: string;
                                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                                      content: {
                                        type: string;
                                        title: string;
                                        description: string;
                                        link?: string;
                                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                        relatedPerspective: {
                                          cameraType: string;
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          position:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          target:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          preview: string;
                                        };
                                      } & {
                                        [key: string]: unknown;
                                      };
                                    };
                                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                                    target: {
                                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                                      source: {
                                        link?: string;
                                        relatedEntity: string;
                                        relatedCompilation?: string;
                                      };
                                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                                      selector: {
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referencePoint:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referenceNormal:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                      };
                                    };
                                    extensions?: {
                                      [key: string]: unknown;
                                    };
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          } & {
                            __hits?: number;
                            __createdAt?: number;
                            __annotationCount?: number;
                            __normalizedName?: string;
                          } & {
                            __licenses?: string[];
                            __mediaTypes?: string[];
                            __downloadable?: boolean;
                          } & {
                            _id: string;
                          } & {
                            name: string;
                            files: {
                              file_name: string;
                              file_link: string;
                              file_size: number;
                              file_format: string;
                            }[];
                            externalFile?: string;
                            relatedDigitalEntity:
                              | {
                                  _id: string;
                                }
                              | (({
                                  _id: string;
                                } & {
                                  title: string;
                                  description: string;
                                  externalId: {
                                    type: string;
                                    value: string;
                                  }[];
                                  externalLink: {
                                    description: string;
                                    value: string;
                                  }[];
                                  biblioRefs: {
                                    description: string;
                                    value: string;
                                  }[];
                                  other: {
                                    description: string;
                                    value: string;
                                  }[];
                                  persons: (
                                    | {
                                        _id: string;
                                      }
                                    | string
                                    | ({
                                        _id: string;
                                      } & {
                                        prename: string;
                                        name: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        institutions: {
                                          [key: string]: (
                                            | ({
                                                _id: string;
                                              } & {
                                                name: string;
                                                university: string;
                                                roles: {
                                                  [key: string]: string[];
                                                };
                                                notes: {
                                                  [key: string]: string;
                                                };
                                                addresses: {
                                                  [key: string]:
                                                    | ({
                                                        _id: string;
                                                      } & {
                                                        building: string;
                                                        number: string;
                                                        street: string;
                                                        postcode: string;
                                                        city: string;
                                                        country: string;
                                                        creation_date: number;
                                                      })
                                                    | {
                                                        _id: string;
                                                      };
                                                };
                                              })
                                            | {
                                                _id: string;
                                              }
                                          )[];
                                        };
                                        contact_references: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                mail: string;
                                                phonenumber: string;
                                                note: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                  )[];
                                  institutions: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                    | string
                                  )[];
                                  metadata_files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  extensions?: {
                                    [key: string]: unknown;
                                  };
                                }) & {
                                  type: string;
                                  licence: string;
                                  discipline: string[];
                                  tags: (
                                    | {
                                        _id: string;
                                      }
                                    | ({
                                        _id: string;
                                      } & {
                                        value: string;
                                      })
                                  )[];
                                  dimensions: {
                                    type: string;
                                    value: string;
                                    name: string;
                                  }[];
                                  creation: {
                                    technique: string;
                                    program: string;
                                    equipment: string;
                                    date: string;
                                  }[];
                                  files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  statement: string;
                                  objecttype: string;
                                  phyObjs: (
                                    | {
                                        _id: string;
                                      }
                                    | (({
                                        _id: string;
                                      } & {
                                        title: string;
                                        description: string;
                                        externalId: {
                                          type: string;
                                          value: string;
                                        }[];
                                        externalLink: {
                                          description: string;
                                          value: string;
                                        }[];
                                        biblioRefs: {
                                          description: string;
                                          value: string;
                                        }[];
                                        other: {
                                          description: string;
                                          value: string;
                                        }[];
                                        persons: (
                                          | {
                                              _id: string;
                                            }
                                          | string
                                          | ({
                                              _id: string;
                                            } & {
                                              prename: string;
                                              name: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              institutions: {
                                                [key: string]: (
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      name: string;
                                                      university: string;
                                                      roles: {
                                                        [key: string]: string[];
                                                      };
                                                      notes: {
                                                        [key: string]: string;
                                                      };
                                                      addresses: {
                                                        [key: string]:
                                                          | ({
                                                              _id: string;
                                                            } & {
                                                              building: string;
                                                              number: string;
                                                              street: string;
                                                              postcode: string;
                                                              city: string;
                                                              country: string;
                                                              creation_date: number;
                                                            })
                                                          | {
                                                              _id: string;
                                                            };
                                                      };
                                                    })
                                                  | {
                                                      _id: string;
                                                    }
                                                )[];
                                              };
                                              contact_references: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      mail: string;
                                                      phonenumber: string;
                                                      note: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                        )[];
                                        institutions: (
                                          | ({
                                              _id: string;
                                            } & {
                                              name: string;
                                              university: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              notes: {
                                                [key: string]: string;
                                              };
                                              addresses: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      building: string;
                                                      number: string;
                                                      street: string;
                                                      postcode: string;
                                                      city: string;
                                                      country: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                          | {
                                              _id: string;
                                            }
                                          | string
                                        )[];
                                        metadata_files: {
                                          file_name: string;
                                          file_link: string;
                                          file_size: number;
                                          file_format: string;
                                        }[];
                                        extensions?: {
                                          [key: string]: unknown;
                                        };
                                      }) & {
                                        /** @description Place tuple describing where a physical entity is housed or stored. */
                                        place: {
                                          name: string;
                                          geopolarea: string;
                                          /** @description Structured address fields for institutional or geographic location data. */
                                          address: {
                                            _id: string;
                                          } & {
                                            building: string;
                                            number: string;
                                            street: string;
                                            postcode: string;
                                            city: string;
                                            country: string;
                                            creation_date: number;
                                          };
                                        };
                                        collection: string;
                                        dimensions: {
                                          type: string;
                                          value: string;
                                          name: string;
                                        }[];
                                      })
                                  )[];
                                });
                            /** @description Stripped user data combined with a profile reference, identifying the creator. */
                            creator: ({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            };
                            online: boolean;
                            finished: boolean;
                            mediaType: string;
                            dataSource: {
                              isExternal: boolean;
                              service: string;
                            };
                            processed: {
                              low: string;
                              medium: string;
                              high: string;
                              raw: string;
                            };
                            /** @description Presentation settings for a 3D entity, including camera, lighting, background, and transforms. */
                            settings: {
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              position?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              preview: string;
                              previewVideo?: string;
                              cameraPositionInitial: {
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                target: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                              };
                              background: {
                                /** @description A color tuple with red, green, blue, and alpha transparency components. */
                                color: {
                                  r: number;
                                  b: number;
                                  g: number;
                                  a: number;
                                };
                                effect: boolean;
                              };
                              lights: {
                                type: string;
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                intensity: number;
                              }[];
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              rotation: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              scale: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              translate?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                            /** @description List of users and their access roles for an entity or compilation. */
                            access: (({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /**
                               * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                               * @default owner
                               * @enum {string}
                               */
                              role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            })[];
                            options?: {
                              allowDownload?: boolean;
                            };
                          });
                    };
                    /** @description List of users and their access roles for an entity or compilation. */
                    access: (({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /**
                       * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                       * @default owner
                       * @enum {string}
                       */
                      role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    })[];
                    online?: boolean;
                    password?: string | boolean;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              contact?: (
                | ({
                    _id: string;
                  } & {
                    mail: string;
                    phonenumber: string;
                    note: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              digitalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    type: string;
                    licence: string;
                    discipline: string[];
                    tags: (
                      | {
                          _id: string;
                        }
                      | ({
                          _id: string;
                        } & {
                          value: string;
                        })
                    )[];
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                    creation: {
                      technique: string;
                      program: string;
                      equipment: string;
                      date: string;
                    }[];
                    files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    statement: string;
                    objecttype: string;
                    phyObjs: (
                      | {
                          _id: string;
                        }
                      | (({
                          _id: string;
                        } & {
                          title: string;
                          description: string;
                          externalId: {
                            type: string;
                            value: string;
                          }[];
                          externalLink: {
                            description: string;
                            value: string;
                          }[];
                          biblioRefs: {
                            description: string;
                            value: string;
                          }[];
                          other: {
                            description: string;
                            value: string;
                          }[];
                          persons: (
                            | {
                                _id: string;
                              }
                            | string
                            | ({
                                _id: string;
                              } & {
                                prename: string;
                                name: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                institutions: {
                                  [key: string]: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                  )[];
                                };
                                contact_references: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        mail: string;
                                        phonenumber: string;
                                        note: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                          )[];
                          institutions: (
                            | ({
                                _id: string;
                              } & {
                                name: string;
                                university: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                notes: {
                                  [key: string]: string;
                                };
                                addresses: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        building: string;
                                        number: string;
                                        street: string;
                                        postcode: string;
                                        city: string;
                                        country: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                            | {
                                _id: string;
                              }
                            | string
                          )[];
                          metadata_files: {
                            file_name: string;
                            file_link: string;
                            file_size: number;
                            file_format: string;
                          }[];
                          extensions?: {
                            [key: string]: unknown;
                          };
                        }) & {
                          /** @description Place tuple describing where a physical entity is housed or stored. */
                          place: {
                            name: string;
                            geopolarea: string;
                            /** @description Structured address fields for institutional or geographic location data. */
                            address: {
                              _id: string;
                            } & {
                              building: string;
                              number: string;
                              street: string;
                              postcode: string;
                              city: string;
                              country: string;
                              creation_date: number;
                            };
                          };
                          collection: string;
                          dimensions: {
                            type: string;
                            value: string;
                            name: string;
                          }[];
                        })
                    )[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              entity?: (
                | {
                    _id: string;
                  }
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              institution?: (
                | ({
                    _id: string;
                  } & {
                    name: string;
                    university: string;
                    roles: {
                      [key: string]: string[];
                    };
                    notes: {
                      [key: string]: string;
                    };
                    addresses: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            building: string;
                            number: string;
                            street: string;
                            postcode: string;
                            city: string;
                            country: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              person?: (
                | ({
                    _id: string;
                  } & {
                    prename: string;
                    name: string;
                    roles: {
                      [key: string]: string[];
                    };
                    institutions: {
                      [key: string]: (
                        | ({
                            _id: string;
                          } & {
                            name: string;
                            university: string;
                            roles: {
                              [key: string]: string[];
                            };
                            notes: {
                              [key: string]: string;
                            };
                            addresses: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    building: string;
                                    number: string;
                                    street: string;
                                    postcode: string;
                                    city: string;
                                    country: string;
                                    creation_date: number;
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          })
                        | {
                            _id: string;
                          }
                      )[];
                    };
                    contact_references: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            mail: string;
                            phonenumber: string;
                            note: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              physicalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    /** @description Place tuple describing where a physical entity is housed or stored. */
                    place: {
                      name: string;
                      geopolarea: string;
                      /** @description Structured address fields for institutional or geographic location data. */
                      address: {
                        _id: string;
                      } & {
                        building: string;
                        number: string;
                        street: string;
                        postcode: string;
                        city: string;
                        country: string;
                        creation_date: number;
                      };
                    };
                    collection: string;
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              tag?: (
                | ({
                    _id: string;
                  } & {
                    value: string;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
            };
            profiles: {
              /**
               * @description Defines the type of a profile, which can be either "user" or "organization".
               * @default user
               * @enum {string}
               */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              profileId: string;
            }[];
          };
        };
      };
      /** @description Response for status 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUser-managementLogin': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        strategy: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Represents a registered user with profile links, authentication strategy, and ownership references to all collection types. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            _id: string;
          } & {
            username: string;
            fullname: string;
            prename: string;
            surname: string;
            mail: string;
            /**
             * @description Defines the rank of a user, which can be either "uploader" or "admin".
             * @default uploader
             * @enum {string}
             */
            role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
            strategy: string;
            sessionID?: string;
            data: {
              address?: (
                | ({
                    _id: string;
                  } & {
                    building: string;
                    number: string;
                    street: string;
                    postcode: string;
                    city: string;
                    country: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              annotation?: (
                | ({
                    _id: string;
                  } & {
                    validated: boolean;
                    identifier: string;
                    ranking: number;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    creator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    created: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    generator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    generated?: string;
                    motivation: string;
                    lastModificationDate?: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    lastModifiedBy: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    positionXOnView?: number;
                    positionYOnView?: number;
                    /** @description Annotation body with a type discriminator and the actual content block. */
                    body: {
                      type: string;
                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                      content: {
                        type: string;
                        title: string;
                        description: string;
                        link?: string;
                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                        relatedPerspective: {
                          cameraType: string;
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          position:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          target:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          preview: string;
                        };
                      } & {
                        [key: string]: unknown;
                      };
                    };
                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                    target: {
                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                      source: {
                        link?: string;
                        relatedEntity: string;
                        relatedCompilation?: string;
                      };
                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                      selector: {
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referencePoint:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referenceNormal:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                      };
                    };
                    extensions?: {
                      [key: string]: unknown;
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              compilation?: (
                | ({
                    annotations: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            validated: boolean;
                            identifier: string;
                            ranking: number;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            creator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            created: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            generator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            generated?: string;
                            motivation: string;
                            lastModificationDate?: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            lastModifiedBy: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            positionXOnView?: number;
                            positionYOnView?: number;
                            /** @description Annotation body with a type discriminator and the actual content block. */
                            body: {
                              type: string;
                              /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                              content: {
                                type: string;
                                title: string;
                                description: string;
                                link?: string;
                                /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                relatedPerspective: {
                                  cameraType: string;
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  position:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  target:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  preview: string;
                                };
                              } & {
                                [key: string]: unknown;
                              };
                            };
                            /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                            target: {
                              /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                              source: {
                                link?: string;
                                relatedEntity: string;
                                relatedCompilation?: string;
                              };
                              /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                              selector: {
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referencePoint:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referenceNormal:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                          })
                        | {
                            _id: string;
                          };
                    };
                  } & {
                    __hits?: number;
                    __createdAt?: number;
                    __annotationCount?: number;
                    __normalizedName?: string;
                  } & {
                    __licenses?: string[];
                    __mediaTypes?: string[];
                    __downloadable?: boolean;
                  } & {
                    _id: string;
                  } & {
                    name: string;
                    description: string;
                    /** @description Stripped user data combined with a profile reference, identifying the creator. */
                    creator: ({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    };
                    entities: {
                      [key: string]:
                        | {
                            _id: string;
                          }
                        | ({
                            annotations: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    validated: boolean;
                                    identifier: string;
                                    ranking: number;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    creator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    created: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    generator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    generated?: string;
                                    motivation: string;
                                    lastModificationDate?: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    lastModifiedBy: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    positionXOnView?: number;
                                    positionYOnView?: number;
                                    /** @description Annotation body with a type discriminator and the actual content block. */
                                    body: {
                                      type: string;
                                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                                      content: {
                                        type: string;
                                        title: string;
                                        description: string;
                                        link?: string;
                                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                        relatedPerspective: {
                                          cameraType: string;
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          position:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          target:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          preview: string;
                                        };
                                      } & {
                                        [key: string]: unknown;
                                      };
                                    };
                                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                                    target: {
                                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                                      source: {
                                        link?: string;
                                        relatedEntity: string;
                                        relatedCompilation?: string;
                                      };
                                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                                      selector: {
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referencePoint:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referenceNormal:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                      };
                                    };
                                    extensions?: {
                                      [key: string]: unknown;
                                    };
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          } & {
                            __hits?: number;
                            __createdAt?: number;
                            __annotationCount?: number;
                            __normalizedName?: string;
                          } & {
                            __licenses?: string[];
                            __mediaTypes?: string[];
                            __downloadable?: boolean;
                          } & {
                            _id: string;
                          } & {
                            name: string;
                            files: {
                              file_name: string;
                              file_link: string;
                              file_size: number;
                              file_format: string;
                            }[];
                            externalFile?: string;
                            relatedDigitalEntity:
                              | {
                                  _id: string;
                                }
                              | (({
                                  _id: string;
                                } & {
                                  title: string;
                                  description: string;
                                  externalId: {
                                    type: string;
                                    value: string;
                                  }[];
                                  externalLink: {
                                    description: string;
                                    value: string;
                                  }[];
                                  biblioRefs: {
                                    description: string;
                                    value: string;
                                  }[];
                                  other: {
                                    description: string;
                                    value: string;
                                  }[];
                                  persons: (
                                    | {
                                        _id: string;
                                      }
                                    | string
                                    | ({
                                        _id: string;
                                      } & {
                                        prename: string;
                                        name: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        institutions: {
                                          [key: string]: (
                                            | ({
                                                _id: string;
                                              } & {
                                                name: string;
                                                university: string;
                                                roles: {
                                                  [key: string]: string[];
                                                };
                                                notes: {
                                                  [key: string]: string;
                                                };
                                                addresses: {
                                                  [key: string]:
                                                    | ({
                                                        _id: string;
                                                      } & {
                                                        building: string;
                                                        number: string;
                                                        street: string;
                                                        postcode: string;
                                                        city: string;
                                                        country: string;
                                                        creation_date: number;
                                                      })
                                                    | {
                                                        _id: string;
                                                      };
                                                };
                                              })
                                            | {
                                                _id: string;
                                              }
                                          )[];
                                        };
                                        contact_references: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                mail: string;
                                                phonenumber: string;
                                                note: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                  )[];
                                  institutions: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                    | string
                                  )[];
                                  metadata_files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  extensions?: {
                                    [key: string]: unknown;
                                  };
                                }) & {
                                  type: string;
                                  licence: string;
                                  discipline: string[];
                                  tags: (
                                    | {
                                        _id: string;
                                      }
                                    | ({
                                        _id: string;
                                      } & {
                                        value: string;
                                      })
                                  )[];
                                  dimensions: {
                                    type: string;
                                    value: string;
                                    name: string;
                                  }[];
                                  creation: {
                                    technique: string;
                                    program: string;
                                    equipment: string;
                                    date: string;
                                  }[];
                                  files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  statement: string;
                                  objecttype: string;
                                  phyObjs: (
                                    | {
                                        _id: string;
                                      }
                                    | (({
                                        _id: string;
                                      } & {
                                        title: string;
                                        description: string;
                                        externalId: {
                                          type: string;
                                          value: string;
                                        }[];
                                        externalLink: {
                                          description: string;
                                          value: string;
                                        }[];
                                        biblioRefs: {
                                          description: string;
                                          value: string;
                                        }[];
                                        other: {
                                          description: string;
                                          value: string;
                                        }[];
                                        persons: (
                                          | {
                                              _id: string;
                                            }
                                          | string
                                          | ({
                                              _id: string;
                                            } & {
                                              prename: string;
                                              name: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              institutions: {
                                                [key: string]: (
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      name: string;
                                                      university: string;
                                                      roles: {
                                                        [key: string]: string[];
                                                      };
                                                      notes: {
                                                        [key: string]: string;
                                                      };
                                                      addresses: {
                                                        [key: string]:
                                                          | ({
                                                              _id: string;
                                                            } & {
                                                              building: string;
                                                              number: string;
                                                              street: string;
                                                              postcode: string;
                                                              city: string;
                                                              country: string;
                                                              creation_date: number;
                                                            })
                                                          | {
                                                              _id: string;
                                                            };
                                                      };
                                                    })
                                                  | {
                                                      _id: string;
                                                    }
                                                )[];
                                              };
                                              contact_references: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      mail: string;
                                                      phonenumber: string;
                                                      note: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                        )[];
                                        institutions: (
                                          | ({
                                              _id: string;
                                            } & {
                                              name: string;
                                              university: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              notes: {
                                                [key: string]: string;
                                              };
                                              addresses: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      building: string;
                                                      number: string;
                                                      street: string;
                                                      postcode: string;
                                                      city: string;
                                                      country: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                          | {
                                              _id: string;
                                            }
                                          | string
                                        )[];
                                        metadata_files: {
                                          file_name: string;
                                          file_link: string;
                                          file_size: number;
                                          file_format: string;
                                        }[];
                                        extensions?: {
                                          [key: string]: unknown;
                                        };
                                      }) & {
                                        /** @description Place tuple describing where a physical entity is housed or stored. */
                                        place: {
                                          name: string;
                                          geopolarea: string;
                                          /** @description Structured address fields for institutional or geographic location data. */
                                          address: {
                                            _id: string;
                                          } & {
                                            building: string;
                                            number: string;
                                            street: string;
                                            postcode: string;
                                            city: string;
                                            country: string;
                                            creation_date: number;
                                          };
                                        };
                                        collection: string;
                                        dimensions: {
                                          type: string;
                                          value: string;
                                          name: string;
                                        }[];
                                      })
                                  )[];
                                });
                            /** @description Stripped user data combined with a profile reference, identifying the creator. */
                            creator: ({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            };
                            online: boolean;
                            finished: boolean;
                            mediaType: string;
                            dataSource: {
                              isExternal: boolean;
                              service: string;
                            };
                            processed: {
                              low: string;
                              medium: string;
                              high: string;
                              raw: string;
                            };
                            /** @description Presentation settings for a 3D entity, including camera, lighting, background, and transforms. */
                            settings: {
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              position?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              preview: string;
                              previewVideo?: string;
                              cameraPositionInitial: {
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                target: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                              };
                              background: {
                                /** @description A color tuple with red, green, blue, and alpha transparency components. */
                                color: {
                                  r: number;
                                  b: number;
                                  g: number;
                                  a: number;
                                };
                                effect: boolean;
                              };
                              lights: {
                                type: string;
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                intensity: number;
                              }[];
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              rotation: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              scale: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              translate?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                            /** @description List of users and their access roles for an entity or compilation. */
                            access: (({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /**
                               * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                               * @default owner
                               * @enum {string}
                               */
                              role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            })[];
                            options?: {
                              allowDownload?: boolean;
                            };
                          });
                    };
                    /** @description List of users and their access roles for an entity or compilation. */
                    access: (({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /**
                       * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                       * @default owner
                       * @enum {string}
                       */
                      role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    })[];
                    online?: boolean;
                    password?: string | boolean;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              contact?: (
                | ({
                    _id: string;
                  } & {
                    mail: string;
                    phonenumber: string;
                    note: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              digitalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    type: string;
                    licence: string;
                    discipline: string[];
                    tags: (
                      | {
                          _id: string;
                        }
                      | ({
                          _id: string;
                        } & {
                          value: string;
                        })
                    )[];
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                    creation: {
                      technique: string;
                      program: string;
                      equipment: string;
                      date: string;
                    }[];
                    files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    statement: string;
                    objecttype: string;
                    phyObjs: (
                      | {
                          _id: string;
                        }
                      | (({
                          _id: string;
                        } & {
                          title: string;
                          description: string;
                          externalId: {
                            type: string;
                            value: string;
                          }[];
                          externalLink: {
                            description: string;
                            value: string;
                          }[];
                          biblioRefs: {
                            description: string;
                            value: string;
                          }[];
                          other: {
                            description: string;
                            value: string;
                          }[];
                          persons: (
                            | {
                                _id: string;
                              }
                            | string
                            | ({
                                _id: string;
                              } & {
                                prename: string;
                                name: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                institutions: {
                                  [key: string]: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                  )[];
                                };
                                contact_references: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        mail: string;
                                        phonenumber: string;
                                        note: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                          )[];
                          institutions: (
                            | ({
                                _id: string;
                              } & {
                                name: string;
                                university: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                notes: {
                                  [key: string]: string;
                                };
                                addresses: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        building: string;
                                        number: string;
                                        street: string;
                                        postcode: string;
                                        city: string;
                                        country: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                            | {
                                _id: string;
                              }
                            | string
                          )[];
                          metadata_files: {
                            file_name: string;
                            file_link: string;
                            file_size: number;
                            file_format: string;
                          }[];
                          extensions?: {
                            [key: string]: unknown;
                          };
                        }) & {
                          /** @description Place tuple describing where a physical entity is housed or stored. */
                          place: {
                            name: string;
                            geopolarea: string;
                            /** @description Structured address fields for institutional or geographic location data. */
                            address: {
                              _id: string;
                            } & {
                              building: string;
                              number: string;
                              street: string;
                              postcode: string;
                              city: string;
                              country: string;
                              creation_date: number;
                            };
                          };
                          collection: string;
                          dimensions: {
                            type: string;
                            value: string;
                            name: string;
                          }[];
                        })
                    )[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              entity?: (
                | {
                    _id: string;
                  }
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              institution?: (
                | ({
                    _id: string;
                  } & {
                    name: string;
                    university: string;
                    roles: {
                      [key: string]: string[];
                    };
                    notes: {
                      [key: string]: string;
                    };
                    addresses: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            building: string;
                            number: string;
                            street: string;
                            postcode: string;
                            city: string;
                            country: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              person?: (
                | ({
                    _id: string;
                  } & {
                    prename: string;
                    name: string;
                    roles: {
                      [key: string]: string[];
                    };
                    institutions: {
                      [key: string]: (
                        | ({
                            _id: string;
                          } & {
                            name: string;
                            university: string;
                            roles: {
                              [key: string]: string[];
                            };
                            notes: {
                              [key: string]: string;
                            };
                            addresses: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    building: string;
                                    number: string;
                                    street: string;
                                    postcode: string;
                                    city: string;
                                    country: string;
                                    creation_date: number;
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          })
                        | {
                            _id: string;
                          }
                      )[];
                    };
                    contact_references: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            mail: string;
                            phonenumber: string;
                            note: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              physicalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    /** @description Place tuple describing where a physical entity is housed or stored. */
                    place: {
                      name: string;
                      geopolarea: string;
                      /** @description Structured address fields for institutional or geographic location data. */
                      address: {
                        _id: string;
                      } & {
                        building: string;
                        number: string;
                        street: string;
                        postcode: string;
                        city: string;
                        country: string;
                        creation_date: number;
                      };
                    };
                    collection: string;
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              tag?: (
                | ({
                    _id: string;
                  } & {
                    value: string;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
            };
            profiles: {
              /**
               * @description Defines the type of a profile, which can be either "user" or "organization".
               * @default user
               * @enum {string}
               */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              profileId: string;
            }[];
          };
        };
      };
      /** @description Response for status 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUser-managementRegister': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
          mail: string;
          prename: string;
          surname: string;
          fullname: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
          mail: string;
          prename: string;
          surname: string;
          fullname: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
          mail: string;
          prename: string;
          surname: string;
          fullname: string;
        };
      };
    };
    responses: {
      /** @description Represents a registered user with profile links, authentication strategy, and ownership references to all collection types. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            _id: string;
          } & {
            username: string;
            fullname: string;
            prename: string;
            surname: string;
            mail: string;
            /**
             * @description Defines the rank of a user, which can be either "uploader" or "admin".
             * @default uploader
             * @enum {string}
             */
            role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
            strategy: string;
            sessionID?: string;
            data: {
              address?: (
                | ({
                    _id: string;
                  } & {
                    building: string;
                    number: string;
                    street: string;
                    postcode: string;
                    city: string;
                    country: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              annotation?: (
                | ({
                    _id: string;
                  } & {
                    validated: boolean;
                    identifier: string;
                    ranking: number;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    creator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    created: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    generator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    generated?: string;
                    motivation: string;
                    lastModificationDate?: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    lastModifiedBy: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    positionXOnView?: number;
                    positionYOnView?: number;
                    /** @description Annotation body with a type discriminator and the actual content block. */
                    body: {
                      type: string;
                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                      content: {
                        type: string;
                        title: string;
                        description: string;
                        link?: string;
                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                        relatedPerspective: {
                          cameraType: string;
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          position:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          target:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          preview: string;
                        };
                      } & {
                        [key: string]: unknown;
                      };
                    };
                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                    target: {
                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                      source: {
                        link?: string;
                        relatedEntity: string;
                        relatedCompilation?: string;
                      };
                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                      selector: {
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referencePoint:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referenceNormal:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                      };
                    };
                    extensions?: {
                      [key: string]: unknown;
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              compilation?: (
                | ({
                    annotations: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            validated: boolean;
                            identifier: string;
                            ranking: number;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            creator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            created: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            generator: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            generated?: string;
                            motivation: string;
                            lastModificationDate?: string;
                            /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                            lastModifiedBy: {
                              _id: string;
                            } & {
                              type: string;
                              name: string;
                              homepage?: string;
                            };
                            positionXOnView?: number;
                            positionYOnView?: number;
                            /** @description Annotation body with a type discriminator and the actual content block. */
                            body: {
                              type: string;
                              /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                              content: {
                                type: string;
                                title: string;
                                description: string;
                                link?: string;
                                /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                relatedPerspective: {
                                  cameraType: string;
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  position:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  target:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  preview: string;
                                };
                              } & {
                                [key: string]: unknown;
                              };
                            };
                            /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                            target: {
                              /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                              source: {
                                link?: string;
                                relatedEntity: string;
                                relatedCompilation?: string;
                              };
                              /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                              selector: {
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referencePoint:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                                /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                referenceNormal:
                                  | {
                                      x: number;
                                      y: number;
                                      z: number;
                                    }
                                  | {
                                      _x: number;
                                      _y: number;
                                      _z: number;
                                    };
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                          })
                        | {
                            _id: string;
                          };
                    };
                  } & {
                    __hits?: number;
                    __createdAt?: number;
                    __annotationCount?: number;
                    __normalizedName?: string;
                  } & {
                    __licenses?: string[];
                    __mediaTypes?: string[];
                    __downloadable?: boolean;
                  } & {
                    _id: string;
                  } & {
                    name: string;
                    description: string;
                    /** @description Stripped user data combined with a profile reference, identifying the creator. */
                    creator: ({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    };
                    entities: {
                      [key: string]:
                        | {
                            _id: string;
                          }
                        | ({
                            annotations: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    validated: boolean;
                                    identifier: string;
                                    ranking: number;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    creator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    created: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    generator: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    generated?: string;
                                    motivation: string;
                                    lastModificationDate?: string;
                                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                                    lastModifiedBy: {
                                      _id: string;
                                    } & {
                                      type: string;
                                      name: string;
                                      homepage?: string;
                                    };
                                    positionXOnView?: number;
                                    positionYOnView?: number;
                                    /** @description Annotation body with a type discriminator and the actual content block. */
                                    body: {
                                      type: string;
                                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                                      content: {
                                        type: string;
                                        title: string;
                                        description: string;
                                        link?: string;
                                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                        relatedPerspective: {
                                          cameraType: string;
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          position:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                          target:
                                            | {
                                                x: number;
                                                y: number;
                                                z: number;
                                              }
                                            | {
                                                _x: number;
                                                _y: number;
                                                _z: number;
                                              };
                                          preview: string;
                                        };
                                      } & {
                                        [key: string]: unknown;
                                      };
                                    };
                                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                                    target: {
                                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                                      source: {
                                        link?: string;
                                        relatedEntity: string;
                                        relatedCompilation?: string;
                                      };
                                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                                      selector: {
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referencePoint:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                        referenceNormal:
                                          | {
                                              x: number;
                                              y: number;
                                              z: number;
                                            }
                                          | {
                                              _x: number;
                                              _y: number;
                                              _z: number;
                                            };
                                      };
                                    };
                                    extensions?: {
                                      [key: string]: unknown;
                                    };
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          } & {
                            __hits?: number;
                            __createdAt?: number;
                            __annotationCount?: number;
                            __normalizedName?: string;
                          } & {
                            __licenses?: string[];
                            __mediaTypes?: string[];
                            __downloadable?: boolean;
                          } & {
                            _id: string;
                          } & {
                            name: string;
                            files: {
                              file_name: string;
                              file_link: string;
                              file_size: number;
                              file_format: string;
                            }[];
                            externalFile?: string;
                            relatedDigitalEntity:
                              | {
                                  _id: string;
                                }
                              | (({
                                  _id: string;
                                } & {
                                  title: string;
                                  description: string;
                                  externalId: {
                                    type: string;
                                    value: string;
                                  }[];
                                  externalLink: {
                                    description: string;
                                    value: string;
                                  }[];
                                  biblioRefs: {
                                    description: string;
                                    value: string;
                                  }[];
                                  other: {
                                    description: string;
                                    value: string;
                                  }[];
                                  persons: (
                                    | {
                                        _id: string;
                                      }
                                    | string
                                    | ({
                                        _id: string;
                                      } & {
                                        prename: string;
                                        name: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        institutions: {
                                          [key: string]: (
                                            | ({
                                                _id: string;
                                              } & {
                                                name: string;
                                                university: string;
                                                roles: {
                                                  [key: string]: string[];
                                                };
                                                notes: {
                                                  [key: string]: string;
                                                };
                                                addresses: {
                                                  [key: string]:
                                                    | ({
                                                        _id: string;
                                                      } & {
                                                        building: string;
                                                        number: string;
                                                        street: string;
                                                        postcode: string;
                                                        city: string;
                                                        country: string;
                                                        creation_date: number;
                                                      })
                                                    | {
                                                        _id: string;
                                                      };
                                                };
                                              })
                                            | {
                                                _id: string;
                                              }
                                          )[];
                                        };
                                        contact_references: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                mail: string;
                                                phonenumber: string;
                                                note: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                  )[];
                                  institutions: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                    | string
                                  )[];
                                  metadata_files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  extensions?: {
                                    [key: string]: unknown;
                                  };
                                }) & {
                                  type: string;
                                  licence: string;
                                  discipline: string[];
                                  tags: (
                                    | {
                                        _id: string;
                                      }
                                    | ({
                                        _id: string;
                                      } & {
                                        value: string;
                                      })
                                  )[];
                                  dimensions: {
                                    type: string;
                                    value: string;
                                    name: string;
                                  }[];
                                  creation: {
                                    technique: string;
                                    program: string;
                                    equipment: string;
                                    date: string;
                                  }[];
                                  files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  statement: string;
                                  objecttype: string;
                                  phyObjs: (
                                    | {
                                        _id: string;
                                      }
                                    | (({
                                        _id: string;
                                      } & {
                                        title: string;
                                        description: string;
                                        externalId: {
                                          type: string;
                                          value: string;
                                        }[];
                                        externalLink: {
                                          description: string;
                                          value: string;
                                        }[];
                                        biblioRefs: {
                                          description: string;
                                          value: string;
                                        }[];
                                        other: {
                                          description: string;
                                          value: string;
                                        }[];
                                        persons: (
                                          | {
                                              _id: string;
                                            }
                                          | string
                                          | ({
                                              _id: string;
                                            } & {
                                              prename: string;
                                              name: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              institutions: {
                                                [key: string]: (
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      name: string;
                                                      university: string;
                                                      roles: {
                                                        [key: string]: string[];
                                                      };
                                                      notes: {
                                                        [key: string]: string;
                                                      };
                                                      addresses: {
                                                        [key: string]:
                                                          | ({
                                                              _id: string;
                                                            } & {
                                                              building: string;
                                                              number: string;
                                                              street: string;
                                                              postcode: string;
                                                              city: string;
                                                              country: string;
                                                              creation_date: number;
                                                            })
                                                          | {
                                                              _id: string;
                                                            };
                                                      };
                                                    })
                                                  | {
                                                      _id: string;
                                                    }
                                                )[];
                                              };
                                              contact_references: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      mail: string;
                                                      phonenumber: string;
                                                      note: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                        )[];
                                        institutions: (
                                          | ({
                                              _id: string;
                                            } & {
                                              name: string;
                                              university: string;
                                              roles: {
                                                [key: string]: string[];
                                              };
                                              notes: {
                                                [key: string]: string;
                                              };
                                              addresses: {
                                                [key: string]:
                                                  | ({
                                                      _id: string;
                                                    } & {
                                                      building: string;
                                                      number: string;
                                                      street: string;
                                                      postcode: string;
                                                      city: string;
                                                      country: string;
                                                      creation_date: number;
                                                    })
                                                  | {
                                                      _id: string;
                                                    };
                                              };
                                            })
                                          | {
                                              _id: string;
                                            }
                                          | string
                                        )[];
                                        metadata_files: {
                                          file_name: string;
                                          file_link: string;
                                          file_size: number;
                                          file_format: string;
                                        }[];
                                        extensions?: {
                                          [key: string]: unknown;
                                        };
                                      }) & {
                                        /** @description Place tuple describing where a physical entity is housed or stored. */
                                        place: {
                                          name: string;
                                          geopolarea: string;
                                          /** @description Structured address fields for institutional or geographic location data. */
                                          address: {
                                            _id: string;
                                          } & {
                                            building: string;
                                            number: string;
                                            street: string;
                                            postcode: string;
                                            city: string;
                                            country: string;
                                            creation_date: number;
                                          };
                                        };
                                        collection: string;
                                        dimensions: {
                                          type: string;
                                          value: string;
                                          name: string;
                                        }[];
                                      })
                                  )[];
                                });
                            /** @description Stripped user data combined with a profile reference, identifying the creator. */
                            creator: ({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            };
                            online: boolean;
                            finished: boolean;
                            mediaType: string;
                            dataSource: {
                              isExternal: boolean;
                              service: string;
                            };
                            processed: {
                              low: string;
                              medium: string;
                              high: string;
                              raw: string;
                            };
                            /** @description Presentation settings for a 3D entity, including camera, lighting, background, and transforms. */
                            settings: {
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              position?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              preview: string;
                              previewVideo?: string;
                              cameraPositionInitial: {
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                target: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                              };
                              background: {
                                /** @description A color tuple with red, green, blue, and alpha transparency components. */
                                color: {
                                  r: number;
                                  b: number;
                                  g: number;
                                  a: number;
                                };
                                effect: boolean;
                              };
                              lights: {
                                type: string;
                                /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                                position: {
                                  x: number;
                                  y: number;
                                  z: number;
                                };
                                intensity: number;
                              }[];
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              rotation: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              scale: {
                                x: number;
                                y: number;
                                z: number;
                              };
                              /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                              translate?: {
                                x: number;
                                y: number;
                                z: number;
                              };
                            };
                            extensions?: {
                              [key: string]: unknown;
                            };
                            /** @description List of users and their access roles for an entity or compilation. */
                            access: (({
                              _id: string;
                            } & {
                              fullname: string;
                              username: string;
                            }) & {
                              /**
                               * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                               * @default owner
                               * @enum {string}
                               */
                              role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                              /** @description Reference to a user or organization profile by ID and type. */
                              profile: {
                                profileId: string;
                                /**
                                 * @description Defines the type of a profile, which can be either "user" or "organization".
                                 * @default user
                                 * @enum {string}
                                 */
                                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                              };
                            })[];
                            options?: {
                              allowDownload?: boolean;
                            };
                          });
                    };
                    /** @description List of users and their access roles for an entity or compilation. */
                    access: (({
                      _id: string;
                    } & {
                      fullname: string;
                      username: string;
                    }) & {
                      /**
                       * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                       * @default owner
                       * @enum {string}
                       */
                      role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                      /** @description Reference to a user or organization profile by ID and type. */
                      profile: {
                        profileId: string;
                        /**
                         * @description Defines the type of a profile, which can be either "user" or "organization".
                         * @default user
                         * @enum {string}
                         */
                        type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                      };
                    })[];
                    online?: boolean;
                    password?: string | boolean;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              contact?: (
                | ({
                    _id: string;
                  } & {
                    mail: string;
                    phonenumber: string;
                    note: string;
                    creation_date: number;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              digitalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    type: string;
                    licence: string;
                    discipline: string[];
                    tags: (
                      | {
                          _id: string;
                        }
                      | ({
                          _id: string;
                        } & {
                          value: string;
                        })
                    )[];
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                    creation: {
                      technique: string;
                      program: string;
                      equipment: string;
                      date: string;
                    }[];
                    files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    statement: string;
                    objecttype: string;
                    phyObjs: (
                      | {
                          _id: string;
                        }
                      | (({
                          _id: string;
                        } & {
                          title: string;
                          description: string;
                          externalId: {
                            type: string;
                            value: string;
                          }[];
                          externalLink: {
                            description: string;
                            value: string;
                          }[];
                          biblioRefs: {
                            description: string;
                            value: string;
                          }[];
                          other: {
                            description: string;
                            value: string;
                          }[];
                          persons: (
                            | {
                                _id: string;
                              }
                            | string
                            | ({
                                _id: string;
                              } & {
                                prename: string;
                                name: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                institutions: {
                                  [key: string]: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                  )[];
                                };
                                contact_references: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        mail: string;
                                        phonenumber: string;
                                        note: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                          )[];
                          institutions: (
                            | ({
                                _id: string;
                              } & {
                                name: string;
                                university: string;
                                roles: {
                                  [key: string]: string[];
                                };
                                notes: {
                                  [key: string]: string;
                                };
                                addresses: {
                                  [key: string]:
                                    | ({
                                        _id: string;
                                      } & {
                                        building: string;
                                        number: string;
                                        street: string;
                                        postcode: string;
                                        city: string;
                                        country: string;
                                        creation_date: number;
                                      })
                                    | {
                                        _id: string;
                                      };
                                };
                              })
                            | {
                                _id: string;
                              }
                            | string
                          )[];
                          metadata_files: {
                            file_name: string;
                            file_link: string;
                            file_size: number;
                            file_format: string;
                          }[];
                          extensions?: {
                            [key: string]: unknown;
                          };
                        }) & {
                          /** @description Place tuple describing where a physical entity is housed or stored. */
                          place: {
                            name: string;
                            geopolarea: string;
                            /** @description Structured address fields for institutional or geographic location data. */
                            address: {
                              _id: string;
                            } & {
                              building: string;
                              number: string;
                              street: string;
                              postcode: string;
                              city: string;
                              country: string;
                              creation_date: number;
                            };
                          };
                          collection: string;
                          dimensions: {
                            type: string;
                            value: string;
                            name: string;
                          }[];
                        })
                    )[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              entity?: (
                | {
                    _id: string;
                  }
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              institution?: (
                | ({
                    _id: string;
                  } & {
                    name: string;
                    university: string;
                    roles: {
                      [key: string]: string[];
                    };
                    notes: {
                      [key: string]: string;
                    };
                    addresses: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            building: string;
                            number: string;
                            street: string;
                            postcode: string;
                            city: string;
                            country: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              person?: (
                | ({
                    _id: string;
                  } & {
                    prename: string;
                    name: string;
                    roles: {
                      [key: string]: string[];
                    };
                    institutions: {
                      [key: string]: (
                        | ({
                            _id: string;
                          } & {
                            name: string;
                            university: string;
                            roles: {
                              [key: string]: string[];
                            };
                            notes: {
                              [key: string]: string;
                            };
                            addresses: {
                              [key: string]:
                                | ({
                                    _id: string;
                                  } & {
                                    building: string;
                                    number: string;
                                    street: string;
                                    postcode: string;
                                    city: string;
                                    country: string;
                                    creation_date: number;
                                  })
                                | {
                                    _id: string;
                                  };
                            };
                          })
                        | {
                            _id: string;
                          }
                      )[];
                    };
                    contact_references: {
                      [key: string]:
                        | ({
                            _id: string;
                          } & {
                            mail: string;
                            phonenumber: string;
                            note: string;
                            creation_date: number;
                          })
                        | {
                            _id: string;
                          };
                    };
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              physicalentity?: (
                | (({
                    _id: string;
                  } & {
                    title: string;
                    description: string;
                    externalId: {
                      type: string;
                      value: string;
                    }[];
                    externalLink: {
                      description: string;
                      value: string;
                    }[];
                    biblioRefs: {
                      description: string;
                      value: string;
                    }[];
                    other: {
                      description: string;
                      value: string;
                    }[];
                    persons: (
                      | {
                          _id: string;
                        }
                      | string
                      | ({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                          institutions: {
                            [key: string]: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                            )[];
                          };
                          contact_references: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  mail: string;
                                  phonenumber: string;
                                  note: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                    )[];
                    institutions: (
                      | ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })
                      | {
                          _id: string;
                        }
                      | string
                    )[];
                    metadata_files: {
                      file_name: string;
                      file_link: string;
                      file_size: number;
                      file_format: string;
                    }[];
                    extensions?: {
                      [key: string]: unknown;
                    };
                  }) & {
                    /** @description Place tuple describing where a physical entity is housed or stored. */
                    place: {
                      name: string;
                      geopolarea: string;
                      /** @description Structured address fields for institutional or geographic location data. */
                      address: {
                        _id: string;
                      } & {
                        building: string;
                        number: string;
                        street: string;
                        postcode: string;
                        city: string;
                        country: string;
                        creation_date: number;
                      };
                    };
                    collection: string;
                    dimensions: {
                      type: string;
                      value: string;
                      name: string;
                    }[];
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
              tag?: (
                | ({
                    _id: string;
                  } & {
                    value: string;
                  })
                | {
                    _id: string;
                  }
                | string
                | null
              )[];
            };
            profiles: {
              /**
               * @description Defines the type of a profile, which can be either "user" or "organization".
               * @default user
               * @enum {string}
               */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              profileId: string;
            }[];
          };
        };
      };
      /** @description Response for status 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerUser-managementLogout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
      /** @description Response for status 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerUser-managementAuth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description User identity and profile info without the associated collection data. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            _id: string;
          } & {
            username: string;
            fullname: string;
            prename: string;
            surname: string;
            mail: string;
            /**
             * @description Defines the rank of a user, which can be either "uploader" or "admin".
             * @default uploader
             * @enum {string}
             */
            role: PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole;
            strategy: string;
            sessionID?: string;
            profiles: {
              /**
               * @description Defines the type of a profile, which can be either "user" or "organization".
               * @default user
               * @enum {string}
               */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              profileId: string;
            }[];
          };
        };
      };
      /** @description Response for status 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUser-managementHelpRequest-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
        };
        'multipart/form-data': {
          username: string;
        };
      };
    };
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
      /** @description Response for status 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUser-managementHelpConfirm-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          token: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          token: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          token: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
      /** @description Response for status 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUser-managementHelpForgot-username': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          mail: string;
        };
        'application/x-www-form-urlencoded': {
          mail: string;
        };
        'multipart/form-data': {
          mail: string;
        };
      };
    };
    responses: never;
  };
  'getServerUtilityHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
    };
  };
  'getServerUtilityCountentityusesById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            occurences: number;
            compilations: ({
              annotations: {
                [key: string]:
                  | ({
                      _id: string;
                    } & {
                      validated: boolean;
                      identifier: string;
                      ranking: number;
                      /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                      creator: {
                        _id: string;
                      } & {
                        type: string;
                        name: string;
                        homepage?: string;
                      };
                      created: string;
                      /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                      generator: {
                        _id: string;
                      } & {
                        type: string;
                        name: string;
                        homepage?: string;
                      };
                      generated?: string;
                      motivation: string;
                      lastModificationDate?: string;
                      /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                      lastModifiedBy: {
                        _id: string;
                      } & {
                        type: string;
                        name: string;
                        homepage?: string;
                      };
                      positionXOnView?: number;
                      positionYOnView?: number;
                      /** @description Annotation body with a type discriminator and the actual content block. */
                      body: {
                        type: string;
                        /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                        content: {
                          type: string;
                          title: string;
                          description: string;
                          link?: string;
                          /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                          relatedPerspective: {
                            cameraType: string;
                            /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                            position:
                              | {
                                  x: number;
                                  y: number;
                                  z: number;
                                }
                              | {
                                  _x: number;
                                  _y: number;
                                  _z: number;
                                };
                            /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                            target:
                              | {
                                  x: number;
                                  y: number;
                                  z: number;
                                }
                              | {
                                  _x: number;
                                  _y: number;
                                  _z: number;
                                };
                            preview: string;
                          };
                        } & {
                          [key: string]: unknown;
                        };
                      };
                      /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                      target: {
                        /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                        source: {
                          link?: string;
                          relatedEntity: string;
                          relatedCompilation?: string;
                        };
                        /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                        selector: {
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          referencePoint:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          referenceNormal:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                        };
                      };
                      extensions?: {
                        [key: string]: unknown;
                      };
                    })
                  | {
                      _id: string;
                    };
              };
            } & {
              __hits?: number;
              __createdAt?: number;
              __annotationCount?: number;
              __normalizedName?: string;
            } & {
              __licenses?: string[];
              __mediaTypes?: string[];
              __downloadable?: boolean;
            } & {
              _id: string;
            } & {
              name: string;
              description: string;
              /** @description Stripped user data combined with a profile reference, identifying the creator. */
              creator: ({
                _id: string;
              } & {
                fullname: string;
                username: string;
              }) & {
                /** @description Reference to a user or organization profile by ID and type. */
                profile: {
                  profileId: string;
                  /**
                   * @description Defines the type of a profile, which can be either "user" or "organization".
                   * @default user
                   * @enum {string}
                   */
                  type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                };
              };
              entities: {
                [key: string]:
                  | {
                      _id: string;
                    }
                  | ({
                      annotations: {
                        [key: string]:
                          | ({
                              _id: string;
                            } & {
                              validated: boolean;
                              identifier: string;
                              ranking: number;
                              /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                              creator: {
                                _id: string;
                              } & {
                                type: string;
                                name: string;
                                homepage?: string;
                              };
                              created: string;
                              /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                              generator: {
                                _id: string;
                              } & {
                                type: string;
                                name: string;
                                homepage?: string;
                              };
                              generated?: string;
                              motivation: string;
                              lastModificationDate?: string;
                              /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                              lastModifiedBy: {
                                _id: string;
                              } & {
                                type: string;
                                name: string;
                                homepage?: string;
                              };
                              positionXOnView?: number;
                              positionYOnView?: number;
                              /** @description Annotation body with a type discriminator and the actual content block. */
                              body: {
                                type: string;
                                /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                                content: {
                                  type: string;
                                  title: string;
                                  description: string;
                                  link?: string;
                                  /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                                  relatedPerspective: {
                                    cameraType: string;
                                    /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                    position:
                                      | {
                                          x: number;
                                          y: number;
                                          z: number;
                                        }
                                      | {
                                          _x: number;
                                          _y: number;
                                          _z: number;
                                        };
                                    /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                    target:
                                      | {
                                          x: number;
                                          y: number;
                                          z: number;
                                        }
                                      | {
                                          _x: number;
                                          _y: number;
                                          _z: number;
                                        };
                                    preview: string;
                                  };
                                } & {
                                  [key: string]: unknown;
                                };
                              };
                              /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                              target: {
                                /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                                source: {
                                  link?: string;
                                  relatedEntity: string;
                                  relatedCompilation?: string;
                                };
                                /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                                selector: {
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  referencePoint:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                  /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                                  referenceNormal:
                                    | {
                                        x: number;
                                        y: number;
                                        z: number;
                                      }
                                    | {
                                        _x: number;
                                        _y: number;
                                        _z: number;
                                      };
                                };
                              };
                              extensions?: {
                                [key: string]: unknown;
                              };
                            })
                          | {
                              _id: string;
                            };
                      };
                    } & {
                      __hits?: number;
                      __createdAt?: number;
                      __annotationCount?: number;
                      __normalizedName?: string;
                    } & {
                      __licenses?: string[];
                      __mediaTypes?: string[];
                      __downloadable?: boolean;
                    } & {
                      _id: string;
                    } & {
                      name: string;
                      files: {
                        file_name: string;
                        file_link: string;
                        file_size: number;
                        file_format: string;
                      }[];
                      externalFile?: string;
                      relatedDigitalEntity:
                        | {
                            _id: string;
                          }
                        | (({
                            _id: string;
                          } & {
                            title: string;
                            description: string;
                            externalId: {
                              type: string;
                              value: string;
                            }[];
                            externalLink: {
                              description: string;
                              value: string;
                            }[];
                            biblioRefs: {
                              description: string;
                              value: string;
                            }[];
                            other: {
                              description: string;
                              value: string;
                            }[];
                            persons: (
                              | {
                                  _id: string;
                                }
                              | string
                              | ({
                                  _id: string;
                                } & {
                                  prename: string;
                                  name: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  institutions: {
                                    [key: string]: (
                                      | ({
                                          _id: string;
                                        } & {
                                          name: string;
                                          university: string;
                                          roles: {
                                            [key: string]: string[];
                                          };
                                          notes: {
                                            [key: string]: string;
                                          };
                                          addresses: {
                                            [key: string]:
                                              | ({
                                                  _id: string;
                                                } & {
                                                  building: string;
                                                  number: string;
                                                  street: string;
                                                  postcode: string;
                                                  city: string;
                                                  country: string;
                                                  creation_date: number;
                                                })
                                              | {
                                                  _id: string;
                                                };
                                          };
                                        })
                                      | {
                                          _id: string;
                                        }
                                    )[];
                                  };
                                  contact_references: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          mail: string;
                                          phonenumber: string;
                                          note: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                            )[];
                            institutions: (
                              | ({
                                  _id: string;
                                } & {
                                  name: string;
                                  university: string;
                                  roles: {
                                    [key: string]: string[];
                                  };
                                  notes: {
                                    [key: string]: string;
                                  };
                                  addresses: {
                                    [key: string]:
                                      | ({
                                          _id: string;
                                        } & {
                                          building: string;
                                          number: string;
                                          street: string;
                                          postcode: string;
                                          city: string;
                                          country: string;
                                          creation_date: number;
                                        })
                                      | {
                                          _id: string;
                                        };
                                  };
                                })
                              | {
                                  _id: string;
                                }
                              | string
                            )[];
                            metadata_files: {
                              file_name: string;
                              file_link: string;
                              file_size: number;
                              file_format: string;
                            }[];
                            extensions?: {
                              [key: string]: unknown;
                            };
                          }) & {
                            type: string;
                            licence: string;
                            discipline: string[];
                            tags: (
                              | {
                                  _id: string;
                                }
                              | ({
                                  _id: string;
                                } & {
                                  value: string;
                                })
                            )[];
                            dimensions: {
                              type: string;
                              value: string;
                              name: string;
                            }[];
                            creation: {
                              technique: string;
                              program: string;
                              equipment: string;
                              date: string;
                            }[];
                            files: {
                              file_name: string;
                              file_link: string;
                              file_size: number;
                              file_format: string;
                            }[];
                            statement: string;
                            objecttype: string;
                            phyObjs: (
                              | {
                                  _id: string;
                                }
                              | (({
                                  _id: string;
                                } & {
                                  title: string;
                                  description: string;
                                  externalId: {
                                    type: string;
                                    value: string;
                                  }[];
                                  externalLink: {
                                    description: string;
                                    value: string;
                                  }[];
                                  biblioRefs: {
                                    description: string;
                                    value: string;
                                  }[];
                                  other: {
                                    description: string;
                                    value: string;
                                  }[];
                                  persons: (
                                    | {
                                        _id: string;
                                      }
                                    | string
                                    | ({
                                        _id: string;
                                      } & {
                                        prename: string;
                                        name: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        institutions: {
                                          [key: string]: (
                                            | ({
                                                _id: string;
                                              } & {
                                                name: string;
                                                university: string;
                                                roles: {
                                                  [key: string]: string[];
                                                };
                                                notes: {
                                                  [key: string]: string;
                                                };
                                                addresses: {
                                                  [key: string]:
                                                    | ({
                                                        _id: string;
                                                      } & {
                                                        building: string;
                                                        number: string;
                                                        street: string;
                                                        postcode: string;
                                                        city: string;
                                                        country: string;
                                                        creation_date: number;
                                                      })
                                                    | {
                                                        _id: string;
                                                      };
                                                };
                                              })
                                            | {
                                                _id: string;
                                              }
                                          )[];
                                        };
                                        contact_references: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                mail: string;
                                                phonenumber: string;
                                                note: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                  )[];
                                  institutions: (
                                    | ({
                                        _id: string;
                                      } & {
                                        name: string;
                                        university: string;
                                        roles: {
                                          [key: string]: string[];
                                        };
                                        notes: {
                                          [key: string]: string;
                                        };
                                        addresses: {
                                          [key: string]:
                                            | ({
                                                _id: string;
                                              } & {
                                                building: string;
                                                number: string;
                                                street: string;
                                                postcode: string;
                                                city: string;
                                                country: string;
                                                creation_date: number;
                                              })
                                            | {
                                                _id: string;
                                              };
                                        };
                                      })
                                    | {
                                        _id: string;
                                      }
                                    | string
                                  )[];
                                  metadata_files: {
                                    file_name: string;
                                    file_link: string;
                                    file_size: number;
                                    file_format: string;
                                  }[];
                                  extensions?: {
                                    [key: string]: unknown;
                                  };
                                }) & {
                                  /** @description Place tuple describing where a physical entity is housed or stored. */
                                  place: {
                                    name: string;
                                    geopolarea: string;
                                    /** @description Structured address fields for institutional or geographic location data. */
                                    address: {
                                      _id: string;
                                    } & {
                                      building: string;
                                      number: string;
                                      street: string;
                                      postcode: string;
                                      city: string;
                                      country: string;
                                      creation_date: number;
                                    };
                                  };
                                  collection: string;
                                  dimensions: {
                                    type: string;
                                    value: string;
                                    name: string;
                                  }[];
                                })
                            )[];
                          });
                      /** @description Stripped user data combined with a profile reference, identifying the creator. */
                      creator: ({
                        _id: string;
                      } & {
                        fullname: string;
                        username: string;
                      }) & {
                        /** @description Reference to a user or organization profile by ID and type. */
                        profile: {
                          profileId: string;
                          /**
                           * @description Defines the type of a profile, which can be either "user" or "organization".
                           * @default user
                           * @enum {string}
                           */
                          type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                        };
                      };
                      online: boolean;
                      finished: boolean;
                      mediaType: string;
                      dataSource: {
                        isExternal: boolean;
                        service: string;
                      };
                      processed: {
                        low: string;
                        medium: string;
                        high: string;
                        raw: string;
                      };
                      /** @description Presentation settings for a 3D entity, including camera, lighting, background, and transforms. */
                      settings: {
                        /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                        position?: {
                          x: number;
                          y: number;
                          z: number;
                        };
                        preview: string;
                        previewVideo?: string;
                        cameraPositionInitial: {
                          /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                          position: {
                            x: number;
                            y: number;
                            z: number;
                          };
                          /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                          target: {
                            x: number;
                            y: number;
                            z: number;
                          };
                        };
                        background: {
                          /** @description A color tuple with red, green, blue, and alpha transparency components. */
                          color: {
                            r: number;
                            b: number;
                            g: number;
                            a: number;
                          };
                          effect: boolean;
                        };
                        lights: {
                          type: string;
                          /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                          position: {
                            x: number;
                            y: number;
                            z: number;
                          };
                          intensity: number;
                        }[];
                        /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                        rotation: {
                          x: number;
                          y: number;
                          z: number;
                        };
                        /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                        scale: {
                          x: number;
                          y: number;
                          z: number;
                        };
                        /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                        translate?: {
                          x: number;
                          y: number;
                          z: number;
                        };
                      };
                      extensions?: {
                        [key: string]: unknown;
                      };
                      /** @description List of users and their access roles for an entity or compilation. */
                      access: (({
                        _id: string;
                      } & {
                        fullname: string;
                        username: string;
                      }) & {
                        /**
                         * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                         * @default owner
                         * @enum {string}
                         */
                        role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                        /** @description Reference to a user or organization profile by ID and type. */
                        profile: {
                          profileId: string;
                          /**
                           * @description Defines the type of a profile, which can be either "user" or "organization".
                           * @default user
                           * @enum {string}
                           */
                          type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                        };
                      })[];
                      options?: {
                        allowDownload?: boolean;
                      };
                    });
              };
              /** @description List of users and their access roles for an entity or compilation. */
              access: (({
                _id: string;
              } & {
                fullname: string;
                username: string;
              }) & {
                /**
                 * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                 * @default owner
                 * @enum {string}
                 */
                role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                /** @description Reference to a user or organization profile by ID and type. */
                profile: {
                  profileId: string;
                  /**
                   * @description Defines the type of a profile, which can be either "user" or "organization".
                   * @default user
                   * @enum {string}
                   */
                  type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                };
              })[];
              online?: boolean;
              password?: string | boolean;
            })[];
          };
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUtilityGenerate-entity-video-preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          screenshots: string[];
          entityId: string;
        };
        'application/x-www-form-urlencoded': {
          screenshots: string[];
          entityId: string;
        };
        'multipart/form-data': {
          screenshots: string[];
          entityId: string;
        };
      };
    };
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
            videoUrl: string;
          };
        };
      };
      /** @description Response for status 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerUtilityChecksumexists': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          checksum: string;
        };
        'application/x-www-form-urlencoded': {
          checksum: string;
        };
        'multipart/form-data': {
          checksum: string;
        };
      };
    };
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            checksum: string;
            existing: boolean;
          };
        };
      };
    };
  };
  'postServerUtilityMoveannotationsById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          annotationList: string[];
        };
        'application/x-www-form-urlencoded': {
          annotationList: string[];
        };
        'multipart/form-data': {
          annotationList: string[];
        };
      };
    };
    responses: {
      /** @description Compilation with fully populated annotation and entity records instead of document references. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': (Record<string, never> & {
            __hits?: number;
            __createdAt?: number;
            __annotationCount?: number;
            __normalizedName?: string;
          } & {
            __licenses?: string[];
            __mediaTypes?: string[];
            __downloadable?: boolean;
          } & {
            _id: string;
          } & {
            name: string;
            description: string;
            /** @description Stripped user data combined with a profile reference, identifying the creator. */
            creator: ({
              _id: string;
            } & {
              fullname: string;
              username: string;
            }) & {
              /** @description Reference to a user or organization profile by ID and type. */
              profile: {
                profileId: string;
                /**
                 * @description Defines the type of a profile, which can be either "user" or "organization".
                 * @default user
                 * @enum {string}
                 */
                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              };
            };
            /** @description List of users and their access roles for an entity or compilation. */
            access: (({
              _id: string;
            } & {
              fullname: string;
              username: string;
            }) & {
              /**
               * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
               * @default owner
               * @enum {string}
               */
              role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
              /** @description Reference to a user or organization profile by ID and type. */
              profile: {
                profileId: string;
                /**
                 * @description Defines the type of a profile, which can be either "user" or "organization".
                 * @default user
                 * @enum {string}
                 */
                type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
              };
            })[];
            online?: boolean;
            password?: string | boolean;
          }) & {
            entities: {
              [key: string]: (Record<string, never> & {
                __hits?: number;
                __createdAt?: number;
                __annotationCount?: number;
                __normalizedName?: string;
              } & {
                __licenses?: string[];
                __mediaTypes?: string[];
                __downloadable?: boolean;
              } & {
                _id: string;
              } & {
                name: string;
                files: {
                  file_name: string;
                  file_link: string;
                  file_size: number;
                  file_format: string;
                }[];
                externalFile?: string;
                /** @description Stripped user data combined with a profile reference, identifying the creator. */
                creator: ({
                  _id: string;
                } & {
                  fullname: string;
                  username: string;
                }) & {
                  /** @description Reference to a user or organization profile by ID and type. */
                  profile: {
                    profileId: string;
                    /**
                     * @description Defines the type of a profile, which can be either "user" or "organization".
                     * @default user
                     * @enum {string}
                     */
                    type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                  };
                };
                online: boolean;
                finished: boolean;
                mediaType: string;
                dataSource: {
                  isExternal: boolean;
                  service: string;
                };
                processed: {
                  low: string;
                  medium: string;
                  high: string;
                  raw: string;
                };
                /** @description Presentation settings for a 3D entity, including camera, lighting, background, and transforms. */
                settings: {
                  /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                  position?: {
                    x: number;
                    y: number;
                    z: number;
                  };
                  preview: string;
                  previewVideo?: string;
                  cameraPositionInitial: {
                    /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                    position: {
                      x: number;
                      y: number;
                      z: number;
                    };
                    /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                    target: {
                      x: number;
                      y: number;
                      z: number;
                    };
                  };
                  background: {
                    /** @description A color tuple with red, green, blue, and alpha transparency components. */
                    color: {
                      r: number;
                      b: number;
                      g: number;
                      a: number;
                    };
                    effect: boolean;
                  };
                  lights: {
                    type: string;
                    /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                    position: {
                      x: number;
                      y: number;
                      z: number;
                    };
                    intensity: number;
                  }[];
                  /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                  rotation: {
                    x: number;
                    y: number;
                    z: number;
                  };
                  /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                  scale: {
                    x: number;
                    y: number;
                    z: number;
                  };
                  /** @description Basic 3D coordinate tuple used for positions, rotations, and translations. */
                  translate?: {
                    x: number;
                    y: number;
                    z: number;
                  };
                };
                extensions?: {
                  [key: string]: unknown;
                };
                /** @description List of users and their access roles for an entity or compilation. */
                access: (({
                  _id: string;
                } & {
                  fullname: string;
                  username: string;
                }) & {
                  /**
                   * @description Defines the access role for e.g. objects (internally entities) or collections (internally compilations), which can be "owner", "editor", or "viewer".
                   * @default owner
                   * @enum {string}
                   */
                  role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
                  /** @description Reference to a user or organization profile by ID and type. */
                  profile: {
                    profileId: string;
                    /**
                     * @description Defines the type of a profile, which can be either "user" or "organization".
                     * @default user
                     * @enum {string}
                     */
                    type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
                  };
                })[];
                options?: {
                  allowDownload?: boolean;
                };
              }) & {
                /** @description Digital entity with fully populated persons, institutions, tags, and physical object records instead of document references. */
                relatedDigitalEntity: (({
                  _id: string;
                } & {
                  title: string;
                  description: string;
                  externalId: {
                    type: string;
                    value: string;
                  }[];
                  externalLink: {
                    description: string;
                    value: string;
                  }[];
                  biblioRefs: {
                    description: string;
                    value: string;
                  }[];
                  other: {
                    description: string;
                    value: string;
                  }[];
                  metadata_files: {
                    file_name: string;
                    file_link: string;
                    file_size: number;
                    file_format: string;
                  }[];
                  extensions?: {
                    [key: string]: unknown;
                  };
                }) & {
                  type: string;
                  licence: string;
                  discipline: string[];
                  dimensions: {
                    type: string;
                    value: string;
                    name: string;
                  }[];
                  creation: {
                    technique: string;
                    program: string;
                    equipment: string;
                    date: string;
                  }[];
                  files: {
                    file_name: string;
                    file_link: string;
                    file_size: number;
                    file_format: string;
                  }[];
                  statement: string;
                  objecttype: string;
                }) &
                  ((Record<string, never> & Record<string, never>) & {
                    persons: (({
                      _id: string;
                    } & {
                      prename: string;
                      name: string;
                      roles: {
                        [key: string]: string[];
                      };
                    }) & {
                      institutions: {
                        [key: string]: ({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                          addresses: {
                            [key: string]:
                              | ({
                                  _id: string;
                                } & {
                                  building: string;
                                  number: string;
                                  street: string;
                                  postcode: string;
                                  city: string;
                                  country: string;
                                  creation_date: number;
                                })
                              | {
                                  _id: string;
                                };
                          };
                        })[];
                      };
                      contact_references: {
                        [key: string]: ({
                          _id: string;
                        } & {
                          mail: string;
                          phonenumber: string;
                          note: string;
                          creation_date: number;
                        })[];
                      };
                    })[];
                    institutions: (({
                      _id: string;
                    } & {
                      name: string;
                      university: string;
                      roles: {
                        [key: string]: string[];
                      };
                      notes: {
                        [key: string]: string;
                      };
                    }) & {
                      addresses: {
                        [key: string]: {
                          _id: string;
                        } & {
                          building: string;
                          number: string;
                          street: string;
                          postcode: string;
                          city: string;
                          country: string;
                          creation_date: number;
                        };
                      };
                    })[];
                  }) & {
                    tags: ({
                      _id: string;
                    } & {
                      value: string;
                    })[];
                    phyObjs: ((({
                      _id: string;
                    } & {
                      title: string;
                      description: string;
                      externalId: {
                        type: string;
                        value: string;
                      }[];
                      externalLink: {
                        description: string;
                        value: string;
                      }[];
                      biblioRefs: {
                        description: string;
                        value: string;
                      }[];
                      other: {
                        description: string;
                        value: string;
                      }[];
                      metadata_files: {
                        file_name: string;
                        file_link: string;
                        file_size: number;
                        file_format: string;
                      }[];
                      extensions?: {
                        [key: string]: unknown;
                      };
                    }) & {
                      /** @description Place tuple describing where a physical entity is housed or stored. */
                      place: {
                        name: string;
                        geopolarea: string;
                        /** @description Structured address fields for institutional or geographic location data. */
                        address: {
                          _id: string;
                        } & {
                          building: string;
                          number: string;
                          street: string;
                          postcode: string;
                          city: string;
                          country: string;
                          creation_date: number;
                        };
                      };
                      collection: string;
                      dimensions: {
                        type: string;
                        value: string;
                        name: string;
                      }[];
                    }) &
                      ((Record<string, never> & Record<string, never>) & {
                        persons: (({
                          _id: string;
                        } & {
                          prename: string;
                          name: string;
                          roles: {
                            [key: string]: string[];
                          };
                        }) & {
                          institutions: {
                            [key: string]: ({
                              _id: string;
                            } & {
                              name: string;
                              university: string;
                              roles: {
                                [key: string]: string[];
                              };
                              notes: {
                                [key: string]: string;
                              };
                              addresses: {
                                [key: string]:
                                  | ({
                                      _id: string;
                                    } & {
                                      building: string;
                                      number: string;
                                      street: string;
                                      postcode: string;
                                      city: string;
                                      country: string;
                                      creation_date: number;
                                    })
                                  | {
                                      _id: string;
                                    };
                              };
                            })[];
                          };
                          contact_references: {
                            [key: string]: ({
                              _id: string;
                            } & {
                              mail: string;
                              phonenumber: string;
                              note: string;
                              creation_date: number;
                            })[];
                          };
                        })[];
                        institutions: (({
                          _id: string;
                        } & {
                          name: string;
                          university: string;
                          roles: {
                            [key: string]: string[];
                          };
                          notes: {
                            [key: string]: string;
                          };
                        }) & {
                          addresses: {
                            [key: string]: {
                              _id: string;
                            } & {
                              building: string;
                              number: string;
                              street: string;
                              postcode: string;
                              city: string;
                              country: string;
                              creation_date: number;
                            };
                          };
                        })[];
                      }))[];
                  };
              } & {
                annotations: {
                  [key: string]: {
                    _id: string;
                  } & {
                    validated: boolean;
                    identifier: string;
                    ranking: number;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    creator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    created: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    generator: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    generated?: string;
                    motivation: string;
                    lastModificationDate?: string;
                    /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                    lastModifiedBy: {
                      _id: string;
                    } & {
                      type: string;
                      name: string;
                      homepage?: string;
                    };
                    positionXOnView?: number;
                    positionYOnView?: number;
                    /** @description Annotation body with a type discriminator and the actual content block. */
                    body: {
                      type: string;
                      /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                      content: {
                        type: string;
                        title: string;
                        description: string;
                        link?: string;
                        /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                        relatedPerspective: {
                          cameraType: string;
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          position:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                          target:
                            | {
                                x: number;
                                y: number;
                                z: number;
                              }
                            | {
                                _x: number;
                                _y: number;
                                _z: number;
                              };
                          preview: string;
                        };
                      } & {
                        [key: string]: unknown;
                      };
                    };
                    /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                    target: {
                      /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                      source: {
                        link?: string;
                        relatedEntity: string;
                        relatedCompilation?: string;
                      };
                      /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                      selector: {
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referencePoint:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                        /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                        referenceNormal:
                          | {
                              x: number;
                              y: number;
                              z: number;
                            }
                          | {
                              _x: number;
                              _y: number;
                              _z: number;
                            };
                      };
                    };
                    extensions?: {
                      [key: string]: unknown;
                    };
                  };
                };
              };
            };
          } & {
            annotations: {
              [key: string]: {
                _id: string;
              } & {
                validated: boolean;
                identifier: string;
                ranking: number;
                /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                creator: {
                  _id: string;
                } & {
                  type: string;
                  name: string;
                  homepage?: string;
                };
                created: string;
                /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                generator: {
                  _id: string;
                } & {
                  type: string;
                  name: string;
                  homepage?: string;
                };
                generated?: string;
                motivation: string;
                lastModificationDate?: string;
                /** @description An agent (person, organization, or software) involved in creating or modifying an annotation. */
                lastModifiedBy: {
                  _id: string;
                } & {
                  type: string;
                  name: string;
                  homepage?: string;
                };
                positionXOnView?: number;
                positionYOnView?: number;
                /** @description Annotation body with a type discriminator and the actual content block. */
                body: {
                  type: string;
                  /** @description Rich content block for an annotation, with type, title, description, link, and a related camera perspective. */
                  content: {
                    type: string;
                    title: string;
                    description: string;
                    link?: string;
                    /** @description Camera perspective defining the view angle, position, target, and preview screenshot for a scene. */
                    relatedPerspective: {
                      cameraType: string;
                      /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                      position:
                        | {
                            x: number;
                            y: number;
                            z: number;
                          }
                        | {
                            _x: number;
                            _y: number;
                            _z: number;
                          };
                      /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                      target:
                        | {
                            x: number;
                            y: number;
                            z: number;
                          }
                        | {
                            _x: number;
                            _y: number;
                            _z: number;
                          };
                      preview: string;
                    };
                  } & {
                    [key: string]: unknown;
                  };
                };
                /** @description Annotation target combining the referenced source entity with its 3D placement selector. */
                target: {
                  /** @description Identifies the target resource of an annotation by entity and optional compilation. */
                  source: {
                    link?: string;
                    relatedEntity: string;
                    relatedCompilation?: string;
                  };
                  /** @description Spatial selector with a reference point and normal vector for placing annotations in 3D space. */
                  selector: {
                    /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                    referencePoint:
                      | {
                          x: number;
                          y: number;
                          z: number;
                        }
                      | {
                          _x: number;
                          _y: number;
                          _z: number;
                        };
                    /** @description Flexible 3D vector that supports both x/y/z and _x/_y/_z property naming. Used because serialized BabylonJS Vector3 objects may use underscore-prefixed keys. */
                    referenceNormal:
                      | {
                          x: number;
                          y: number;
                          z: number;
                        }
                      | {
                          _x: number;
                          _y: number;
                          _z: number;
                        };
                  };
                };
                extensions?: {
                  [key: string]: unknown;
                };
              };
            };
          };
        };
      };
      /** @description Response for status 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerApiV1Health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
    };
  };
  'getServerApiV1GetFindByCollectionByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
        identifier: string;
        password: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV1GetFindByCollectionByIdentifierByPassword': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
        identifier: string;
        password: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV1GetFindallByCollection': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV1GetId': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV1PostExplore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': Record<string, never>;
        'application/x-www-form-urlencoded': Record<string, never>;
        'multipart/form-data': Record<string, never>;
      };
    };
    responses: never;
  };
  'postServerApiV1PostRemoveByCollectionByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
        identifier: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
        'application/x-www-form-urlencoded': {
          username: string;
          password: string;
        };
        'multipart/form-data': {
          username: string;
          password: string;
        };
      };
    };
    responses: never;
  };
  'getServerApiV1GetUsers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV1PostPushByCollection': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': unknown;
        'application/x-www-form-urlencoded': unknown;
        'multipart/form-data': unknown;
      };
    };
    responses: never;
  };
  'postServerApiV1PostSettingsByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        identifier: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': unknown;
        'application/x-www-form-urlencoded': unknown;
        'multipart/form-data': unknown;
      };
    };
    responses: never;
  };
  'getServerApiV2Health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
    };
  };
  'getServerApiV2User-dataByCollection': {
    parameters: {
      query?: {
        full?: boolean;
        depth?: number;
        profileId?: string;
      };
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2User-dataUpdate-entity-access': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Identifier of the entity */
          _id: string;
          access: {
            /** @description Same identifier of the user */
            _id: string;
            /** @description Full name of the user */
            fullname: string;
            /** @description Username of the user */
            username: string;
            /** @enum {string} */
            role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
            profile: {
              /** @description The profile ID associated with the user */
              profileId: string;
              /** @enum {string} */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
            };
          }[];
        };
        'application/x-www-form-urlencoded': {
          /** @description Identifier of the entity */
          _id: string;
          access: {
            /** @description Same identifier of the user */
            _id: string;
            /** @description Full name of the user */
            fullname: string;
            /** @description Username of the user */
            username: string;
            /** @enum {string} */
            role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
            profile: {
              /** @description The profile ID associated with the user */
              profileId: string;
              /** @enum {string} */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
            };
          }[];
        };
        'multipart/form-data': {
          /** @description Identifier of the entity */
          _id: string;
          access: {
            /** @description Same identifier of the user */
            _id: string;
            /** @description Full name of the user */
            fullname: string;
            /** @description Username of the user */
            username: string;
            /** @enum {string} */
            role: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole;
            profile: {
              /** @description The profile ID associated with the user */
              profileId: string;
              /** @enum {string} */
              type: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType;
            };
          }[];
        };
      };
    };
    responses: never;
  };
  'postServerApiV2User-dataTransfer-ownership': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json':
          | {
              /** @description The collection type. Only "entity"" and "compilation" are supported as values */
              collection:
                | 'address'
                | 'annotation'
                | 'compilation'
                | 'contact'
                | 'digitalentity'
                | 'entity'
                | 'institution'
                | 'person'
                | 'physicalentity'
                | 'tag';
              /** @description The ID of the entity or compilation to transfer ownership of. */
              docId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            }
          | {
              /** @description The ID of the entity to transfer ownership of. */
              entityId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            };
        'application/x-www-form-urlencoded':
          | {
              /** @description The collection type. Only "entity"" and "compilation" are supported as values */
              collection:
                | 'address'
                | 'annotation'
                | 'compilation'
                | 'contact'
                | 'digitalentity'
                | 'entity'
                | 'institution'
                | 'person'
                | 'physicalentity'
                | 'tag';
              /** @description The ID of the entity or compilation to transfer ownership of. */
              docId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            }
          | {
              /** @description The ID of the entity to transfer ownership of. */
              entityId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            };
        'multipart/form-data':
          | {
              /** @description The collection type. Only "entity"" and "compilation" are supported as values */
              collection:
                | 'address'
                | 'annotation'
                | 'compilation'
                | 'contact'
                | 'digitalentity'
                | 'entity'
                | 'institution'
                | 'person'
                | 'physicalentity'
                | 'tag';
              /** @description The ID of the entity or compilation to transfer ownership of. */
              docId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            }
          | {
              /** @description The ID of the entity to transfer ownership of. */
              entityId: string;
              /** @description The ID of the user to transfer ownership to. */
              targetUserId: string;
            };
      };
    };
    responses: never;
  };
  'getServerApiV2ProfileHealth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'OK';
          };
        };
      };
    };
  };
  'getServerApiV2ProfileUser-of-profileById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV2ProfileVia-idById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2ProfileOrganization': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2ProfileOrganizationById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2ProfileUser': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV2List-entity-formats': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerApiV2Entities-by-formatByFormats': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        formats: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2Explore': {
    parameters: {
      query?: {
        profileId?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          searchText: string;
          /** @enum {string} */
          filterBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonFilterBy;
          mediaTypes: string[];
          annotations: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonAnnotations[];
          access: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole[];
          licences: string[];
          misc: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonMisc[];
          offset: number;
          limit: number;
          reversed: boolean;
          /** @enum {string} */
          sortBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonSortBy;
        };
        'application/x-www-form-urlencoded': {
          searchText: string;
          /** @enum {string} */
          filterBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonFilterBy;
          mediaTypes: string[];
          annotations: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonAnnotations[];
          access: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole[];
          licences: string[];
          misc: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonMisc[];
          offset: number;
          limit: number;
          reversed: boolean;
          /** @enum {string} */
          sortBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonSortBy;
        };
        'multipart/form-data': {
          searchText: string;
          /** @enum {string} */
          filterBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonFilterBy;
          mediaTypes: string[];
          annotations: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonAnnotations[];
          access: PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole[];
          licences: string[];
          misc: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonMisc[];
          offset: number;
          limit: number;
          reversed: boolean;
          /** @enum {string} */
          sortBy: PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonSortBy;
        };
      };
    };
    responses: never;
  };
  'getServerApiV2Explore-popular-searches': {
    parameters: {
      query: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2Remove-self-from-accessByCollectionByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        collection: PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection;
        identifier: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerApiV2CompilationCreate-empty': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The name of the new compilation. */
          name: string;
          /** @description A description for the compilation. */
          description: string;
          /** @description The profile identifier to associate the compilation with. */
          profileId: string;
        };
        'application/x-www-form-urlencoded': {
          /** @description The name of the new compilation. */
          name: string;
          /** @description A description for the compilation. */
          description: string;
          /** @description The profile identifier to associate the compilation with. */
          profileId: string;
        };
        'multipart/form-data': {
          /** @description The name of the new compilation. */
          name: string;
          /** @description A description for the compilation. */
          description: string;
          /** @description The profile identifier to associate the compilation with. */
          profileId: string;
        };
      };
    };
    responses: never;
  };
  'postServerApiV2CompilationUpdate-metadata': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The identifier of the compilation to update. */
          _id: string;
          /** @description The new name of the compilation. */
          name: string;
          /** @description The new description for the compilation. */
          description: string;
          /** @description The profile identifier updating the compilation. */
          profileId: string;
        };
        'application/x-www-form-urlencoded': {
          /** @description The identifier of the compilation to update. */
          _id: string;
          /** @description The new name of the compilation. */
          name: string;
          /** @description The new description for the compilation. */
          description: string;
          /** @description The profile identifier updating the compilation. */
          profileId: string;
        };
        'multipart/form-data': {
          /** @description The identifier of the compilation to update. */
          _id: string;
          /** @description The new name of the compilation. */
          name: string;
          /** @description The new description for the compilation. */
          description: string;
          /** @description The profile identifier updating the compilation. */
          profileId: string;
        };
      };
    };
    responses: never;
  };
  'postServerApiV2CompilationAdd-entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          compilationIds: string[];
          /** @description An array of entity identifiers to add to the compilation(s). */
          entityIds: string[];
        };
        'application/x-www-form-urlencoded': {
          compilationIds: string[];
          /** @description An array of entity identifiers to add to the compilation(s). */
          entityIds: string[];
        };
        'multipart/form-data': {
          compilationIds: string[];
          /** @description An array of entity identifiers to add to the compilation(s). */
          entityIds: string[];
        };
      };
    };
    responses: never;
  };
  'postServerApiV2CompilationRemove-entities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The identifier of the compilation. */
          compilationId: string;
          /** @description An array of entity identifiers to remove from the compilation. */
          entityIds: string[];
        };
        'application/x-www-form-urlencoded': {
          /** @description The identifier of the compilation. */
          compilationId: string;
          /** @description An array of entity identifiers to remove from the compilation. */
          entityIds: string[];
        };
        'multipart/form-data': {
          /** @description The identifier of the compilation. */
          compilationId: string;
          /** @description An array of entity identifiers to remove from the compilation. */
          entityIds: string[];
        };
      };
    };
    responses: never;
  };
  'postServerMailSendmail': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          mailbody: string;
          subject: string;
          /** @enum {string} */
          target: PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget;
        };
        'application/x-www-form-urlencoded': {
          mailbody: string;
          subject: string;
          /** @enum {string} */
          target: PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget;
        };
        'multipart/form-data': {
          mailbody: string;
          subject: string;
          /** @enum {string} */
          target: PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget;
        };
      };
    };
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/plain': boolean;
        };
      };
      /** @description Response for status 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerMailGetmailentries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            targets: string[];
            entries: ({
              /** @enum {string} */
              target: PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget;
              content: {
                subject: string;
                mailbody: string;
              };
              timestamp: string;
              user: string;
              answered: boolean;
              mailSent: boolean;
            } & {
              [key: string]: unknown;
            })[];
          };
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'postServerMailToggleansweredByTargetByIdentifier': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        target: string;
        identifier: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Response for status 200 */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            target: PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget;
            content: {
              subject: string;
              mailbody: string;
            };
            timestamp: string;
            user: string;
            answered: boolean;
            mailSent: boolean;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Response for status 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  'getServerUploads*': {
    parameters: {
      query?: never;
      header?: {
        'range'?: string;
        'accept-encoding'?: string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerDownloadOptionsByEntityId': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        entityId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerDownloadPrepareByEntityIdByType': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        entityId: string;
        type: PathsServerDownloadPrepareEntityIdTypeGetParametersPathType;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'getServerDownloadByEntityIdByType': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        entityId: string;
        type: PathsServerDownloadPrepareEntityIdTypeGetParametersPathType;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerUploadChunkInit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: never;
  };
  'postServerUploadChunkUpload': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /**
           * Format: binary
           * @default File
           */
          chunk: string;
          uploadId: string;
          index: string | number;
        };
        'application/x-www-form-urlencoded': {
          /**
           * Format: binary
           * @default File
           */
          chunk: string;
          uploadId: string;
          index: string | number;
        };
        'multipart/form-data': {
          /**
           * Format: binary
           * @default File
           */
          chunk: string;
          uploadId: string;
          index: string | number;
        };
      };
    };
    responses: never;
  };
  'postServerUploadChunkFinish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          uploadId: string;
          filename: string;
          relativePath: string;
          token: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          uploadId: string;
          filename: string;
          relativePath: string;
          token: string;
          type: string;
        };
        'multipart/form-data': {
          uploadId: string;
          filename: string;
          relativePath: string;
          token: string;
          type: string;
        };
      };
    };
    responses: never;
  };
  'postServerUploadFile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /**
           * Format: binary
           * @default File
           */
          file: string;
          relativePath: string;
          token: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          /**
           * Format: binary
           * @default File
           */
          file: string;
          relativePath: string;
          token: string;
          type: string;
        };
        'multipart/form-data': {
          /**
           * Format: binary
           * @default File
           */
          file: string;
          relativePath: string;
          token: string;
          type: string;
        };
      };
    };
    responses: never;
  };
  'postServerUploadProcessStart': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          uuid: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          uuid: string;
          type: string;
        };
        'multipart/form-data': {
          uuid: string;
          type: string;
        };
      };
    };
    responses: never;
  };
  'postServerUploadProcessInfo': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          uuid: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          uuid: string;
          type: string;
        };
        'multipart/form-data': {
          uuid: string;
          type: string;
        };
      };
    };
    responses: never;
  };
  'postServerUploadFinish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          uuid: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          uuid: string;
          type: string;
        };
        'multipart/form-data': {
          uuid: string;
          type: string;
        };
      };
    };
    responses: never;
  };
  'postServerUploadCancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          uuid: string;
          type: string;
        };
        'application/x-www-form-urlencoded': {
          uuid: string;
          type: string;
        };
        'multipart/form-data': {
          uuid: string;
          type: string;
        };
      };
    };
    responses: never;
  };
}
export enum PathsServerAdminPromoteuserPostRequestBodyContentApplicationJsonRole {
  uploader = 'uploader',
  admin = 'admin',
}
export enum PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0CreatorProfileType {
  user = 'user',
  organization = 'organization',
}
export enum PathsServerUserManagementLoginStrategyPostResponses200ContentApplicationJsonDataCompilationAnyOf0EntitiesAnyOf1AccessRole {
  owner = 'owner',
  editor = 'editor',
  viewer = 'viewer',
}
export enum PathsServerApiV1GetFindCollectionIdentifierGetParametersPathCollection {
  address = 'address',
  annotation = 'annotation',
  compilation = 'compilation',
  contact = 'contact',
  digitalentity = 'digitalentity',
  entity = 'entity',
  institution = 'institution',
  person = 'person',
  physicalentity = 'physicalentity',
  tag = 'tag',
}
export enum PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonFilterBy {
  objects = 'objects',
  collections = 'collections',
  institutions = 'institutions',
}
export enum PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonAnnotations {
  with_annotations = 'with-annotations',
  without_annotations = 'without-annotations',
}
export enum PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonMisc {
  downloadable = 'downloadable',
  animated = 'animated',
}
export enum PathsServerApiV2ExplorePostRequestBodyContentApplicationJsonSortBy {
  name = 'name',
  popularity = 'popularity',
  usage = 'usage',
  annotations = 'annotations',
  newest = 'newest',
}
export enum PathsServerMailSendmailPostRequestBodyContentApplicationJsonTarget {
  contact = 'contact',
  upload = 'upload',
  bugreport = 'bugreport',
}
export enum PathsServerDownloadPrepareEntityIdTypeGetParametersPathType {
  raw = 'raw',
  processed = 'processed',
}
export enum ApiPaths {
  getServerHealth = '/server/health',
  getServerCologne_cave_apiAll_entities = '/server/cologne-cave-api/all-entities',
  getServerDfg_mets_apiEntityById = '/server/dfg-mets-api/entity/{id}',
  getServerDfg_mets_apiEntities = '/server/dfg-mets-api/entities',
  getServerOidcHealth = '/server/oidc/health',
  getServerOidcLogin = '/server/oidc/login',
  getServerOidcCallback = '/server/oidc/callback',
  getServerSketchfab_importHealth = '/server/sketchfab-import/health',
  getServerSketchfab_importModel_infoById = '/server/sketchfab-import/model-info/{id}',
  postServerSketchfab_importGet_models = '/server/sketchfab-import/get-models',
  postServerSketchfab_importDownload_and_prepare_model = '/server/sketchfab-import/download-and-prepare-model',
  getServerSso_nfdi4cultureActionsRegister = '/server/sso-nfdi4culture/actions/register',
  getServerSso_nfdi4cultureActionsRetrieve = '/server/sso-nfdi4culture/actions/retrieve',
  getServerSso_nfdi4cultureSamlHealth = '/server/sso-nfdi4culture/saml/health',
  getServerSso_nfdi4cultureSaml = '/server/sso-nfdi4culture/saml',
  postServerUser_managementAuthSamlCallback = '/server/user-management/auth/saml/callback',
  postServerSso_nfdi4cultureSamlCallback = '/server/sso-nfdi4culture/saml/callback',
  getServerWikibaseParsed_model = '/server/wikibase/parsed-model',
  getServerWikibaseChoicesMetadata = '/server/wikibase/choices/metadata',
  getServerWikibaseChoicesAnnotation_link = '/server/wikibase/choices/annotation-link',
  getServerWikibaseInstanceInfo = '/server/wikibase/instance/info',
  postServerAdminDigest = '/server/admin/digest',
  postServerAdminStats = '/server/admin/stats',
  postServerAdminGetusers = '/server/admin/getusers',
  postServerAdminGetuserByIdentifier = '/server/admin/getuser/{identifier}',
  postServerAdminPromoteuser = '/server/admin/promoteuser',
  postServerAdminTogglepublished = '/server/admin/togglepublished',
  postServerAdminResetpasswordByUsername = '/server/admin/resetpassword/{username}',
  postServerUser_managementLoginByStrategy = '/server/user-management/login/{strategy}',
  postServerUser_managementLogin = '/server/user-management/login',
  postServerUser_managementRegister = '/server/user-management/register',
  getServerUser_managementLogout = '/server/user-management/logout',
  getServerUser_managementAuth = '/server/user-management/auth',
  postServerUser_managementHelpRequest_reset = '/server/user-management/help/request-reset',
  postServerUser_managementHelpConfirm_reset = '/server/user-management/help/confirm-reset',
  postServerUser_managementHelpForgot_username = '/server/user-management/help/forgot-username',
  getServerUtilityHealth = '/server/utility/health',
  getServerUtilityCountentityusesById = '/server/utility/countentityuses/{id}',
  postServerUtilityGenerate_entity_video_preview = '/server/utility/generate-entity-video-preview',
  postServerUtilityChecksumexists = '/server/utility/checksumexists',
  postServerUtilityMoveannotationsById = '/server/utility/moveannotations/{id}',
  getServerApiV1Health = '/server/api/v1/health',
  getServerApiV1GetFindByCollectionByIdentifier = '/server/api/v1/get/find/{collection}/{identifier}',
  getServerApiV1GetFindByCollectionByIdentifierByPassword = '/server/api/v1/get/find/{collection}/{identifier}/{password}',
  getServerApiV1GetFindallByCollection = '/server/api/v1/get/findall/{collection}',
  getServerApiV1GetId = '/server/api/v1/get/id',
  postServerApiV1PostExplore = '/server/api/v1/post/explore',
  postServerApiV1PostRemoveByCollectionByIdentifier = '/server/api/v1/post/remove/{collection}/{identifier}',
  getServerApiV1GetUsers = '/server/api/v1/get/users',
  postServerApiV1PostPushByCollection = '/server/api/v1/post/push/{collection}',
  postServerApiV1PostSettingsByIdentifier = '/server/api/v1/post/settings/{identifier}',
  getServerApiV2Health = '/server/api/v2/health',
  getServerApiV2User_dataByCollection = '/server/api/v2/user-data/{collection}',
  postServerApiV2User_dataUpdate_entity_access = '/server/api/v2/user-data/update-entity-access',
  postServerApiV2User_dataTransfer_ownership = '/server/api/v2/user-data/transfer-ownership',
  getServerApiV2ProfileHealth = '/server/api/v2/profile/health',
  getServerApiV2ProfileUser_of_profileById = '/server/api/v2/profile/user-of-profile/{id}',
  getServerApiV2ProfileVia_idById = '/server/api/v2/profile/via-id/{id}',
  postServerApiV2ProfileOrganization = '/server/api/v2/profile/organization',
  postServerApiV2ProfileOrganizationById = '/server/api/v2/profile/organization/{id}',
  postServerApiV2ProfileUser = '/server/api/v2/profile/user',
  getServerApiV2List_entity_formats = '/server/api/v2/list-entity-formats',
  getServerApiV2Entities_by_formatByFormats = '/server/api/v2/entities-by-format/{formats}',
  postServerApiV2Explore = '/server/api/v2/explore',
  getServerApiV2Explore_popular_searches = '/server/api/v2/explore-popular-searches',
  postServerApiV2Remove_self_from_accessByCollectionByIdentifier = '/server/api/v2/remove-self-from-access/{collection}/{identifier}',
  postServerApiV2CompilationCreate_empty = '/server/api/v2/compilation/create-empty',
  postServerApiV2CompilationUpdate_metadata = '/server/api/v2/compilation/update-metadata',
  postServerApiV2CompilationAdd_entities = '/server/api/v2/compilation/add-entities',
  postServerApiV2CompilationRemove_entities = '/server/api/v2/compilation/remove-entities',
  postServerMailSendmail = '/server/mail/sendmail',
  postServerMailGetmailentries = '/server/mail/getmailentries',
  postServerMailToggleansweredByTargetByIdentifier = '/server/mail/toggleanswered/{target}/{identifier}',
  getServerUploads_ = '/server/uploads/*',
  getServerDownloadOptionsByEntityId = '/server/download/options/{entityId}',
  getServerDownloadPrepareByEntityIdByType = '/server/download/prepare/{entityId}/{type}',
  getServerDownloadByEntityIdByType = '/server/download/{entityId}/{type}',
  postServerUploadChunkInit = '/server/upload/chunk/init',
  postServerUploadChunkUpload = '/server/upload/chunk/upload',
  postServerUploadChunkFinish = '/server/upload/chunk/finish',
  postServerUploadFile = '/server/upload/file',
  postServerUploadProcessStart = '/server/upload/process/start',
  postServerUploadProcessInfo = '/server/upload/process/info',
  postServerUploadFinish = '/server/upload/finish',
  postServerUploadCancel = '/server/upload/cancel',
}
