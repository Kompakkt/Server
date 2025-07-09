type OpenAPISpecMethodProperties = {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    schema?: {
      type: string;
      format?: string;
      default?: any;
      example?: any;
    };
  }>;
  requestBody?: {
    description?: string;
    required?: boolean;
    content: {
      [mediaType: string]: {
        schema?: any;
        example?: any;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string | undefined;
      content?: {
        [mediaType: string]: {
          schema?: any;
          example?: any;
        };
      };
    };
  };
};

type OpenAPISpec = {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: {
    [path: string]: {
      [method in
        | 'get'
        | 'post'
        | 'put'
        | 'delete'
        | 'patch'
        | 'head'
        | 'options'
        | 'trace']?: OpenAPISpecMethodProperties;
    };
  };
  components?: {
    schemas?: {
      [schemaName: string]: any;
    };
    securitySchemes?: {
      [schemeName: string]: {
        type: string;
        scheme?: string;
        bearerFormat?: string;
        description?: string;
      };
    };
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
};

const Responses = (props: { responses: OpenAPISpecMethodProperties['responses'] } | undefined) => {
  if (!props?.responses) return '';
  const responses = Object.fromEntries(
    Object.entries(props.responses).filter(([code, response]) => !!response.description?.length),
  );

  return Object.keys(responses).length > 0 ? (
    <div>
      <strong>Responses:</strong>
      <ul>
        {Object.entries(responses).map(([code, response]) => (
          <li id={code}>
            <code safe>{code}</code> - <span safe>{response.description}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div>
      <strong>Responses:</strong>
      <p>No responses defined</p>
    </div>
  );
};

const Tags = (props: { tags: OpenAPISpecMethodProperties['tags'] } | undefined) => {
  return props?.tags ? (
    <p>
      <strong>Tags:</strong>
      {props.tags.map(tag => (
        <span
          style={{
            background: '#e9ecef',
            padding: '2px 6px',
            margin: '0 4px',
            borderRadius: '3px',
          }}
          safe
        >
          {tag}
        </span>
      ))}
    </p>
  ) : (
    <p>
      <strong>Tags:</strong> None
    </p>
  );
};

const Endpoint = ({ path, methods }: { path: string; methods: OpenAPISpec['paths'][string] }) => {
  return (
    <div id={path} class="endpoint">
      <div class="endpoint-header">
        <h3 safe>{path}</h3>
      </div>
      {Object.entries(methods).map(([method, operation]) => (
        <details id={`${path}-${method}`} style={{ margin: '8px' }}>
          <summary>
            <span class={`method-badge ${method.toLowerCase()}`} safe>
              {method.toUpperCase()}
            </span>
            <span safe>{operation.summary || operation.description || 'No summary'}</span>
          </summary>
          <div style={{ padding: '12px' }}>
            {operation.description ? <p safe>{operation.description}</p> : ''}
            <Tags tags={operation.tags} />
            {operation.parameters?.length ? (
              <div>
                <strong>Parameters:</strong>
                <ul>
                  {operation.parameters.map((param, idx) => (
                    <li id={idx}>
                      <code safe>{param.name}</code> ({param.in})
                      {param.required && <span style={{ color: 'red' }}> *</span>}
                      {param.description ? <span safe> - {param.description}</span> : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              ''
            )}
            {operation.requestBody?.content['application/json'] ? (
              <div>
                <strong>Request Body:</strong>
                {operation.requestBody.required && <span style={{ color: 'red' }}> *</span>}
                {operation.requestBody.description ? (
                  <p safe>{operation.requestBody.description}</p>
                ) : (
                  ''
                )}

                <div style={{ marginTop: '8px' }}>
                  {operation.requestBody?.content['application/json'].example ? (
                    <details>
                      <summary>Example</summary>
                      <pre
                        style={{
                          background: '#f8f9fa',
                          padding: '12px',
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '0.9em',
                        }}
                      >
                        <code safe>
                          {JSON.stringify(
                            operation.requestBody?.content['application/json'].example,
                            null,
                            2,
                          )}
                        </code>
                      </pre>
                    </details>
                  ) : (
                    ''
                  )}
                  {operation.requestBody?.content['application/json'].schema &&
                  !operation.requestBody?.content['application/json'].example ? (
                    <details>
                      <summary>Schema</summary>
                      <pre
                        style={{
                          background: '#f8f9fa',
                          padding: '12px',
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '0.9em',
                        }}
                      >
                        <code safe>
                          {JSON.stringify(
                            operation.requestBody?.content['application/json'].schema,
                            null,
                            2,
                          )}
                        </code>
                      </pre>
                    </details>
                  ) : (
                    ''
                  )}
                </div>
              </div>
            ) : (
              ''
            )}
            {operation.responses && Object.keys(operation.responses).length > 0 ? (
              <Responses responses={operation.responses} />
            ) : (
              ''
            )}
          </div>
        </details>
      ))}
    </div>
  );
};

export const openApiUI = async () => {
  const json = await Bun.fetch('http://localhost:3030/server/swagger/json').then(res => res.json());
  const OpenAPI = json as OpenAPISpec;

  return (
    '<!DOCTYPE html>' +
    (
      <html>
        <head>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css" />
          <style>{`
                  .method-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    color: white;
                    font-size: 0.8em;
                    font-weight: bold;
                    margin-right: 8px;
                  }
                  .get { background-color: #61affe; }
                  .post { background-color: #49cc90; }
                  .put { background-color: #fca130; }
                  .delete { background-color: #f93e3e; }
                  .patch { background-color: #50e3c2; }
                  .endpoint { margin: 16px 0; border: 1px solid #ddd; border-radius: 4px; }
                  .endpoint-header { padding: 12px; background-color: #f8f9fa; }
                  h1, h2, h3 { margin: 0; }
                `}</style>
        </head>
        <body>
          <div>
            <h1 safe>{OpenAPI.info.title}</h1>
            <p safe>{OpenAPI.info.description}</p>
            <p safe>
              Version: {OpenAPI.info.version} - OpenAPI {OpenAPI.openapi}
            </p>

            <h2>Endpoints</h2>
            {Object.entries(OpenAPI.paths).map(([path, methods]) => (
              <Endpoint path={path} methods={methods} />
            ))}
          </div>
        </body>
      </html>
    )
  );
};
