export interface AIRequest {
    platform: string;
    query: string;
  }
  
  export interface GoogleResult {
    title: string;
    link: string;
    snippet: string;
  }
  
  export interface AIResponse {
    message?: string;
    results?: GoogleResult[];
  }