// Initialize the postgres client
import postgres from "postgres";

export const sql = postgres({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  username: 'postgres.emgtfetkdcnieuwxswet',
  password: '4pI9VtldkXuVvKP3',
  database: 'postgres',
});
