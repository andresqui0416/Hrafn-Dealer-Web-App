import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

import { classifyIntent } from "./classify-intent";
import { generateSQLFromNaturalLanguage } from "./sql-generator";
import { formatDataResultsAsNaturalLanguage } from "./format_data_results_as_natural_language";
import { generateGeneralResponse } from "./generate_general_response";

export {
  openai,
  classifyIntent,
  generateSQLFromNaturalLanguage,
  formatDataResultsAsNaturalLanguage,
  generateGeneralResponse,
};
