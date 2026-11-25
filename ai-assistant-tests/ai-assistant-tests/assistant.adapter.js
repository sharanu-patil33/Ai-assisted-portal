'use strict';
/**
 * The tests only talk to the assistant through this file.
 *
 *   npm test                                    -> runs against the built-in reference mock
 *   ASSISTANT_IMPL=./real-adapter.js npm test   -> runs against YOUR project (see real-adapter.template.js)
 */
const path = require('node:path');
const { createMockAssistant } = require('./mock-assistant');

function createAssistant(overrides = {}) {
  if (process.env.ASSISTANT_IMPL) {
    const factory = require(path.resolve(process.env.ASSISTANT_IMPL));
    return factory(overrides);
  }
  return createMockAssistant(overrides);
}

module.exports = { createAssistant };
