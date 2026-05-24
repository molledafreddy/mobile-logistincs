import { apiClient } from './client';
import type { GeocodeFeature, GeocodeSearchResult } from '../../types';

interface SearchOptions {
  limit?: number;
  proximity?: { lat: number; lng: number };
  country?: string;
  language?: string;
}

export const GeocodingService = {
  async search(query: string, opts?: SearchOptions): Promise<GeocodeFeature[]> {
    const params: Record<string, unknown> = { q: query };
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.country) params.country = opts.country;
    if (opts?.language) params.language = opts.language;
    if (opts?.proximity) params.proximity = `${opts.proximity.lat},${opts.proximity.lng}`;
    const { data } = await apiClient.get<GeocodeSearchResult>('/geocoding/search', { params });
    return data.features;
  },

  async reverse(lat: number, lng: number, opts?: { country?: string; language?: string }): Promise<GeocodeFeature | null> {
    const params: Record<string, unknown> = { lat, lng };
    if (opts?.country) params.country = opts.country;
    if (opts?.language) params.language = opts.language;
    const { data } = await apiClient.get<GeocodeSearchResult>('/geocoding/reverse', { params });
    return data.features[0] ?? null;
  },

  async validate(address: string): Promise<{ valid: boolean; feature?: GeocodeFeature }> {
    const { data } = await apiClient.get<{ valid: boolean; feature?: GeocodeFeature }>(
      '/geocoding/validate',
      { params: { address } }
    );
    return data;
  },
};
