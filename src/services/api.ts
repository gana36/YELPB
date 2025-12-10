const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class YelpAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'YelpAPIError';
  }
}

export interface Business {
  id: string;
  name: string;
  rating?: number;
  reviews?: number;
  price?: string;
  distance?: string;
  image?: string;
  image_url?: string;
  tags?: string[];
  votes?: number;
  location?: {
    address1?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  url?: string;
  categories?: Array<{ alias: string; title: string }>;
}

export interface SearchRequest {
  query: string;
  latitude?: number;
  longitude?: number;
  locale?: string;
}

export interface ChatRequest {
  query: string;
  user_context?: {
    locale: string;
    latitude?: number;
    longitude?: number;
  };
  chat_id?: string;
}

export interface ChatResponse {
  response_text: string;
  chat_id?: string;
  businesses: Business[];
  types?: string[];
  raw_response?: any;
}

export interface MultimodalSearchRequest {
  text_query?: string;
  audio_base64?: string;
  image_base64?: string;
  audio_mime_type?: string;
  image_mime_type?: string;
  latitude?: number;
  longitude?: number;
  locale?: string;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new YelpAPIError(
          errorData.detail || `HTTP error! status: ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof YelpAPIError) throw error;
      console.error('API request failed:', error);
      throw new YelpAPIError(
        'Network error: Unable to connect to backend',
        undefined,
        error
      );
    }
  }

  async searchBusinesses(request: SearchRequest): Promise<Business[]> {
    const businesses = await this.request<Business[]>('/api/yelp/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    // Map image_url to image for consistency
    return businesses.map((b) => ({
      ...b,
      image: b.image_url || b.image,
      tags: b.categories?.map(c => c.title) || [],
    }));
  }

  async combinedSearch(params: {
    query?: string;
    latitude: number;
    longitude: number;
    term?: string;
    radius?: number;
    categories?: string[];
    price?: number[];
    limit?: number;
  }): Promise<Business[]> {
    const businesses = await this.request<Business[]>('/api/yelp/combined-search', {
      method: 'POST',
      body: JSON.stringify({
        query: params.query || 'best restaurants',
        latitude: params.latitude,
        longitude: params.longitude,
        term: params.term || 'restaurants',
        radius: params.radius,
        categories: params.categories,
        price: params.price,
        limit: params.limit || 10,
      }),
    });

    // Map image_url to image for consistency
    return businesses.map((b) => ({
      ...b,
      image: b.image_url || b.image,
      tags: b.categories?.map(c => c.title) || [],
    }));
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/yelp/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async multimodalSearch(request: MultimodalSearchRequest): Promise<any> {
    return this.request('/api/gemini/multimodal-search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async processAudio(audioBase64: string, mimeType: string = 'audio/mp3'): Promise<any> {
    return this.request('/api/gemini/process-audio', {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: audioBase64,
        mime_type: mimeType,
      }),
    });
  }

  async processImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<any> {
    return this.request('/api/gemini/process-image', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: imageBase64,
        mime_type: mimeType,
      }),
    });
  }

  async transcribeAudio(audioBase64: string, mimeType: string = 'audio/mp3'): Promise<any> {
    return this.request('/api/gemini/transcribe-audio', {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: audioBase64,
        mime_type: mimeType,
      }),
    });
  }

  async analyzePreferences(textQuery: string): Promise<any> {
    return this.request('/api/gemini/analyze-preferences', {
      method: 'POST',
      body: JSON.stringify({
        text_query: textQuery,
      }),
    });
  }

  async bookReservation(
    businessName: string,
    partySize: number,
    date: string,
    time: string,
    latitude?: number,
    longitude?: number
  ): Promise<any> {
    return this.request('/api/yelp/book-reservation', {
      method: 'POST',
      body: JSON.stringify({
        business_name: businessName,
        party_size: partySize,
        date,
        time,
        latitude,
        longitude,
      }),
    });
  }

  async geminiChat(
    userMessage: string,
    sessionContext: string = '',
    currentPreferences: Record<string, string> = {}
  ): Promise<{ success: boolean; message: string }> {
    return this.request('/api/gemini/chat', {
      method: 'POST',
      body: JSON.stringify({
        user_message: userMessage,
        session_context: sessionContext,
        current_preferences: currentPreferences,
      }),
    });
  }

  async startCalendarAuth(userId: string): Promise<{ auth_url: string; state: string }> {
    return this.request(`/api/calendar/auth/start?user_id=${userId}`, {
      method: 'GET',
    });
  }

  async createCalendarEvent(
    accessToken: string,
    refreshToken: string | null,
    eventDetails: any
  ): Promise<any> {
    return this.request('/api/calendar/create-event', {
      method: 'POST',
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        event_details: eventDetails,
      }),
    });
  }

  async scrapeMenu(menuUrl: string): Promise<{
    success: boolean;
    menu?: {
      categories: Array<{
        name: string;
        items: Array<{
          name: string;
          price?: string;
          description?: string;
        }>;
      }>;
      highlights?: string[];
      price_range?: string;
    };
    error?: string;
  }> {
    return this.request('/api/menu/scrape', {
      method: 'POST',
      body: JSON.stringify({ menu_url: menuUrl }),
    });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health', {
      method: 'GET',
    });
  }
}

export const apiService = new ApiService();
