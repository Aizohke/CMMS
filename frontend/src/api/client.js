import axios from "axios";

// Set VITE_API_URL in a .env file at the frontend root when deploying
// (e.g. VITE_API_URL=https://your-backend.onrender.com/api)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("cmms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("cmms_token");
      localStorage.removeItem("cmms_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;
