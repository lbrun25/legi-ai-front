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

  public async searchArticles(codeName: string, query: string, limit: number): Promise<any> {
    try {
      const result = await this.client.search<{ content: string }>({
        index: `articles_${codeName}`,
        query: {
          match: {
            content: query
          }
        },
        size: limit
      });
      return result.hits.hits.map(hit => {
        return {
          id: hit._id,
          content: hit._source?.content
        };
      });
    } catch (error) {
      console.error("cannot search articles:", error);
    }
  }

  public async searchDoctrines(query: string, limit: number): Promise<any> {
    try {
      const result = await this.client.search<{ paragrapheContent: string }>({
        index: 'doctrines',
        query: {
          match: {
            paragrapheContent: query
          }
        },
        size: limit
      });
      return result.hits.hits.map(hit => {
        return {
          id: hit._id,
          paragrapheContent: hit._source?.paragrapheContent
        };
      });
    } catch (error) {
      console.error("cannot search doctrines:", error);
    }
  }
}

export const ElasticsearchClient = ElasticsearchClientSingleton.getInstance();
