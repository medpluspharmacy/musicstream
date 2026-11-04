export function databaseConfig(url: string): {
  url: string;
  ssl: false | { require: true; rejectUnauthorized: boolean; ca?: string };
};
