declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_USERNAME: string;
      DB_HOST: string;
      DB_PASSWORD: string;
      DB_PORT: string;
      DB_DATABASE: string;
      NODE_ENV: 'development' | 'production' | 'test';
      STAGE: string
      CI_COMMIT_SHA: string
      APPLICATION_PORT: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
