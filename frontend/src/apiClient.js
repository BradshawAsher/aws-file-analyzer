import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultBaseUrl = import.meta.env.PROD
  ? 'https://app-afa-eycaz6z3q3pp4.azurewebsites.net'
  : 'https://localhost:5000';

export const API_BASE_URL = (configuredBaseUrl || defaultBaseUrl)
  .replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;
