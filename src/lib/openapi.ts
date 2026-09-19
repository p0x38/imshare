                localMetadata || doc
                    ? {
                          ...doc,
                          ...localMetadata,
                          operationId:
                              localMetadata?.operationId ??
                              (current.operationId as string | undefined) ??
                              (doc ? openapiOperationId(method, url) : undefined),
                          tags:
                              localMetadata?.tags ??
                              (currentTags.length > 0
                                  ? currentTags
                                  : doc
                                    ? [openapiTagForPath(url)]
                                    : undefined),
                      }
                    : undefined;

            const compiled = compileOpenApiOperation(current as never, metadata);
            const responses = (compiled.responses as Record<string, unknown> | undefined) ?? {};

            if (Object.keys(responses).length === 0) {
                compiled.responses = {
                    "200": { description: "Successful response." },
                };
            }

            compiled.tags =
                Array.isArray(compiled.tags) && compiled.tags.length > 0
                    ? compiled.tags
                    : [openapiTagForPath(url)];

            if (!compiled.operationId && method && url) {
                compiled.operationId = openapiOperationId(method, url);
            }

            if (
                url !== "/api/v1/me/api-tokens" &&
                Array.isArray(compiled.security) &&
                compiled.security.length === 1 &&
                typeof compiled.security[0] === "object" &&
                compiled.security[0] !== null &&
                "cookieAuth" in compiled.security[0]
            ) {
                compiled.security = [{ cookieAuth: [] }, { bearerAuth: [] }];
            }

            const transformedSchema = {
                ...schemaWithoutOpenApiMetadata,
                ...compiled,
                ...(isDocumentedRoute(url) ? {} : { hide: true }),
            };

            return {
                schema: transformedSchema,
                url,
            };
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: "/docs",
    });
}

function createComponentResponses(): Record<string, OpenApiComponentResponse> {
    return {
        BadRequest: {
            description: "The request could not be validated or parsed.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                    examples: {
                        invalidRequest: {
                            summary: "Invalid request",
                            value: {
                                error: {
                                    code: "BAD_REQUEST",
                                    message: "Request validation failed.",
                                },
                            },
                        },