import {Client} from "@elastic/elasticsearch";

class ElasticsearchClientSingleton {
  private static _instance: ElasticsearchClientSingleton;

  private readonly client: Client;

  private constructor() {
    this.client = new Client({
      node: process.env.ES_NODE_URL
    });
  }

  public static getInstance(): ElasticsearchClientSingleton {
    if (!ElasticsearchClientSingleton._instance) {
      ElasticsearchClientSingleton._instance = new ElasticsearchClientSingleton();
    }
    return ElasticsearchClientSingleton._instance;
  }

  public async searchDecisions(query: string, limit: number): Promise<any> {
    try {
      const result = await this.client.search<{ ficheArret: string }>({
        index: 'decisions',
        query: {
          match: {
            ficheArret: query
          }
        },
        size: limit
      });
      return result.hits.hits.map(hit => {
        return {
          id: hit._id,
          ficheArret: hit._source?.ficheArret
        };
      });
    } catch (error) {
      console.error("cannot search decisions:", error);
    }
  }
}

export const ElasticsearchClient = ElasticsearchClientSingleton.getInstance();
