const MICROSERVER_URL = process.env.MICROSERVER_URL || "http://localhost:8000";

interface IntentResponse {
  intent: "data_query" | "general";
}

interface SQLResponse {
  sql: string;
}

async function isMicroserverAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${MICROSERVER_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(1000), // 1 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function classifyIntentMicroserver(
  message: string
): Promise<"data_query" | "general"> {
  try {
    const response = await fetch(`${MICROSERVER_URL}/classify-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error(`Microserver returned ${response.status}: ${response.statusText}`);
    }

    const data: IntentResponse = await response.json();
    return data.intent;
  } catch (error) {
    console.error("Error calling microserver for intent classification:", error);
    throw error;
  }
}

export async function generateSQLMicroserver(
  question: string,
  userId: string,
  appId?: string
): Promise<string> {
  try {
    const response = await fetch(`${MICROSERVER_URL}/generate-sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`Microserver returned ${response.status}: ${response.statusText}`);
    }

    const data: SQLResponse = await response.json();
    let sql = data.sql;

    // Build WHERE conditions
    const conditions: string[] = [`"userId" = '${userId}'`];
    if (appId) {
      conditions.push(`"appId" = '${appId}'`);
    }
    const whereClause = conditions.join(" AND ");

    // Replace :userId placeholder or add WHERE clause if missing
    if (sql.includes(":userId")) {
      sql = sql.replace(/:userId/g, `'${userId}'`);
      if (appId && sql.includes("from inventory_listings")) {
        // Add appId filter if not already present
        if (!sql.includes(`"appId"`)) {
          sql = sql.replace(/where\s+/i, `WHERE ${whereClause} AND `);
        }
      }
    } else if (sql.toLowerCase().includes("from inventory_listings")) {
      // Add userId and appId filters if missing
      const whereMatch = sql.match(/where\s+/i);
      if (!whereMatch) {
        // Add WHERE clause
        sql = sql.replace(
          /from\s+inventory_listings/i,
          `FROM inventory_listings WHERE ${whereClause}`
        );
      } else {
        // Add userId and appId to existing WHERE clause if not already present
        if (!sql.includes(`"userId"`)) {
          sql = sql.replace(/where\s+/i, `WHERE ${whereClause} AND `);
        } else if (appId && !sql.includes(`"appId"`)) {
          sql = sql.replace(/where\s+/i, `WHERE ${whereClause} AND `);
        }
      }
    }

    return sql;
  } catch (error) {
    console.error("Error calling microserver for SQL generation:", error);
    throw error;
  }
}

export { isMicroserverAvailable };

