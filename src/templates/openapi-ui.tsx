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
    <div class="mt-4">
      <h4 class="font-semibold text-gray-900 mb-2">Responses:</h4>
      <div class="space-y-2">
        {Object.entries(responses).map(([code, response]) => (
          <div class="flex items-start space-x-2">
            <code class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono" safe>
              {code}
            </code>
            <span class="text-gray-700 text-sm" safe>
              {response.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div class="mt-4">
      <h4 class="font-semibold text-gray-900 mb-2">Responses:</h4>
      <p class="text-gray-500 text-sm">No responses defined</p>
    </div>
  );
};

const Tags = (props: { tags: OpenAPISpecMethodProperties['tags'] } | undefined) => {
  return (
    <div class="mt-4">
      <h4 class="font-semibold text-gray-900 mb-2">Tags:</h4>
      {props?.tags?.length ? (
        <div class="flex flex-wrap gap-2">
          {props.tags.map(tag => (
            <span safe class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p class="text-gray-500 text-sm">None</p>
      )}
    </div>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const methodColors = {
    get: 'bg-blue-500 text-white',
    post: 'bg-green-500 text-white',
    put: 'bg-yellow-500 text-white',
    delete: 'bg-red-500 text-white',
    patch: 'bg-purple-500 text-white',
    head: 'bg-gray-500 text-white',
    options: 'bg-indigo-500 text-white',
    trace: 'bg-pink-500 text-white',
  };

  return (
    <span
      class={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${methodColors[method.toLowerCase() as keyof typeof methodColors] || 'bg-gray-500 text-white'}`}
      safe
    >
      {method}
    </span>
  );
};

const Sidebar = ({ paths }: { paths: OpenAPISpec['paths'] }) => {
  return (
    <div class="fixed left-0 top-0 h-full w-64 md:w-72 lg:w-80 xl:w-96 bg-white border-r border-gray-200 overflow-y-auto z-10">
      <div class="p-4 border-b border-gray-200">
        <h3 class="font-semibold text-gray-900">Routes</h3>
      </div>
      <div class="p-2">
        {Object.entries(paths).map(([path, methods]) => (
          <div class="mb-2">
            <a
              href={`#${path}`}
              class="block px-3 py-2 rounded-md text-sm font-mono text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              safe
            >
              {path}
            </a>
            <div class="ml-4 mt-1 space-y-1">
              {Object.entries(methods).map(([method, operation]) => (
                <a
                  href={`#${path}-${method}`}
                  class="flex items-center space-x-2 px-2 py-1 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  <MethodBadge method={method} />
                  <span class="text-gray-600 truncate" safe>
                    {operation.summary || operation.description || 'No summary'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Endpoint = ({ path, methods }: { path: string; methods: OpenAPISpec['paths'][string] }) => {
  return (
    <div
      id={path}
      class="bg-white border border-gray-200 rounded-lg shadow-sm mb-6 overflow-hidden"
    >
      <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900 font-mono" safe>
          {path}
        </h3>
      </div>
      <div class="divide-y divide-gray-200">
        {Object.entries(methods).map(([method, operation]) => (
          <details class="group" id={`${path}-${method}`}>
            <summary class="cursor-pointer px-6 py-4 hover:bg-gray-50 transition-colors duration-150 flex">
              <div class="flex items-center space-x-3">
                <MethodBadge method={method} />
                <span class="text-gray-900 font-medium" safe>
                  {operation.summary || operation.description || 'No summary'}
                </span>
              </div>
            </summary>
            <div class="px-6 py-4 bg-gray-50">
              {operation.description ? (
                <p class="text-gray-700 mb-4" safe>
                  {operation.description}
                </p>
              ) : (
                ''
              )}

              <Tags tags={operation.tags} />

              {operation.parameters?.length ? (
                <div class="mt-4">
                  <h4 class="font-semibold text-gray-900 mb-2">Parameters:</h4>
                  <div class="space-y-2">
                    {operation.parameters.map(param => (
                      <div class="flex items-start space-x-2">
                        <code
                          class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono"
                          safe
                        >
                          {param.name}
                        </code>
                        <span class="text-gray-600 text-sm">({param.in})</span>
                        {param.required && <span class="text-red-500 text-sm">*</span>}
                        {param.description ? (
                          <span class="text-gray-700 text-sm" safe>
                            - {param.description}
                          </span>
                        ) : (
                          ''
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {operation.requestBody?.content['application/json'] ? (
                <div class="mt-4">
                  <h4 class="font-semibold text-gray-900 mb-2">
                    Request Body:
                    {operation.requestBody.required && <span class="text-red-500 ml-1">*</span>}
                  </h4>
                  {operation.requestBody.description ? (
                    <p class="text-gray-700 mb-2 text-sm" safe>
                      {operation.requestBody.description}
                    </p>
                  ) : (
                    ''
                  )}

                  <div class="space-y-2">
                    {operation.requestBody?.content['application/json'].example ? (
                      <details class="group/example">
                        <summary class="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                          Example
                        </summary>
                        <pre class="mt-2 bg-gray-800 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
                          <code safe>
                            {JSON.stringify(
                              operation.requestBody?.content['application/json'].example,
                              null,
                              2,
                            )}
                          </code>
                        </pre>
                      </details>
                    ) : null}

                    {operation.requestBody?.content['application/json'].schema &&
                    !operation.requestBody?.content['application/json'].example ? (
                      <details class="group/schema">
                        <summary class="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 flex align-center">
                          Schema
                        </summary>
                        <pre class="mt-2 bg-gray-800 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
                          <code safe>
                            {JSON.stringify(
                              operation.requestBody?.content['application/json'].schema,
                              null,
                              2,
                            )}
                          </code>
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {operation.responses && Object.keys(operation.responses).length > 0 ? (
                <Responses responses={operation.responses} />
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export const openApiUI = async () => {
  const json = await Bun.fetch('http://localhost:3030/server/swagger/json').then(res => res.json());
  const OpenAPI = json as OpenAPISpec;

  return (
    '<!DOCTYPE html>' +
    (
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title safe>{OpenAPI.info.title} - API Documentation</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            {`
              html {
                scroll-behavior: smooth;
              }
              body {
                scroll-padding-top: 20px;
              }
            `}
          </style>
        </head>
        <body class="bg-gray-50 min-h-screen">
          <Sidebar paths={OpenAPI.paths} />
          <div class="ml-64 md:ml-72 lg:ml-80 xl:ml-96 min-h-screen">
            <div class="container mx-auto px-4 py-8 max-w-4xl">
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                <div class="px-8 py-6">
                  <h1 class="text-3xl font-bold text-gray-900 mb-2" safe>
                    {OpenAPI.info.title}
                  </h1>
                  <p class="text-gray-600 mb-4 text-lg" safe>
                    {OpenAPI.info.description}
                  </p>
                  <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded" safe>
                      Version: {OpenAPI.info.version}
                    </span>
                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded" safe>
                      OpenAPI {OpenAPI.openapi}
                    </span>
                  </div>
                  <p class="mt-4 text-gray-500 text-sm">
                    Spec URL:{' '}
                    <a href="/server/swagger/json" class="text-blue-600 hover:underline">
                      /server/swagger/json
                    </a>
                  </p>
                </div>
              </div>

              <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">Endpoints</h2>
                <div class="space-y-4">
                  {Object.entries(OpenAPI.paths).map(([path, methods]) => (
                    <Endpoint path={path} methods={methods} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    )
  );
};
