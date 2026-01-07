import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

export const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});
