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
    console.time("Elastic decisions search");
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
    } finally {
      console.timeEnd("Elastic decisions search");
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
      const result = await this.client.search<{ contextual_content: string }>({
        index: 'doctrines',
        query: {
          match: {
            contextual_content: query
          }
        },
        size: limit
      });
      return result.hits.hits.map((hit:any) => {
        return {
          id: hit._id,
          contextual_content: hit._source?.contextual_content
        };
      });
    } catch (error) {
      console.error("cannot search doctrines:", error);
    }
  }

  public async searchUserDocuments(query: string, limit: number): Promise<any> {
    try {
      const indexName = await this.getUserDocumentIndexName();
      if (!await this.isIndexExists(indexName)) {
        console.log('searchUserDocuments index does not exist, create it.')
        await this.createIndex(indexName);
      }
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

  public async searchUserDocumentsByFilename(query: string, filename: string, limit: number): Promise<any> {
    try {
      const indexName = await this.getUserDocumentIndexName();
      if (!await this.isIndexExists(indexName)) {
        console.log('searchUserDocumentsByFilename index does not exist, create it.');
        await this.createIndex(indexName);
      }

      const result = await this.client.search<{ content: string; filename: string }>({
        index: indexName,
        query: {
          bool: {
            must: [
              { match: { content: query } }, // Full-text search on content
              { term: { "filename.keyword": filename } } // Exact match on filename.keyword
            ]
          }
        },
        size: limit
      });
      return result.hits.hits.map(hit => ({
        id: hit._id,
        content: hit._source?.content,
        filename: hit._source?.filename
      }));
    } catch (error) {
      console.error("Cannot search user documents by filename:", error);
      throw error; // Throw the error to handle it upstream
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

  public async indexUserDocument(doc: Pick<UserDocument, "id" | "content">, filename: string, indexName: string) {
    try {
      await this.client.index({
        index: indexName,
        id: doc.id.toString(),
        document: {
          content: doc.content,
          filename: filename
        }
      });
    } catch (error) {
      console.error(`Error indexing user document (${doc.id}):`, error);
    }
  }

  public async deleteAllDataInIndex(index: string): Promise<void> {
    try {
      // Ensure the index exists before attempting deletion
      const indexExists = await this.isIndexExists(index);
      if (!indexExists) {
        console.log(`Index ${index} does not exist. No data to delete.`);
        return;
      }

      // Use the _delete_by_query API to delete all documents
      const result = await this.client.deleteByQuery({
        index: index,
        query: {
          match_all: {}, // Match all documents
        },
        refresh: true, // Ensures the index is refreshed after deletion
      });

      console.log(`Successfully deleted all data from index ${index}:`, result);
    } catch (error) {
      console.error(`Error deleting all data from index ${index}:`, error);
    }
  }

  public async searchTitleSuggestions(query: string, limit: number = 5): Promise<{ title: string; idcc: string }[]> {
    try {
      const result = await this.client.search<{ title: string; idcc: string }>({
        index: 'conv_coll',
        query: {
          bool: {
            should: [
              { match: { title: query } },  // Search by title
              { match: { idcc: query } }    // Search by idcc
            ],
            minimum_should_match: 1  // At least one condition must match
          }
        },
        size: limit,
        _source: ['title', 'idcc'], // Fetch only the required fields
      });

      return result.hits.hits.map((hit) => ({
        title: hit._source?.title || "",
        idcc: hit._source?.idcc || "",
      }));
    } catch (error) {
      console.error("Error fetching suggestions from Elasticsearch:", error);
      return [];
    }
  }
}

export const ElasticsearchClient = ElasticsearchClientSingleton.getInstance();
