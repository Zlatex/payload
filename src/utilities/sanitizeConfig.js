const defaultUser = require('../auth/default');
const sanitizeCollection = require('../collections/sanitize');
const { InvalidConfiguration } = require('../errors');
const sanitizeGlobals = require('../globals/sanitize');
const validateSchema = require('../schema/validateSchema');

const sanitizeConfig = (config) => {
  const sanitizedConfig = validateSchema({ ...config });

  // TODO: remove default values from sanitize in favor of assigning in the schema within validateSchema and use https://www.npmjs.com/package/ajv#coercing-data-types where needed
  if (sanitizedConfig.publicENV === undefined) sanitizedConfig.publicENV = {};

  if (sanitizedConfig.defaultDepth === undefined) sanitizedConfig.defaultDepth = 2;
  if (sanitizedConfig.maxDepth === undefined) sanitizedConfig.maxDepth = 10;

  sanitizedConfig.collections = sanitizedConfig.collections.map((collection) => sanitizeCollection(sanitizedConfig.collections, collection));

  if (sanitizedConfig.globals) {
    sanitizedConfig.globals = sanitizeGlobals(sanitizedConfig.collections, sanitizedConfig.globals);
  } else {
    sanitizedConfig.globals = [];
  }

  if (!sanitizedConfig.cookiePrefix) sanitizedConfig.cookiePrefix = 'payload';

  sanitizedConfig.csrf = [
    ...(Array.isArray(config.csrf) ? config.csrf : []),
    config.serverURL,
  ];

  sanitizedConfig.admin = config.admin || {};

  sanitizedConfig.upload = config.upload || {};

  if (!sanitizedConfig.admin.user) {
    sanitizedConfig.admin.user = 'users';
    sanitizedConfig.collections.push(defaultUser);
  }

  sanitizedConfig.email = config.email || {};
  // TODO: This should likely be moved to the payload.schema.json
  if (sanitizedConfig.email.transports) {
    if (!sanitizedConfig.email.email.fromName || !sanitizedConfig.email.email.fromAddress) {
      throw new InvalidConfiguration('Email fromName and fromAddress must be configured when transport is configured');
    }
  }

  sanitizedConfig.graphQL = config.graphQL || {};
  sanitizedConfig.graphQL.maxComplexity = (sanitizedConfig.graphQL && sanitizedConfig.graphQL.maxComplexity) ? sanitizedConfig.graphQL.maxComplexity : 1000;
  sanitizedConfig.graphQL.disablePlaygroundInProduction = (sanitizedConfig.graphQL && sanitizedConfig.graphQL.disablePlaygroundInProduction !== undefined) ? sanitizedConfig.graphQL.disablePlaygroundInProduction : true;

  sanitizedConfig.routes = {
    admin: (config.routes && config.routes.admin) ? config.routes.admin : '/admin',
    api: (config.routes && config.routes.api) ? config.routes.api : '/api',
    graphQL: (config.routes && config.routes.graphQL) ? config.routes.graphQL : '/graphql',
    graphQLPlayground: (config.routes && config.routes.graphQLPlayground) ? config.routes.graphQLPlayground : '/graphql-playground',
  };

  sanitizedConfig.rateLimit = config.rateLimit || {};
  sanitizedConfig.rateLimit.window = sanitizedConfig.rateLimit.window || 15 * 60 * 100; // 15min default
  sanitizedConfig.rateLimit.max = sanitizedConfig.rateLimit.max || 500;

  if (!sanitizedConfig.express) {
    sanitizedConfig.express = {
      json: {},
    };
  }

  sanitizedConfig.components = { ...(config.components || {}) };
  sanitizedConfig.hooks = { ...(config.hooks || {}) };
  sanitizedConfig.admin = { ...(config.admin || {}) };

  return sanitizedConfig;
};

module.exports = sanitizeConfig;
