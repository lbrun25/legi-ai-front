"use server"
import {sql} from "@/lib/sql/client";
import {createClient} from "@/lib/supabase/client/server";

export const isSupabaseTableExists = async (tableName: string) => {
  const result = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    ) AS exists
  `;
  return result[0].exists;
}

export const createAdaptiveRetrievalIndex = async (tableName: string) => {
  const indexName = `${tableName}_index`;
  await sql`
    CREATE INDEX ${sql(indexName)} ON ${sql(tableName)}
      USING hnsw ((sub_vector("embedding_openai", 512)::vector(512)) vector_ip_ops)
      WITH (m = 32, ef_construction = 400);
  `;
};

export const createHnswIndex = async (tableName: string, embeddingColumn: string) => {
  const indexName = `${tableName}_index`;
  await sql`
    CREATE INDEX ${sql(indexName)} ON ${sql(tableName)}
      USING hnsw (${sql(embeddingColumn)} vector_cosine_ops);
  `;
};

export const createAdaptiveRetrievalFunction = async (tableName: string, embeddingColumnName: string) => {
  const functionName = `match_${tableName}_adaptive`;
  await sql`
    create or replace function ${sql(functionName)}(
      query_embedding halfvec(3072),
      match_count int
    )
    returns table(id bigint)
    language sql
    as $$
    with shortlist as (
      select ${sql(embeddingColumnName)}, id
      from ${sql(tableName)}
      order by
        sub_vector(${sql(embeddingColumnName)}, 512)::vector(512) <#> (
          select sub_vector(query_embedding, 512)::vector(512)
        ) asc
      limit match_count * 8
    )
    select id
    from shortlist
    order by ${sql(embeddingColumnName)} <#> query_embedding asc
    limit least(match_count, 200);
    $$;
  `;
};

export const getUserId = async () => {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  return authData.user.id;
}
