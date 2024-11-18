import {Client} from "@elastic/elasticsearch";
import {createClient} from "@/lib/supabase/client/server";
import {UserDocument} from "@/lib/types/document";

class ElasticsearchClientSingleton {
  private static _instance: ElasticsearchClientSingleton;

  private readonly client: Client;

  private constructor() {
    this.client = new Client({
      node: process.env.ES_NODE_URL,
      tls: {
        rejectUnauthorized: false  // Bypass SSL validation
      }
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
      console.time("Elastic decisions search")
      const result = await this.client.search<{ ficheArret: string }>({
        index: 'decisions',
        query: {
          match: {
            ficheArret: query
          }
        },
        size: limit
      });
      console.timeEnd("Elastic decisions search")
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

  public async searchUserDocuments(query: string, limit: number): Promise<any> {
    try {
      const indexName = await this.getUserDocumentIndexName();
      const result = await this.client.search<{ content: string }>({
        index: indexName,
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
      console.error("cannot search user documents:", error);
    }
  }

  public async isIndexExists(index: string): Promise<boolean> {
    return await this.client.indices.exists({ index: index });
  }

  public async createIndex(index: string): Promise<void> {
    try {
      await this.client.indices.create({ index: index });
      console.log('Index created successfully');
    } catch (error) {
      console.error('Error checking or creating index:', error);
    }
  }

  public async deleteIndex(index: string): Promise<void> {
    try {
      // Check if the index exists
      const indexExists = await this.client.indices.exists({index});

      if (indexExists) {
        // If the index exists, delete it
        await this.client.indices.delete({index});
        console.log(`Index ${index} deleted successfully`);
      } else {
        console.log(`Index ${index} does not exist`);
      }
    } catch (error) {
      console.error(`Error deleting index ${index}:`, error);
    }
  }

  public async getUserDocumentIndexName() {
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData?.user) throw new Error("Unauthorized");
    const userId = authData.user.id;
    return `documents_${userId}`;
  }

  public async checkUserDocumentIndex() {
    const indexName = await this.getUserDocumentIndexName();
    const isIndexExists = this.isIndexExists(indexName);
    if (!isIndexExists) {
      await this.createIndex(indexName);
    }
    return indexName;
  }

  public async indexUserDocument(doc: Pick<UserDocument, "id" | "content">, indexName: string) {
    try {
      await this.client.index({
        index: indexName,
        id: doc.id.toString(),
        document: {
          content: doc.content
        }
      });
    } catch (error) {
      console.error(`Error indexing user document (${doc.id}):`, error);
    }
  }
}

export const ElasticsearchClient = ElasticsearchClientSingleton.getInstance();
